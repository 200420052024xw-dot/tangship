import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import Database = require('better-sqlite3');
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { hashPassword, hashToken, verifyPassword } from '../auth/security';
import { DEFAULT_PRICING } from '../operations/operations.service';

type SqliteDb = Database.Database;
type AdminIdentity = { id: string; username: string; role: string };

const now = () => new Date().toISOString();
const parseJson = <T>(value: unknown, fallback: T): T => {
  try { return typeof value === 'string' ? JSON.parse(value) as T : fallback; } catch { return fallback; }
};
const asBoolean = (value: unknown) => value === true || value === 1;
const maskPhone = (value: string) => value?.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') || '';
const ACTIVE_RESERVATION_STATUSES = ['pending_payment', 'paid', 'dispatching', 'delivering'];
type VehicleServiceMode = 'single' | 'monthly' | 'rental';
const syncedVehicleId = (id: string, mode: VehicleServiceMode) => { const baseId = id.replace(/-(monthly|rental)$/i, ''); return mode === 'single' ? baseId : `${baseId}-${mode}`; };
const normalizeSyncModes = (value: unknown): VehicleServiceMode[] => Array.isArray(value) ? [...new Set(value.filter((mode): mode is VehicleServiceMode => mode === 'single' || mode === 'monthly' || mode === 'rental'))] : [];

@Injectable()
export class AdminDataService implements OnModuleInit, OnModuleDestroy {
  private db?: SqliteDb;
  readonly mode: 'sqlite' | 'supabase';

  constructor(private readonly supabase: SupabaseService) {
    this.mode = process.env.ADMIN_DATA_BACKEND === 'sqlite' ? 'sqlite' : 'supabase';
    if (this.mode === 'sqlite' && process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_DATA_BACKEND=sqlite is forbidden in production');
    }
  }

  get isSqlite() { return this.mode === 'sqlite'; }

  onModuleInit() {
    if (!this.isSqlite) return;
    const dbPath = this.resolveDbPath();
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma(`busy_timeout = ${Math.max(1000, Number(process.env.SQLITE_BUSY_TIMEOUT_MS) || 5000)}`);
    this.migrate();
    this.normalizeLegacyRoles();
    this.seed();
    this.seedOperationalDemo();
    console.log(`[AdminData] SQLite mode: ${dbPath}`);
    console.log(`[AdminData] Local login: ${process.env.LOCAL_ADMIN_USERNAME || 'wjf'} / ${process.env.LOCAL_ADMIN_PASSWORD || '123'}`);
  }

  onModuleDestroy() { this.db?.close(); }

  runtime() {
    return { dataMode: this.mode, capabilities: { assetUpload: !this.isSqlite, wechatSession: !this.isSqlite }, localOnly: this.isSqlite };
  }

  async authenticate(username: string, password: string) {
    if (this.isSqlite) {
      const row = this.sqlite().prepare('SELECT * FROM admin_users WHERE username = ?').get(username) as any;
      if (!row || row.status !== 'active' || !verifyPassword(password, row.password_hash)) throw new UnauthorizedException('用户名或密码错误');
      return { id: row.id, username: row.username, role: row.role } as AdminIdentity;
    }
    const { data: row, error } = await this.supabase.getClient().from('admin_users').select('*').eq('username', username).maybeSingle();
    if (error || !row || row.status !== 'active' || !verifyPassword(password, row.password_hash)) throw new UnauthorizedException('用户名或密码错误');
    return { id: row.id, username: row.username, role: row.role } as AdminIdentity;
  }

  async createAdminSession(adminId: string, hours = 12) {
    const token = randomBytes(32).toString('base64url');
    const createdAt = now();
    const expiresAt = new Date(Date.now() + hours * 3600000).toISOString();
    const values = { id: randomUUID(), admin_user_id: adminId, token_hash: hashToken(token), expires_at: expiresAt, created_at: createdAt };
    if (this.isSqlite) this.sqlite().prepare('INSERT INTO admin_sessions (id, admin_user_id, token_hash, expires_at, created_at) VALUES (@id,@admin_user_id,@token_hash,@expires_at,@created_at)').run(values);
    else {
      const { error } = await this.supabase.getClient().from('admin_sessions').insert(values);
      if (error) throw new Error(`创建管理员会话失败: ${error.message}`);
    }
    return { token, expiresAt };
  }

  async revokeAdminSession(token: string) {
    const tokenHash = hashToken(token);
    if (this.isSqlite) this.sqlite().prepare('UPDATE admin_sessions SET revoked_at = ? WHERE token_hash = ?').run(now(), tokenHash);
    else await this.supabase.getClient().from('admin_sessions').update({ revoked_at: now() }).eq('token_hash', tokenHash);
  }

  async adminFromSession(token: string): Promise<AdminIdentity | null> {
    const tokenHash = hashToken(token);
    if (this.isSqlite) {
      const row = this.sqlite().prepare(`SELECT a.id,a.username,a.role,a.status FROM admin_sessions s JOIN admin_users a ON a.id=s.admin_user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?`).get(tokenHash, now()) as any;
      return row?.status === 'active' ? { id: row.id, username: row.username, role: row.role } : null;
    }
    const client = this.supabase.getClient();
    const { data: session } = await client.from('admin_sessions').select('admin_user_id').eq('token_hash', tokenHash).is('revoked_at', null).gt('expires_at', now()).maybeSingle();
    if (!session) return null;
    const { data: row } = await client.from('admin_users').select('id,username,role,status').eq('id', session.admin_user_id).maybeSingle();
    return row?.status === 'active' ? { id: row.id, username: row.username, role: row.role } : null;
  }

  dashboard() {
    const db = this.sqlite();
    const count = (status: string) => Number((db.prepare('SELECT count(*) total FROM orders WHERE status=?').get(status) as any).total);
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const recentPending = this.listOrders({ status: 'pending_review', page: 1, pageSize: 5 }).items;
    const pendingMonthly = Number((db.prepare(`SELECT count(*) total FROM inquiries WHERE type='monthly' AND status='pending'`).get() as any).total);
    const pendingRental = Number((db.prepare(`SELECT count(*) total FROM inquiries WHERE type='rental' AND status='pending'`).get() as any).total);
    const unreadNotifications = Number((db.prepare('SELECT count(*) total FROM admin_notifications WHERE read_at IS NULL').get() as any).total);
    const vehicleCapacity = this.listVehicles('single').map(vehicle => ({ id: vehicle.id, name: vehicle.name, totalCount: vehicle.totalCount, reservedCount: vehicle.reservedCount, availableCount: vehicle.availableCount }));
    return { pendingReview: count('pending_review'), pendingPayment: count('pending_payment'), paid: count('paid'), dispatching: count('dispatching'), delivering: count('delivering'), todayNew: Number((db.prepare('SELECT count(*) total FROM orders WHERE created_at>=?').get(today.toISOString()) as any).total), rejected: count('rejected'), pendingMonthly, pendingRental, unreadNotifications, recentPending, vehicleCapacity };
  }

