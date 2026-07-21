import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { serverCache, CACHE_TTL, CACHE_KEYS } from '../common/server-cache';

const STATUSES = new Set(['pending_review', 'rejected', 'pending_payment', 'quote_expired', 'paid', 'dispatching', 'delivering', 'completed', 'cancelled', 'refund_pending', 'refunded']);
const mask = (v: string) => v?.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') || '';

@Injectable()
export class AdminOrdersService {
  constructor(private supabase: SupabaseService) {}

  private getClient() { return this.supabase.getClient(); }

  async dashboard() {
    const cached = serverCache.get<any>(CACHE_KEYS.ADMIN_DASHBOARD);
    if (cached) return cached;

    const client = this.getClient();
    const start = new Date(); start.setUTCHours(0, 0, 0, 0);
    const count = async (filter: string) => {
      const { count } = await client.from('orders').select('*', { count: 'exact', head: true }).eq('status', filter);
      return count || 0;
    };
    const { count: todayNew } = await client.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', start.toISOString());
    const recentPending = await this.list({ status: 'pending_review', page: 1, pageSize: 5 });
    const [{ count: pendingMonthly }, { count: pendingRental }, { count: unreadNotifications }, { data: vehicleRows }, { data: reservedRows }] = await Promise.all([
      client.from('inquiries').select('*', { count: 'exact', head: true }).eq('type', 'monthly').eq('status', 'pending'),
      client.from('inquiries').select('*', { count: 'exact', head: true }).eq('type', 'rental').eq('status', 'pending'),
      client.from('admin_notifications').select('*', { count: 'exact', head: true }).is('read_at', null),
      client.from('vehicle_catalog').select('id,name,total_count').eq('service_mode', 'single').order('sort_order'),
      client.from('orders').select('vehicle_id,reserved_vehicle_count').in('status', ['pending_payment', 'paid', 'dispatching', 'delivering']),
    ]);
    const reservedByVehicle = new Map<string, number>();
    for (const row of reservedRows || []) reservedByVehicle.set(row.vehicle_id, (reservedByVehicle.get(row.vehicle_id) || 0) + Number(row.reserved_vehicle_count || 0));
    const vehicleCapacity = (vehicleRows || []).map(row => { const totalCount = Number(row.total_count || 0), reservedCount = reservedByVehicle.get(row.id) || 0; return { id: row.id, name: row.name, totalCount, reservedCount, availableCount: totalCount - reservedCount }; });
    const result = {
      pendingReview: await count('pending_review'),
      pendingPayment: await count('pending_payment'),
      paid: await count('paid'),
      dispatching: await count('dispatching'),
      delivering: await count('delivering'),
      todayNew: todayNew || 0,
      rejected: await count('rejected'),
      pendingMonthly: pendingMonthly || 0,
      pendingRental: pendingRental || 0,
      unreadNotifications: unreadNotifications || 0,
      vehicleCapacity,
      recentPending: recentPending.items,
    };
    serverCache.set(CACHE_KEYS.ADMIN_DASHBOARD, result, CACHE_TTL.DYNAMIC);
    return result;
  }

  async list(q: any) {
    const client = this.getClient();
    const page = Math.max(1, +q.page || 1);
    const pageSize = Math.min(100, Math.max(1, +q.pageSize || 20));
    let query = client.from('orders').select('id, order_no, created_at, vehicle_id, scheduled_at, status, reviewed_by', { count: 'exact' });

    if (q.status) {
      if (!STATUSES.has(q.status)) throw new BadRequestException('状态无效');
      query = query.eq('status', q.status);
    }
    if (q.orderNo) query = query.ilike('order_no', `%${String(q.orderNo).slice(0, 50)}%`);
    if (q.dateFrom) query = query.gte('created_at', new Date(q.dateFrom).toISOString());
    if (q.dateTo) {
      const d = new Date(q.dateTo); d.setUTCHours(23, 59, 59, 999);
      query = query.lte('created_at', d.toISOString());
    }

    const { data: items, count: total, error } = await query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new Error(`查询订单失败: ${error.message}`);

    // Enrich with sender info
    const enriched = [];
    for (const o of (items || [])) {
      const { data: sender } = await client.from('order_addresses').select('contact_name, phone, district').eq('order_id', o.id).eq('role', 'sender').maybeSingle();
      const { data: receiver } = await client.from('order_addresses').select('district').eq('order_id', o.id).eq('role', 'receiver').maybeSingle();
      const { data: reviewer } = o.reviewed_by ? await client.from('admin_users').select('username,nickname').eq('id', o.reviewed_by).maybeSingle() : { data: null };
      (enriched as any[]).push({
        ...o, orderNo: o.order_no, vehicleId: o.vehicle_id, scheduledAt: o.scheduled_at,
        contactName: sender?.contact_name, phone: mask(sender?.phone),
        senderDistrict: sender?.district, receiverDistrict: receiver?.district,
        reviewer: reviewer?.nickname || reviewer?.username,
      } as any);
    }

    return { items: enriched, total: total || 0, page, pageSize, totalPages: Math.ceil((total || 0) / pageSize) };
  }

  async detail(id: string, role: string) {
    const client = this.getClient();
    const { data: order, error } = await client.from('orders').select('*').eq('id', id).maybeSingle();
    if (error || !order) throw new NotFoundException('订单不存在');

    const pii = role === 'super_admin' || role === 'operator';
    const { data: user } = await client.from('users').select('nickname').eq('id', order.user_id).maybeSingle();
    const { data: reviewerUser } = order.reviewed_by ? await client.from('admin_users').select('username,nickname').eq('id', order.reviewed_by).maybeSingle() : { data: null };

    const { data: addresses } = await client.from('order_addresses').select('*').eq('order_id', id).order('role');
    const { data: items } = await client.from('order_items').select('*').eq('order_id', id);
    const { data: quotes } = await client.from('order_quotes').select('*').eq('order_id', id).order('created_at', { ascending: false });
    const { data: statusLogs } = await client.from('order_status_logs').select('*').eq('order_id', id).order('created_at', { ascending: true });
    const { data: auditLogs } = await client.from('audit_logs').select('id, action, created_at, admin_user_id').eq('target_type', 'order').eq('target_id', id).order('created_at', { ascending: false });

    return {
      ...order, nickname: user?.nickname, reviewer: reviewerUser?.nickname || reviewerUser?.username,
      addresses: (addresses || []).map((v: any) => pii ? v : { ...v, phone: mask(v.phone), detail_address: '***', longitude: null, latitude: null }),
      items, quotes, statusLogs, auditLogs,
    };
  }

  async reviews(q: any) {
    const client = this.getClient();
    const page = Math.max(1, +q.page || 1);
    const pageSize = Math.min(100, Math.max(1, +q.pageSize || 20));
    let query = client.from('audit_logs').select('*', { count: 'exact' }).eq('target_type', 'order');
    if (q.result === 'approved') query = query.eq('action', 'order.approve');
    else if (q.result === 'rejected') query = query.eq('action', 'order.reject');

    const { data: rows, count: total } = await query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    const items = [];
    for (const row of rows || []) {
      const detail = (() => { try { return JSON.parse(row.detail || '{}'); } catch { return {}; } })();
      const [{ data: order }, { data: reviewer }] = await Promise.all([
        client.from('orders').select('order_no,rejection_reason').eq('id', row.target_id).maybeSingle(),
        client.from('admin_users').select('username,nickname').eq('id', row.admin_user_id).maybeSingle(),
      ]);
      (items as any[]).push({ ...row, orderId: row.target_id, orderNo: order?.order_no, reviewer: reviewer?.nickname || reviewer?.username, totalCents: detail.totalCents, rejectionReason: detail.rejectionReason || order?.rejection_reason });
    }
    return { items, total: total || 0, page, pageSize, totalPages: Math.ceil((total || 0) / pageSize) };
  }