  listOrders(query: any) {
    const db = this.sqlite();
    const page = Math.max(1, Number(query.page) || 1), pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const where: string[] = [], args: any[] = [];
    if (query.status) { where.push('o.status=?'); args.push(String(query.status)); }
    if (query.orderNo) { where.push('o.order_no LIKE ?'); args.push(`%${String(query.orderNo).slice(0, 50)}%`); }
    if (query.keyword) { where.push('(s.contact_name LIKE ? OR s.phone LIKE ?)'); args.push(`%${String(query.keyword).slice(0, 80)}%`, `%${String(query.keyword).slice(0, 80)}%`); }
    if (query.dateFrom) { where.push('o.created_at>=?'); args.push(new Date(query.dateFrom).toISOString()); }
    if (query.dateTo) { const d = new Date(query.dateTo); d.setUTCHours(23, 59, 59, 999); where.push('o.created_at<=?'); args.push(d.toISOString()); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const join = `FROM orders o LEFT JOIN order_addresses s ON s.order_id=o.id AND s.role='sender' LEFT JOIN order_addresses r ON r.order_id=o.id AND r.role='receiver' LEFT JOIN admin_users a ON a.id=o.reviewed_by`;
    const total = Number((db.prepare(`SELECT count(DISTINCT o.id) total ${join} ${clause}`).get(...args) as any).total);
    const rows = db.prepare(`SELECT o.*,s.contact_name,s.phone,s.district sender_district,r.district receiver_district,COALESCE(NULLIF(a.nickname,''),a.username) reviewer ${join} ${clause} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize) as any[];
    const items = rows.map(row => ({ ...row, orderNo: row.order_no, vehicleId: row.vehicle_id, scheduledAt: row.scheduled_at, contactName: row.contact_name, phone: maskPhone(row.phone), senderDistrict: row.sender_district, receiverDistrict: row.receiver_district }));
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  orderDetail(id: string, role: string) {
    const db = this.sqlite();
    const order = db.prepare("SELECT o.*,u.nickname,COALESCE(NULLIF(a.nickname,''),a.username) reviewer FROM orders o LEFT JOIN users u ON u.id=o.user_id LEFT JOIN admin_users a ON a.id=o.reviewed_by WHERE o.id=?").get(id) as any;
    if (!order) throw new NotFoundException('订单不存在');
    const pii = role === 'super_admin' || role === 'operator';
    const addresses = (db.prepare('SELECT * FROM order_addresses WHERE order_id=? ORDER BY role').all(id) as any[]).map(v => pii ? v : { ...v, phone: maskPhone(v.phone), detail_address: '***', longitude: null, latitude: null });
    return { ...order, addresses, items: db.prepare('SELECT * FROM order_items WHERE order_id=?').all(id), quotes: db.prepare('SELECT * FROM order_quotes WHERE order_id=? ORDER BY created_at DESC').all(id), statusLogs: db.prepare('SELECT * FROM order_status_logs WHERE order_id=? ORDER BY created_at').all(id), auditLogs: db.prepare(`SELECT id,action,created_at,admin_user_id FROM audit_logs WHERE target_type='order' AND target_id=? ORDER BY created_at DESC`).all(id) };
  }

  reviews(query: any) {
    const page = Math.max(1, Number(query.page) || 1), pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const args: any[] = [], where = [`l.target_type='order'`, `l.action IN ('order.approve','order.reject')`];
    if (query.result === 'approved') { where.push(`l.action='order.approve'`); }
    if (query.result === 'rejected') { where.push(`l.action='order.reject'`); }
    const clause = where.join(' AND '), db = this.sqlite();
    const total = Number((db.prepare(`SELECT count(*) total FROM audit_logs l WHERE ${clause}`).get(...args) as any).total);
    const rows = db.prepare(`SELECT l.*,o.order_no,COALESCE(NULLIF(a.nickname,''),a.username) reviewer FROM audit_logs l LEFT JOIN orders o ON o.id=l.target_id LEFT JOIN admin_users a ON a.id=l.admin_user_id WHERE ${clause} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize) as any[];
    const items = rows.map(v => { const detail = parseJson<any>(v.detail, {}); return { ...v, orderId: v.target_id, orderNo: v.order_no, totalCents: detail.totalCents, rejectionReason: detail.rejectionReason }; });
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  reviewOrder(adminId: string, id: string, body: any) {
    const db = this.sqlite();
    const execute = db.transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id=?').get(id) as any;
      if (!order) throw new NotFoundException('订单不存在');
      if (order.status !== 'pending_review') throw new ConflictException('订单已审核或当前状态不允许审核');
      const t = now();
      if (body.decision === 'reject') {
        const reason = String(body.rejectionReason || '').trim();
        if (!reason) throw new BadRequestException('拒绝原因不能为空');
        db.prepare(`UPDATE orders SET status='rejected',reviewed_by=?,reviewed_at=?,rejection_reason=?,internal_note=?,updated_at=? WHERE id=?`).run(adminId, t, reason, body.internalNote || null, t, id);
        this.insertOrderLogs(db, adminId, id, 'pending_review', 'rejected', 'order.reject', { ...body, rejectionReason: reason }, t);
      } else if (body.decision === 'approve') {
        const keys = ['baseFeeCents','distanceFeeCents','vehicleFeeCents','serviceFeeCents','discountCents','distanceMeters'];
        if (keys.some(key => !Number.isInteger(body[key]) || body[key] < 0)) throw new BadRequestException('报价金额和距离必须为非负整数');
        const total = body.baseFeeCents + body.distanceFeeCents + body.vehicleFeeCents + body.serviceFeeCents - body.discountCents;
        const expires = new Date(body.expiresAt);
        if (total < 0 || !Number.isFinite(expires.getTime()) || expires <= new Date()) throw new BadRequestException('报价金额或有效期无效');
        const vehicleCount = Math.min(99, Math.max(1, Number(body.vehicleCount) || 1));
        db.prepare(`UPDATE orders SET status='pending_payment',reviewed_by=?,reviewed_at=?,internal_note=?,user_note=?,reserved_vehicle_count=?,updated_at=? WHERE id=?`).run(adminId, t, body.internalNote || null, body.userNote || null, vehicleCount, t, id);
        db.prepare(`INSERT INTO order_quotes (id,order_id,base_fee_cents,distance_fee_cents,vehicle_fee_cents,service_fee_cents,discount_cents,total_cents,distance_meters,expires_at,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(randomUUID(), id, body.baseFeeCents, body.distanceFeeCents, body.vehicleFeeCents, body.serviceFeeCents, body.discountCents, total, body.distanceMeters, expires.toISOString(), adminId, t);
        this.insertOrderLogs(db, adminId, id, 'pending_review', 'pending_payment', 'order.approve', { ...body, vehicleCount, totalCents: total }, t);
        this.insertSqliteNotification('vehicle_reserved', '订单已预占无人车', `${order.order_no} 已预占 ${vehicleCount} 辆 ${order.vehicle_id}`, `/orders/${id}`, t);
      } else throw new BadRequestException('decision 必须为 approve 或 reject');
    });
    execute();
    return this.orderDetail(id, 'super_admin');
  }

  transitionOrder(adminId: string, id: string, body: any) {
    const target = String(body.status || '');
    const allowed: Record<string, string> = { paid: 'dispatching', dispatching: 'delivering', delivering: 'completed' };
    const db = this.sqlite();
    db.transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id=?').get(id) as any;
      if (!order) throw new NotFoundException('订单不存在');
      if (allowed[order.status] !== target) throw new ConflictException('当前订单状态不能执行该操作');
      const note = String(body.note || '').trim();
      const proofUrl = String(body.proofUrl || '').trim();
      const vehicleCount = Math.min(99, Math.max(0, Number(body.vehicleCount) || 0));
      const vehiclePlate = String(body.vehiclePlate || '').trim().slice(0, 32);
      if (target === 'dispatching' && (!Number.isInteger(Number(body.vehicleCount)) || vehicleCount < 1)) throw new BadRequestException('派车数量必须为正整数');
      if (target === 'completed' && !note) throw new BadRequestException('完成订单必须填写完成说明');
      const t = now();
      db.prepare(`UPDATE orders SET status=?,dispatch_note=CASE WHEN ?='dispatching' THEN ? ELSE dispatch_note END,dispatch_vehicle_count=CASE WHEN ?='dispatching' THEN ? ELSE dispatch_vehicle_count END,vehicle_plate=CASE WHEN ?='dispatching' THEN ? ELSE vehicle_plate END,completion_note=CASE WHEN ?='completed' THEN ? ELSE completion_note END,completion_proof_url=CASE WHEN ?='completed' THEN ? ELSE completion_proof_url END,reserved_vehicle_count=CASE WHEN ?='completed' THEN 0 ELSE reserved_vehicle_count END,updated_at=? WHERE id=?`).run(target, target, note || null, target, vehicleCount, target, vehiclePlate || null, target, note || null, target, proofUrl || null, target, t, id);
      db.prepare('INSERT INTO order_status_logs VALUES (?,?,?,?,?,?,?,?)').run(randomUUID(), id, order.status, target, 'admin', adminId, note || `管理员更新为 ${target}`, t);
      this.audit(adminId, `order.${target}`, 'order', id, { note, proofUrl, vehicleCount, vehiclePlate });
      this.insertSqliteNotification('order_status', '订单状态已更新', `${order.order_no} 已更新为 ${target}`, `/orders/${id}`, t);
    })();
    return this.orderDetail(id, 'super_admin');
  }

  listNotifications(adminId: string, query: any) {
    const page = Math.max(1, Number(query.page) || 1), pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const unreadOnly = String(query.unreadOnly || '') === 'true';
    const db = this.sqlite(), args: unknown[] = [adminId], unread = unreadOnly ? 'AND read_at IS NULL' : '';
    const total = Number((db.prepare(`SELECT count(*) total FROM admin_notifications WHERE (admin_user_id IS NULL OR admin_user_id=?) ${unread}`).get(...args) as any).total);
    const items = db.prepare(`SELECT id,type,title,content,target_path targetPath,read_at readAt,created_at createdAt FROM admin_notifications WHERE (admin_user_id IS NULL OR admin_user_id=?) ${unread} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(adminId, pageSize, (page - 1) * pageSize) as Array<{ id: string; type: string; title: string; content: string; targetPath: string | null; readAt: string | null; createdAt: string }>;
    const unreadCount = Number((db.prepare('SELECT count(*) total FROM admin_notifications WHERE (admin_user_id IS NULL OR admin_user_id=?) AND read_at IS NULL').get(adminId) as any).total);
    return { items, total, unreadCount, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  markNotificationRead(adminId: string, id: string) {
    const result = this.sqlite().prepare('UPDATE admin_notifications SET read_at=? WHERE id=? AND (admin_user_id IS NULL OR admin_user_id=?)').run(now(), id, adminId);
    if (!result.changes) throw new NotFoundException('通知不存在');
  }

  markAllNotificationsRead(adminId: string) {
    this.sqlite().prepare('UPDATE admin_notifications SET read_at=? WHERE read_at IS NULL AND (admin_user_id IS NULL OR admin_user_id=?)').run(now(), adminId);
  }

  listWechatUsers(query: any) {
    const page = Math.max(1, Number(query.page) || 1), pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20)), keyword = String(query.keyword || '').slice(0, 80);
    const db = this.sqlite(), filter = keyword ? 'WHERE u.nickname LIKE ? OR u.id LIKE ?' : '', args = keyword ? [`%${keyword}%`, `%${keyword}%`] : [];
    const total = Number((db.prepare(`SELECT count(*) total FROM users u ${filter}`).get(...args) as any).total);
    const rows = db.prepare(`SELECT u.*,b.id binding_id,a.role,a.status admin_status FROM users u LEFT JOIN admin_wechat_bindings b ON b.user_id=u.id AND b.revoked_at IS NULL LEFT JOIN admin_users a ON a.id=b.admin_user_id ${filter} ORDER BY u.updated_at DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize) as any[];
    const items = rows.map(v => ({ id: v.id, nickname: v.nickname, openid: v.openid ? `${v.openid.slice(0, 6)}***${v.openid.slice(-4)}` : null, status: v.status, lastLoginAt: v.updated_at, bindingId: v.binding_id, role: v.role, adminStatus: v.admin_status }));
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  createBinding(grantedBy: string, userId: string, role: string) {
    if (!['super_admin','operator'].includes(role)) throw new BadRequestException('管理员角色无效');
    const db = this.sqlite(), user = db.prepare(`SELECT id FROM users WHERE id=? AND status='active'`).get(userId);
    if (!user) throw new BadRequestException('用户不存在或已停用');
    const active = db.prepare('SELECT id FROM admin_wechat_bindings WHERE user_id=? AND revoked_at IS NULL').get(userId);
    if (active) throw new ConflictException('该用户已经获得管理员授权');
    const t = now(), username = `wx_${userId.slice(0, 20)}`, existingAdmin = db.prepare('SELECT id FROM admin_users WHERE username=?').get(username) as any, adminId = existingAdmin?.id || randomUUID(), previousBinding = db.prepare('SELECT id FROM admin_wechat_bindings WHERE user_id=? ORDER BY created_at DESC LIMIT 1').get(userId) as any;
    db.transaction(() => {
      if (existingAdmin) db.prepare(`UPDATE admin_users SET role=?,status='active',updated_at=? WHERE id=?`).run(role, t, adminId);
      else db.prepare(`INSERT INTO admin_users (id,username,password_hash,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`).run(adminId, username, '', role, 'active', t, t);
      if (previousBinding) db.prepare(`UPDATE admin_wechat_bindings SET admin_user_id=?,granted_by=?,updated_at=?,revoked_at=NULL WHERE id=?`).run(adminId, grantedBy, t, previousBinding.id);
      else db.prepare(`INSERT INTO admin_wechat_bindings (id,admin_user_id,user_id,granted_by,created_at,updated_at) VALUES (?,?,?,?,?,?)`).run(randomUUID(), adminId, userId, grantedBy, t, t);
    })();
  }

  updateBinding(id: string, role: string, status = 'active') {
    if (!['super_admin','operator'].includes(role) || !['active','disabled'].includes(status)) throw new BadRequestException('角色或状态无效');
    const db = this.sqlite(), binding = db.prepare('SELECT admin_user_id FROM admin_wechat_bindings WHERE id=? AND revoked_at IS NULL').get(id) as any;
    if (!binding) throw new NotFoundException('授权不存在');
    db.prepare('UPDATE admin_users SET role=?,status=?,updated_at=? WHERE id=?').run(role, status, now(), binding.admin_user_id);
  }

  revokeBinding(id: string) { this.sqlite().prepare('UPDATE admin_wechat_bindings SET revoked_at=?,updated_at=? WHERE id=?').run(now(), now(), id); }

  listVehicles(serviceMode?: string) {
    const db = this.sqlite(), rows = (serviceMode ? db.prepare('SELECT * FROM vehicle_catalog WHERE service_mode=? ORDER BY sort_order,id').all(serviceMode) : db.prepare('SELECT * FROM vehicle_catalog ORDER BY sort_order,id').all()) as any[];
    const activePlaceholders = ACTIVE_RESERVATION_STATUSES.map(() => '?').join(',');
    return rows.map(v => {
      const reservedCount = Number((db.prepare(`SELECT coalesce(sum(reserved_vehicle_count),0) total FROM orders WHERE vehicle_id=? AND status IN (${activePlaceholders})`).get(v.id, ...ACTIVE_RESERVATION_STATUSES) as any).total);
      const totalCount = Math.max(0, Number(v.total_count) || 0);
      const imageItems = (db.prepare('SELECT id,url,object_key,is_primary,sort_order FROM vehicle_images WHERE vehicle_id=? ORDER BY is_primary DESC,sort_order,id').all(v.id) as Array<{ id: string; url: string; object_key: string; is_primary: number; sort_order: number }>).map(image => ({ id: image.id, url: image.url, objectKey: image.object_key, isPrimary: asBoolean(image.is_primary), sortOrder: image.sort_order }));
      return { id: v.id, name: v.name, fullName: v.full_name, subtitle: v.subtitle, description: v.description, specs: parseJson(v.specs_json, {}), applicableScenes: parseJson(v.scenes_json, []), restrictions: parseJson(v.restrictions_json, []), supportedModes: parseJson(v.modes_json, []), serviceMode: v.service_mode, pricingDescription: parseJson(v.pricing_hint_json, {}), tags: parseJson(v.tags_json, []), enabled: asBoolean(v.enabled), requiresApproval: asBoolean(v.requires_approval), sortOrder: v.sort_order, totalCount, reservedCount, availableCount: totalCount - reservedCount, images: imageItems.map(image => image.url), imageItems };
    });
  }

  saveVehicle(adminId: string, id: string, body: any) {
    if (!id || !body.name || !body.fullName) throw new BadRequestException('车型名称不能为空');
    const db = this.sqlite(), t = now(), exists = !!db.prepare('SELECT id FROM vehicle_catalog WHERE id=?').get(id);
    const values = { id, name: body.name, full_name: body.fullName, subtitle: body.subtitle || '', description: body.description || '', specs_json: JSON.stringify(body.specs || {}), scenes_json: JSON.stringify(body.applicableScenes || []), restrictions_json: JSON.stringify(body.restrictions || []), modes_json: JSON.stringify(body.supportedModes || ['single']), service_mode: body.serviceMode || 'single', pricing_hint_json: JSON.stringify(body.pricingDescription || {}), tags_json: JSON.stringify(body.tags || []), enabled: body.enabled === false ? 0 : 1, requires_approval: body.requiresApproval ? 1 : 0, sort_order: Number(body.sortOrder) || 0, total_count: Math.max(0, Math.floor(Number(body.totalCount) || 0)), created_at: t, updated_at: t };
    const syncModes = normalizeSyncModes(body.syncModes).filter(mode => mode !== values.service_mode);
    const upsert = db.prepare(`INSERT INTO vehicle_catalog (id,name,full_name,subtitle,description,specs_json,scenes_json,restrictions_json,modes_json,service_mode,pricing_hint_json,tags_json,enabled,requires_approval,sort_order,total_count,created_at,updated_at) VALUES (@id,@name,@full_name,@subtitle,@description,@specs_json,@scenes_json,@restrictions_json,@modes_json,@service_mode,@pricing_hint_json,@tags_json,@enabled,@requires_approval,@sort_order,@total_count,@created_at,@updated_at) ON CONFLICT(id) DO UPDATE SET name=excluded.name,full_name=excluded.full_name,subtitle=excluded.subtitle,description=excluded.description,specs_json=excluded.specs_json,scenes_json=excluded.scenes_json,restrictions_json=excluded.restrictions_json,modes_json=excluded.modes_json,service_mode=excluded.service_mode,pricing_hint_json=excluded.pricing_hint_json,tags_json=excluded.tags_json,enabled=excluded.enabled,requires_approval=excluded.requires_approval,sort_order=excluded.sort_order,total_count=excluded.total_count,updated_at=excluded.updated_at`);
    db.transaction(() => {
      upsert.run(values);
      const sourceImages = db.prepare('SELECT url,object_key,is_primary,sort_order,created_at FROM vehicle_images WHERE vehicle_id=? ORDER BY is_primary DESC,sort_order').all(id) as Array<{ url: string; object_key: string; is_primary: number; sort_order: number; created_at: string }>;
      for (const mode of syncModes) {
        const targetId = syncedVehicleId(id, mode);
        upsert.run({ ...values, id: targetId, modes_json: JSON.stringify([mode]), service_mode: mode });
        db.prepare('DELETE FROM vehicle_images WHERE vehicle_id=?').run(targetId);
        const insertImage = db.prepare('INSERT INTO vehicle_images (id,vehicle_id,url,object_key,is_primary,sort_order,created_at) VALUES (?,?,?,?,?,?,?)');
        for (const image of sourceImages) insertImage.run(randomUUID(), targetId, image.url, image.object_key, image.is_primary, image.sort_order, image.created_at || t);
      }
      this.audit(adminId, exists ? 'vehicle.update' : 'vehicle.create', 'vehicle', id, { name: body.name, syncModes });
    })();
    return this.listVehicles().find(v => v.id === id);
  }

  deleteVehicle(adminId: string, id: string) {
    const db = this.sqlite();
    if (db.prepare('SELECT id FROM orders WHERE vehicle_id=? LIMIT 1').get(id)) throw new ConflictException('该车型已被订单引用，不能删除；可以将其下架');
    if (!db.prepare('SELECT id FROM vehicle_catalog WHERE id=?').get(id)) throw new NotFoundException('车型不存在');
    db.transaction(() => { db.prepare('DELETE FROM vehicle_images WHERE vehicle_id=?').run(id); db.prepare('DELETE FROM vehicle_catalog WHERE id=?').run(id); this.audit(adminId, 'vehicle.delete', 'vehicle', id, {}); })();
  }

  addVehicleImage() { throw new ServiceUnavailableException({ code: 'LOCAL_UPLOAD_DISABLED', message: '本地 SQLite 模式不保存图片，请在线上 TOS 环境联调' }); }

  deleteVehicleImage(adminId: string, vehicleId: string, imageId: string) {
    const db = this.sqlite();
    const image = db.prepare('SELECT id,is_primary FROM vehicle_images WHERE id=? AND vehicle_id=?').get(imageId, vehicleId) as { id: string; is_primary: number } | undefined;
    if (!image) throw new NotFoundException('车型图片不存在');
    db.transaction(() => {
      db.prepare('DELETE FROM vehicle_images WHERE id=? AND vehicle_id=?').run(imageId, vehicleId);
      if (asBoolean(image.is_primary)) db.prepare('UPDATE vehicle_images SET is_primary=1 WHERE id=(SELECT id FROM vehicle_images WHERE vehicle_id=? ORDER BY sort_order,id LIMIT 1)').run(vehicleId);
      this.audit(adminId, 'vehicle.image.delete', 'vehicle', vehicleId, { imageId });
    })();
  }

  listBanners() { return (this.sqlite().prepare('SELECT * FROM content_banners ORDER BY sort_order,id').all() as any[]).map(v => ({ id: v.id, imageUrl: v.image_url, objectKey: v.object_key, title: v.title, linkType: v.link_type, linkTarget: v.link_target, sortOrder: v.sort_order, enabled: asBoolean(v.enabled) })); }

  saveBanner(adminId: string, id: string, body: any) {
    const t = now();
    this.sqlite().prepare(`INSERT INTO content_banners (id,image_url,object_key,title,link_type,link_target,sort_order,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET image_url=excluded.image_url,object_key=excluded.object_key,title=excluded.title,link_type=excluded.link_type,link_target=excluded.link_target,sort_order=excluded.sort_order,enabled=excluded.enabled,updated_at=excluded.updated_at`).run(id, body.imageUrl || '', body.objectKey || '', body.title || '', body.linkType || 'vehicle', body.linkTarget || '', Number(body.sortOrder) || 0, body.enabled === false ? 0 : 1, t, t);
    this.audit(adminId, 'banner.save', 'banner', id, {});
    return this.listBanners().find(v => v.id === id);
  }

  pricing() {
    const db = this.sqlite(), map = (v: any) => v ? { ...v, config: parseJson(v.config_json, {}) } : null;
    return { draft: map(db.prepare(`SELECT * FROM pricing_rule_versions WHERE status='draft' ORDER BY version DESC LIMIT 1`).get()), published: map(db.prepare(`SELECT * FROM pricing_rule_versions WHERE status='published' ORDER BY version DESC LIMIT 1`).get()), defaults: DEFAULT_PRICING };
  }

  saveDraft(adminId: string, config: any, expectedVersion?: number) {
    this.validatePricing(config); const db = this.sqlite(), current = db.prepare(`SELECT * FROM pricing_rule_versions WHERE status='draft' ORDER BY version DESC LIMIT 1`).get() as any, t = now();
    if (current) { if (expectedVersion !== undefined && Number(expectedVersion) !== current.version) throw new ConflictException('计费草稿已被其他管理员修改'); db.prepare('UPDATE pricing_rule_versions SET config_json=?,updated_at=? WHERE id=?').run(JSON.stringify(config), t, current.id); }
    else { const version = Number((db.prepare('SELECT max(version) version FROM pricing_rule_versions').get() as any).version || 0) + 1; db.prepare(`INSERT INTO pricing_rule_versions (id,version,status,config_json,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`).run(randomUUID(), version, 'draft', JSON.stringify(config), adminId, t, t); }
    return this.pricing();
  }

  publish(adminId: string, expectedVersion: number) {
    const db = this.sqlite(), draft = db.prepare(`SELECT * FROM pricing_rule_versions WHERE status='draft' ORDER BY version DESC LIMIT 1`).get() as any;
    if (!draft || draft.version !== Number(expectedVersion)) throw new ConflictException('计费草稿已变化，请刷新');
    const t = now(); db.transaction(() => { db.prepare(`UPDATE pricing_rule_versions SET status='archived',updated_at=? WHERE status='published'`).run(t); db.prepare(`UPDATE pricing_rule_versions SET status='published',published_by=?,published_at=?,updated_at=? WHERE id=?`).run(adminId, t, t, draft.id); })();
    return this.pricing();
  }

  preview(input: any, useDraft = false) {
    const state = this.pricing(), c: any = (useDraft ? state.draft?.config : state.published?.config) || DEFAULT_PRICING;
    const distance = Math.max(0, Number(input.distanceMeters) || 0), weight = Math.max(0, Number(input.weightKg) || 0);
    const distanceFee = Math.round(Math.max(0, distance - c.baseDistanceMeters) / 1000 * c.distanceFeePerKmCents), vehicleFee = Number(c.vehicleFeesCents?.[input.vehicleId] || 0), cold = input.coldChain ? c.coldChainFeeCents : 0, over = Math.round(Math.max(0, weight - c.overweightThresholdKg) * c.overweightFeePerKgCents), night = input.night ? c.nightFeeCents : 0, remote = input.remote ? c.remoteAreaFeeCents : 0;
    return { ruleVersion: null, baseFeeCents: c.baseFeeCents, distanceFeeCents: distanceFee, vehicleFeeCents: vehicleFee, serviceFeeCents: cold + over + night + remote, discountCents: 0, totalCents: c.baseFeeCents + distanceFee + vehicleFee + cold + over + night + remote, distanceMeters: distance, validityHours: c.defaultQuoteValidityHours, expiresAt: new Date(Date.now() + c.defaultQuoteValidityHours * 3600000).toISOString() };
  }

  listInquiries(page = 1, pageSize = 20, type?: string, status?: string) {
    const where: string[] = [], args: any[] = []; if (type) { where.push('type=?'); args.push(type); } if (status) { where.push('status=?'); args.push(status); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '', db = this.sqlite(), total = Number((db.prepare(`SELECT count(*) total FROM inquiries ${clause}`).get(...args) as any).total);
    const rows = db.prepare(`SELECT * FROM inquiries ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize) as any[];
    const items = rows.map(r => ({ id: r.id, type: r.type, vehicleId: r.vehicle_id, senderAddress: parseJson(r.sender_address, null), receiverAddress: parseJson(r.receiver_address, null), cargoType: r.cargo_type, deliveryCycle: r.delivery_cycle, monthlyTrips: r.monthly_trips, contactName: r.contact_name, phone: r.phone, companyName: r.company_name, consultContent: r.consult_content, status: r.status, note: r.note, createdAt: r.created_at, updatedAt: r.updated_at }));
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  updateInquiry(adminId: string, id: string, body: any) {
    if (!['pending','contacted','closed'].includes(body.status)) throw new BadRequestException('咨询状态无效');
    if (!this.sqlite().prepare('SELECT id FROM inquiries WHERE id=?').get(id)) throw new NotFoundException('咨询不存在');
    this.sqlite().prepare('UPDATE inquiries SET status=?,note=?,updated_at=? WHERE id=?').run(body.status, body.note || null, now(), id); this.audit(adminId, 'inquiry.update', 'inquiry', id, body); return { success: true };
  }

  getContact() { const row = this.sqlite().prepare('SELECT * FROM contact_settings LIMIT 1').get() as any; return row ? { phone: row.phone, wechat: row.wechat, email: row.email, workTime: row.work_time, extraText: row.extra_text } : null; }
  saveContact(adminId: string, body: any) { const db = this.sqlite(), current = db.prepare('SELECT id FROM contact_settings LIMIT 1').get() as any, id = current?.id || randomUUID(); db.prepare(`INSERT INTO contact_settings (id,phone,wechat,email,work_time,extra_text,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET phone=excluded.phone,wechat=excluded.wechat,email=excluded.email,work_time=excluded.work_time,extra_text=excluded.extra_text,updated_at=excluded.updated_at`).run(id, body.phone || '', body.wechat || '', body.email || '', body.workTime || '', body.extraText || '', now()); this.audit(adminId, 'contact.update', 'contact', id, body); return this.getContact(); }

  private sqlite() { if (!this.db) throw new Error('SQLite admin database is not active'); return this.db; }

  private resolveDbPath() {
    if (process.env.ADMIN_SQLITE_DB_PATH) return resolve(process.env.ADMIN_SQLITE_DB_PATH);
    const root = existsSync(resolve(process.cwd(), 'server')) ? resolve(process.cwd(), 'server') : process.cwd();
    return resolve(root, 'data/admin-local.sqlite');
  }

  private migrate() {
    this.sqlite().exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,openid TEXT UNIQUE,nickname TEXT NOT NULL DEFAULT '',avatar_url TEXT,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS admin_users (id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,nickname TEXT NOT NULL DEFAULT '',password_hash TEXT NOT NULL,role TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS admin_sessions (id TEXT PRIMARY KEY,admin_user_id TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,revoked_at TEXT,created_at TEXT NOT NULL,FOREIGN KEY(admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS admin_wechat_bindings (id TEXT PRIMARY KEY,admin_user_id TEXT NOT NULL,user_id TEXT NOT NULL,granted_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,revoked_at TEXT,FOREIGN KEY(admin_user_id) REFERENCES admin_users(id),FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(granted_by) REFERENCES admin_users(id));
      CREATE UNIQUE INDEX IF NOT EXISTS admin_wechat_user_active ON admin_wechat_bindings(user_id) WHERE revoked_at IS NULL;
      CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY,order_no TEXT NOT NULL UNIQUE,user_id TEXT NOT NULL,vehicle_id TEXT NOT NULL,mode TEXT NOT NULL DEFAULT 'single',status TEXT NOT NULL,pickup_type TEXT NOT NULL,scheduled_at TEXT,scheduled_end_at TEXT,customer_remark TEXT,reviewed_by TEXT,reviewed_at TEXT,rejection_reason TEXT,internal_note TEXT,user_note TEXT,idempotency_key TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS order_addresses (id TEXT PRIMARY KEY,order_id TEXT NOT NULL,role TEXT NOT NULL,contact_name TEXT NOT NULL,phone TEXT NOT NULL,province TEXT NOT NULL,city TEXT NOT NULL,district TEXT NOT NULL,poi_name TEXT NOT NULL,formatted_address TEXT NOT NULL,detail_address TEXT NOT NULL,longitude REAL NOT NULL,latitude REAL NOT NULL,FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY,order_id TEXT NOT NULL,category TEXT NOT NULL,name TEXT NOT NULL,quantity INTEGER NOT NULL,estimated_weight_kg REAL NOT NULL,length_mm INTEGER,width_mm INTEGER,height_mm INTEGER,fragile INTEGER NOT NULL DEFAULT 0,oversized INTEGER NOT NULL DEFAULT 0,need_carry INTEGER NOT NULL DEFAULT 0,remark TEXT,FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS order_quotes (id TEXT PRIMARY KEY,order_id TEXT NOT NULL,base_fee_cents INTEGER NOT NULL,distance_fee_cents INTEGER NOT NULL,vehicle_fee_cents INTEGER NOT NULL,service_fee_cents INTEGER NOT NULL,discount_cents INTEGER NOT NULL,total_cents INTEGER NOT NULL,distance_meters INTEGER NOT NULL,expires_at TEXT,created_by TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS order_status_logs (id TEXT PRIMARY KEY,order_id TEXT NOT NULL,from_status TEXT,to_status TEXT NOT NULL,operator_type TEXT NOT NULL,operator_id TEXT NOT NULL,remark TEXT,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY,admin_user_id TEXT NOT NULL,action TEXT NOT NULL,target_type TEXT NOT NULL,target_id TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS vehicle_catalog (id TEXT PRIMARY KEY,name TEXT NOT NULL,full_name TEXT NOT NULL,subtitle TEXT NOT NULL,description TEXT NOT NULL,specs_json TEXT NOT NULL,scenes_json TEXT NOT NULL,restrictions_json TEXT NOT NULL,modes_json TEXT NOT NULL,service_mode TEXT NOT NULL,pricing_hint_json TEXT NOT NULL,tags_json TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,requires_approval INTEGER NOT NULL DEFAULT 0,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS vehicle_images (id TEXT PRIMARY KEY,vehicle_id TEXT NOT NULL,url TEXT NOT NULL,object_key TEXT NOT NULL,is_primary INTEGER NOT NULL DEFAULT 0,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,FOREIGN KEY(vehicle_id) REFERENCES vehicle_catalog(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS content_banners (id TEXT PRIMARY KEY,image_url TEXT NOT NULL,object_key TEXT NOT NULL,title TEXT NOT NULL,link_type TEXT NOT NULL,link_target TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0,enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS pricing_rule_versions (id TEXT PRIMARY KEY,version INTEGER NOT NULL UNIQUE,status TEXT NOT NULL,config_json TEXT NOT NULL,created_by TEXT NOT NULL,published_by TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,published_at TEXT);
      CREATE TABLE IF NOT EXISTS inquiries (id TEXT PRIMARY KEY,type TEXT NOT NULL,vehicle_id TEXT,sender_address TEXT,receiver_address TEXT,cargo_type TEXT,delivery_cycle TEXT,monthly_trips INTEGER,contact_name TEXT NOT NULL,phone TEXT NOT NULL,company_name TEXT,consult_content TEXT,status TEXT NOT NULL DEFAULT 'pending',note TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS contact_settings (id TEXT PRIMARY KEY,phone TEXT NOT NULL,wechat TEXT NOT NULL,email TEXT NOT NULL,work_time TEXT NOT NULL,extra_text TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS admin_notifications (id TEXT PRIMARY KEY,admin_user_id TEXT,type TEXT NOT NULL,title TEXT NOT NULL,content TEXT NOT NULL,target_path TEXT,read_at TEXT,created_at TEXT NOT NULL,FOREIGN KEY(admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE);
      CREATE INDEX IF NOT EXISTS admin_notifications_admin_read_idx ON admin_notifications(admin_user_id,read_at);
      CREATE INDEX IF NOT EXISTS admin_notifications_created_idx ON admin_notifications(created_at DESC);
      INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES (1,datetime('now'));
    `);
    this.ensureColumn('vehicle_catalog', 'total_count', 'INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('admin_users', 'nickname', "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn('orders', 'reserved_vehicle_count', 'INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('orders', 'dispatch_note', 'TEXT');
    this.ensureColumn('orders', 'dispatch_vehicle_count', 'INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('orders', 'vehicle_plate', 'TEXT');
    this.ensureColumn('orders', 'completion_note', 'TEXT');
    this.ensureColumn('orders', 'completion_proof_url', 'TEXT');
    this.sqlite().prepare('INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES (?,?)').run(2, now());
  }

  private normalizeLegacyRoles() {
    this.sqlite().prepare(`UPDATE admin_users SET role='operator',nickname=CASE WHEN nickname='测试财务' THEN '测试运营' ELSE nickname END,updated_at=? WHERE role='finance'`).run(now());
  }

  private seed() {
    const db = this.sqlite();
    if ((db.prepare('SELECT count(*) total FROM admin_users').get() as any).total) return;
    const t = now(), adminId = 'local-admin-000000000000000000000001';
    db.transaction(() => {
      const localUsername = process.env.LOCAL_ADMIN_USERNAME || 'wjf';
      db.prepare('INSERT INTO admin_users (id,username,nickname,password_hash,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(adminId, localUsername, localUsername, hashPassword(process.env.LOCAL_ADMIN_PASSWORD || '123'), 'super_admin', 'active', t, t);
      const users = [['local-user-001','local_openid_001','张师傅'],['local-user-002','local_openid_002','李女士'],['local-user-003','local_openid_003','测试企业']];
      for (const [id, openid, nickname] of users) db.prepare('INSERT INTO users (id,openid,nickname,status,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(id, openid, nickname, 'active', t, t);
      const wechatAdminId = 'local-wechat-admin-003';
      db.prepare('INSERT INTO admin_users (id,username,nickname,password_hash,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(wechatAdminId, 'wx_local-user-003', '测试运营', '', 'operator', 'active', t, t);
      db.prepare('INSERT INTO admin_wechat_bindings (id,admin_user_id,user_id,granted_by,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('local-binding-003', wechatAdminId, 'local-user-003', adminId, t, t);
      const vehicles = [
        { id:'z5-2026', name:'Z5', fullName:'Z5 城市配送车', mode:'single', fee:500, order:0 },
        { id:'z8-max', name:'Z8Max', fullName:'Z8Max 大型配送车', mode:'single', fee:1000, order:1 },
        { id:'z5-monthly', name:'Z5 包月', fullName:'Z5 企业包月专线', mode:'monthly', fee:0, order:2 },
        { id:'z8-rental', name:'Z8 租购', fullName:'Z8 企业租购方案', mode:'rental', fee:0, order:3 },
      ];
      for (const v of vehicles) db.prepare(`INSERT INTO vehicle_catalog (id,name,full_name,subtitle,description,specs_json,scenes_json,restrictions_json,modes_json,service_mode,pricing_hint_json,tags_json,enabled,requires_approval,sort_order,total_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(v.id,v.name,v.fullName,'本地演示车型','用于管理员端 SQLite 测试',JSON.stringify({maxLoadKg:500,maxRangeKm:120}),JSON.stringify(['城市配送']),JSON.stringify(['禁止危险品']),JSON.stringify([v.mode]),v.mode,JSON.stringify({startFrom:(2500+v.fee)/100,description:'最终价格由后台审核确认'}),JSON.stringify(['演示']),1,0,v.order,v.mode === 'single' ? 6 : 0,t,t);
      const statuses = ['pending_review','pending_review','pending_payment','rejected','paid','completed'];
      statuses.forEach((status, index) => {
        const id = `local-order-${index + 1}`, userId = users[index % users.length][0], vehicleId = vehicles[index % 2].id, created = new Date(Date.now() - index * 86400000).toISOString();
        db.prepare(`INSERT INTO orders (id,order_no,user_id,vehicle_id,status,pickup_type,scheduled_at,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id,`LOCAL${String(index+1).padStart(6,'0')}`,userId,vehicleId,status,'door',new Date(Date.now()+86400000).toISOString(),`seed-${index}`,created,created);
        db.prepare(`INSERT INTO order_addresses VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(randomUUID(),id,'sender',users[index % users.length][2],`1380000${String(index).padStart(4,'0')}`,'上海市','上海市','浦东新区','演示发货点','上海市浦东新区演示路 1 号','1 楼',121.5,31.2);
        db.prepare(`INSERT INTO order_addresses VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(randomUUID(),id,'receiver','收货联系人',`1390000${String(index).padStart(4,'0')}`,'上海市','上海市','徐汇区','演示收货点','上海市徐汇区测试路 8 号','8 楼',121.4,31.18);
        db.prepare(`INSERT INTO order_items (id,order_id,category,name,quantity,estimated_weight_kg,fragile,oversized,need_carry) VALUES (?,?,?,?,?,?,?,?,?)`).run(randomUUID(),id,'general','演示货物',2,120,0,0,1);
        if (status !== 'pending_review') db.prepare(`INSERT INTO order_status_logs VALUES (?,?,?,?,?,?,?,?)`).run(randomUUID(),id,'pending_review',status,'admin',adminId,'演示状态变更',created);
        if (status === 'pending_payment') {
          db.prepare(`UPDATE orders SET reviewed_by=?,reviewed_at=? WHERE id=?`).run(adminId, created, id);
          db.prepare(`INSERT INTO order_quotes (id,order_id,base_fee_cents,distance_fee_cents,vehicle_fee_cents,service_fee_cents,discount_cents,total_cents,distance_meters,expires_at,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(randomUUID(),id,2500,400,500,0,0,3400,4000,new Date(Date.now()+86400000).toISOString(),adminId,created);
          db.prepare(`INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?)`).run(randomUUID(),adminId,'order.approve','order',id,JSON.stringify({totalCents:3400}),created);
        }
        if (status === 'rejected') {
          db.prepare(`UPDATE orders SET reviewed_by=?,reviewed_at=?,rejection_reason=? WHERE id=?`).run(adminId, created, '演示订单信息不完整', id);
          db.prepare(`INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?)`).run(randomUUID(),adminId,'order.reject','order',id,JSON.stringify({rejectionReason:'演示订单信息不完整'}),created);
        }
      });
      db.prepare(`INSERT INTO content_banners VALUES (?,?,?,?,?,?,?,?,?,?)`).run('local-banner-1','','','SQLite 本地演示轮播','vehicle','z5-2026',0,1,t,t);
      db.prepare(`INSERT INTO pricing_rule_versions (id,version,status,config_json,created_by,published_by,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(randomUUID(),1,'published',JSON.stringify(DEFAULT_PRICING),adminId,adminId,t,t,t);
      db.prepare(`INSERT INTO inquiries VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('local-inquiry-1','monthly','z5-monthly',JSON.stringify({address:'上海浦东'}),JSON.stringify({address:'上海徐汇'}),'日用品','每周一至周五',20,'王经理','13600001111','演示企业',null,'pending',null,t,t);
      db.prepare(`INSERT INTO inquiries VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('local-inquiry-2','rental','z8-rental',null,null,null,null,null,'陈女士','13700002222','测试公司','希望了解年度租购方案','contacted','已电话沟通',t,t);
      db.prepare(`INSERT INTO contact_settings VALUES (?,?,?,?,?,?,?)`).run('local-contact','400-888-9999','tangship-service','service@example.test','工作日 9:00-18:00','本地演示数据，不代表线上配置',t);
      this.insertSqliteNotification('new_order', '有新的按趟订单待审核', '2 个按趟订单等待审核，请及时查看详情。', '/orders?status=pending_review', t);
      this.insertSqliteNotification('new_inquiry', '有新的包月咨询', '王经理提交了包月专线需求，请及时联系。', '/inquiries/monthly', t);
    })();
  }

  private seedOperationalDemo() {
    const db = this.sqlite(), timestamp = now();
    db.transaction(() => {
      db.prepare(`UPDATE vehicle_catalog SET total_count=6 WHERE id IN ('z5-2026','z8-max') AND total_count=0`).run();
      db.prepare(`UPDATE admin_users SET nickname=username WHERE nickname=''`).run();
      db.prepare(`UPDATE orders SET reserved_vehicle_count=1 WHERE status IN ('pending_payment','paid','dispatching','delivering') AND reserved_vehicle_count=0`).run();
      const notificationCount = Number((db.prepare('SELECT count(*) total FROM admin_notifications').get() as any).total);
      if (!notificationCount) {
        this.insertSqliteNotification('new_order', '有新的按趟订单待审核', '2 个按趟订单等待审核，请及时查看详情。', '/orders?status=pending_review', timestamp);
        this.insertSqliteNotification('new_inquiry', '有新的客户咨询', '包月或租购咨询等待联系。', '/inquiries/monthly', timestamp);
      }
    })();
  }

  private insertOrderLogs(db: SqliteDb, adminId: string, orderId: string, from: string, to: string, action: string, detail: any, createdAt: string) {
    db.prepare('INSERT INTO order_status_logs VALUES (?,?,?,?,?,?,?,?)').run(randomUUID(), orderId, from, to, 'admin', adminId, action === 'order.approve' ? '审核通过并报价' : String(detail.rejectionReason || '审核拒绝'), createdAt);
    db.prepare('INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?)').run(randomUUID(), adminId, action, 'order', orderId, JSON.stringify(detail), createdAt);
  }

  private ensureColumn(table: string, column: string, definition: string) {
    const columns = this.sqlite().prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some(item => item.name === column)) this.sqlite().exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  private insertSqliteNotification(type: string, title: string, content: string, targetPath: string | null, createdAt = now()) {
    this.sqlite().prepare('INSERT INTO admin_notifications (id,admin_user_id,type,title,content,target_path,created_at) VALUES (?,?,?,?,?,?,?)').run(randomUUID(), null, type, title, content, targetPath, createdAt);
  }

  private audit(adminId: string, action: string, type: string, id: string, detail: any) { this.sqlite().prepare('INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?)').run(randomUUID(), adminId, action, type, id, JSON.stringify(detail), now()); }
  private validatePricing(config: any) { const fields = ['baseDistanceMeters','baseFeeCents','distanceFeePerKmCents','coldChainFeeCents','overweightFeePerKgCents','overweightThresholdKg','nightFeeCents','remoteAreaFeeCents','defaultQuoteValidityHours']; if (fields.some(key => !Number.isFinite(Number(config?.[key])) || Number(config[key]) < 0)) throw new BadRequestException('计费规则必须为非负数'); }
}