  async transitionOrder(adminId: string, id: string, body: any) {
    const client = this.getClient(), target = String(body.status || '');
    const { data: order } = await client.from('orders').select('*').eq('id', id).maybeSingle();
    if (!order) throw new NotFoundException('订单不存在');
    const allowed: Record<string, string> = { paid: 'dispatching', dispatching: 'delivering', delivering: 'completed' };
    if (allowed[order.status] !== target) throw new ConflictException('当前订单状态不能执行该操作');
    const note = String(body.note || '').trim(), proofUrl = String(body.proofUrl || '').trim();
    const vehicleCount = Math.min(99, Math.max(0, Number(body.vehicleCount) || 0));
    const vehiclePlate = String(body.vehiclePlate || '').trim().slice(0, 32);
    if (target === 'dispatching' && (!Number.isInteger(Number(body.vehicleCount)) || vehicleCount < 1)) throw new BadRequestException('派车数量必须为正整数');
    if (target === 'completed' && !note) throw new BadRequestException('完成订单必须填写完成说明');
    const timestamp = new Date().toISOString();
    const values: Record<string, unknown> = { status: target, updated_at: timestamp };
    if (target === 'dispatching') { values.dispatch_note = note || null; values.dispatch_vehicle_count = vehicleCount; values.vehicle_plate = vehiclePlate || null; }
    if (target === 'completed') { values.completion_note = note; values.completion_proof_url = proofUrl; values.reserved_vehicle_count = 0; }
    const { data: updated, error } = await client.from('orders').update(values).eq('id', id).eq('status', order.status).select().maybeSingle();
    if (error || !updated) throw new ConflictException('订单状态已变化，请刷新后重试');
    const { error: logError } = await client.from('order_status_logs').insert({ id: randomUUID(), order_id: id, from_status: order.status, to_status: target, operator_type: 'admin', operator_id: adminId, remark: note || `管理员更新为 ${target}`, created_at: timestamp });
    if (logError) throw new Error(`写入订单状态记录失败: ${logError.message}`);
    await client.from('audit_logs').insert({ id: randomUUID(), admin_user_id: adminId, action: `order.${target}`, target_type: 'order', target_id: id, detail: JSON.stringify({ note, proofUrl, vehicleCount, vehiclePlate }), created_at: timestamp });
    await client.from('admin_notifications').insert({ id: randomUUID(), type: 'order_status', title: '订单状态已更新', content: `${order.order_no} 已更新为 ${target}`, target_path: `/orders/${id}`, created_at: timestamp });
    serverCache.invalidatePrefix(CACHE_KEYS.ADMIN_DASHBOARD);
    return this.detail(id, 'super_admin');
  }

  async listNotifications(adminId: string, q: any) {
    const page = Math.max(1, Number(q.page) || 1), pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));
    let query = this.getClient().from('admin_notifications').select('*', { count: 'exact' }).or(`admin_user_id.is.null,admin_user_id.eq.${adminId}`);
    if (String(q.unreadOnly || '') === 'true') query = query.is('read_at', null);
    const { data, count, error } = await query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new Error(`查询管理员通知失败: ${error.message}`);
    const { count: unreadCount } = await this.getClient().from('admin_notifications').select('*', { count: 'exact', head: true }).or(`admin_user_id.is.null,admin_user_id.eq.${adminId}`).is('read_at', null);
    const items = (data || []).map(row => ({ id: row.id, type: row.type, title: row.title, content: row.content, targetPath: row.target_path, readAt: row.read_at, createdAt: row.created_at }));
    return { items, total: count || 0, unreadCount: unreadCount || 0, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) };
  }

  async markNotificationRead(adminId: string, id: string) {
    const { data, error } = await this.getClient().from('admin_notifications').update({ read_at: new Date().toISOString() }).eq('id', id).or(`admin_user_id.is.null,admin_user_id.eq.${adminId}`).select('id').maybeSingle();
    if (error || !data) throw new NotFoundException('通知不存在');
  }

  async markAllNotificationsRead(adminId: string) {
    const { error } = await this.getClient().from('admin_notifications').update({ read_at: new Date().toISOString() }).or(`admin_user_id.is.null,admin_user_id.eq.${adminId}`).is('read_at', null);
    if (error) throw new Error(`更新通知失败: ${error.message}`);
  }
}
