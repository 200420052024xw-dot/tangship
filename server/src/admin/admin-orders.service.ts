import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { serverCache, CACHE_TTL, CACHE_KEYS } from '../common/server-cache';

const STATUSES = new Set(['pending_review', 'rejected', 'pending_payment', 'quote_expired', 'paid', 'dispatching', 'delivering', 'completed', 'cancelled', 'refund_pending', 'refunded']);
const mask = (v: string) => v?.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') || '';
const STATUS_LABELS: Record<string, string> = {
  pending_review: '待审核', rejected: '已拒绝', pending_payment: '待支付', quote_expired: '报价已过期',
  paid: '已支付', dispatching: '配车中', delivering: '配送中', completed: '已完成', cancelled: '已取消',
  refund_pending: '退款中', refunded: '已退款',
};
const CATEGORY_LABELS: Record<string, string> = {
  documents: '文件票据', food: '食品生鲜', daily: '日用品', digital: '数码家电',
  building: '建材五金', commercial: '商业货物', other: '其他',
};
const TERMINAL_APPOINTMENT_STATUSES = ['rejected', 'completed', 'cancelled', 'refunded'];
const shanghaiDayBounds = (date = new Date()) => {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const start = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 8 * 60 * 60 * 1000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

@Injectable()
export class AdminOrdersService {
  constructor(private supabase: SupabaseService) {}

  private getClient() { return this.supabase.getClient(); }

  async dashboard() {
    const cached = serverCache.get<any>(CACHE_KEYS.ADMIN_DASHBOARD);
    if (cached) return cached;

    const client = this.getClient();
    const { start, end } = shanghaiDayBounds();
    const count = async (filter: string) => {
      const { count } = await client.from('orders').select('*', { count: 'exact', head: true }).eq('status', filter);
      return count || 0;
    };
    const [todayResult, recentPending, pendingReview, pendingPayment, paid, dispatching, delivering, rejected, monthlyResult, rentalResult, appointmentResult, vehicleResult, reservedResult, imageResult] = await Promise.all([
      client.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', start.toISOString()).lt('created_at', end.toISOString()),
      this.list({ status: 'pending_review', page: 1, pageSize: 5 }),
      count('pending_review'), count('pending_payment'), count('paid'), count('dispatching'), count('delivering'), count('rejected'),
      client.from('inquiries').select('*', { count: 'exact', head: true }).eq('type', 'monthly').eq('status', 'pending'),
      client.from('inquiries').select('*', { count: 'exact', head: true }).eq('type', 'rental').eq('status', 'pending'),
      client.from('orders').select('id,status,scheduled_at,scheduled_end_at').gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString()),
      client.from('vehicle_catalog').select('*').eq('service_mode', 'single').order('sort_order'),
      client.from('orders').select('vehicle_id,reserved_vehicle_count').in('status', ['pending_payment', 'paid', 'dispatching', 'delivering']),
      client.from('vehicle_images').select('vehicle_id,url,object_key,is_primary,sort_order').order('is_primary', { ascending: false }).order('sort_order'),
    ]);
    const vehicleRows = vehicleResult.data || [], reservedRows = reservedResult.data || [];
    const primaryImageByVehicle = new Map<string, string>();
    for (const image of imageResult.data || []) if (!primaryImageByVehicle.has(image.vehicle_id)) primaryImageByVehicle.set(image.vehicle_id, image.url);
    const reservedByVehicle = new Map<string, number>();
    for (const row of reservedRows || []) reservedByVehicle.set(row.vehicle_id, (reservedByVehicle.get(row.vehicle_id) || 0) + Number(row.reserved_vehicle_count || 0));
    const vehicleCapacity = vehicleRows.map(row => { let specs: Record<string, unknown> = {}; try { specs = typeof row.specs_json === 'string' ? JSON.parse(row.specs_json) : row.specs_json || {}; } catch {} const totalCount = Math.max(0, Number(row.total_count ?? specs._adminTotalCount ?? 1)), onlineReservedCount = reservedByVehicle.get(row.id) || 0, manualReservedCount = Math.max(0, Number(specs.manualReservedCount ?? 0)), reservedCount = onlineReservedCount + manualReservedCount; return { id: row.id, name: row.name, imageUrl: primaryImageByVehicle.get(row.id) || '', totalCount, onlineReservedCount, manualReservedCount, reservedCount, availableCount: Math.max(0, totalCount - reservedCount), insufficient: reservedCount > totalCount }; });
    const activeAppointments = (appointmentResult.data || []).filter(row => !TERMINAL_APPOINTMENT_STATUSES.includes(row.status));
    const dueBefore = Date.now() + 2 * 60 * 60 * 1000;
    const result = {
      pendingReview, pendingPayment, paid, dispatching, delivering,
      todayNew: todayResult.count || 0,
      rejected,
      pendingMonthly: monthlyResult.count || 0,
      pendingRental: rentalResult.count || 0,
      appointmentSummary: {
        dueSoon: activeAppointments.filter(row => new Date(row.scheduled_at).getTime() <= dueBefore).length,
        todayTotal: activeAppointments.length,
      },
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
    let query = client.from('orders').select('id, order_no, created_at, vehicle_id, pickup_type, scheduled_at, scheduled_end_at, status, reviewed_by, reserved_vehicle_count', { count: 'exact' });

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

    const orderIds = (items || []).map(order => order.id);
    const reviewerIds = [...new Set((items || []).map(order => order.reviewed_by).filter(Boolean))];
    const [{ data: addresses }, { data: reviewers }] = await Promise.all([
      orderIds.length ? client.from('order_addresses').select('order_id,role,contact_name,phone,city,district,formatted_address').in('order_id', orderIds) : Promise.resolve({ data: [] }),
      reviewerIds.length ? client.from('admin_users').select('*').in('id', reviewerIds) : Promise.resolve({ data: [] }),
    ]);
    const addressByOrder = new Map<string, { sender?: Record<string, string>; receiver?: Record<string, string> }>();
    for (const address of addresses || []) {
      const entry = addressByOrder.get(address.order_id) || {};
      entry[address.role === 'sender' ? 'sender' : 'receiver'] = address;
      addressByOrder.set(address.order_id, entry);
    }
    const reviewerById = new Map((reviewers || []).map(reviewer => [reviewer.id, reviewer.nickname || reviewer.username]));
    const enriched = (items || []).map(order => {
      const address = addressByOrder.get(order.id);
      return {
        ...order, orderNo: String(order.order_no || '').toUpperCase(), vehicleId: order.vehicle_id, scheduledAt: order.scheduled_at, scheduledEndAt: order.scheduled_end_at,
        contactName: address?.sender?.contact_name, phone: mask(address?.sender?.phone || ''),
        senderCity: address?.sender?.city, senderDistrict: address?.sender?.district,
        receiverCity: address?.receiver?.city, receiverDistrict: address?.receiver?.district,
        reviewer: order.reviewed_by ? reviewerById.get(order.reviewed_by) : undefined,
      };
    });

    return { items: enriched, total: total || 0, page, pageSize, totalPages: Math.ceil((total || 0) / pageSize) };
  }

  async appointments(q: { scope?: string; page?: string | number; pageSize?: string | number }) {
    const client = this.getClient();
    const page = Math.max(1, Number(q.page) || 1), pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));
    const scope = ['due', 'today', 'all'].includes(String(q.scope)) ? String(q.scope) : 'due';
    const now = new Date(), { start, end } = shanghaiDayBounds(now);
    let query = client.from('orders').select('id,order_no,status,vehicle_id,pickup_type,scheduled_at,scheduled_end_at,reserved_vehicle_count,created_at', { count: 'exact' }).not('scheduled_at', 'is', null).not('status', 'in', `(${TERMINAL_APPOINTMENT_STATUSES.join(',')})`);
    if (scope === 'due') query = query.lte('scheduled_at', new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString());
    if (scope === 'today') query = query.gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString());
    const { data, count, error } = await query.order('scheduled_at', { ascending: true }).range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new Error(`查询预约订单失败: ${error.message}`);
    const orderIds = (data || []).map(row => row.id);
    const { data: addresses } = orderIds.length ? await client.from('order_addresses').select('order_id,role,contact_name,phone,city,district').in('order_id', orderIds) : { data: [] };
    const senderByOrder = new Map((addresses || []).filter(row => row.role === 'sender').map(row => [row.order_id, row]));
    const receiverByOrder = new Map((addresses || []).filter(row => row.role === 'receiver').map(row => [row.order_id, row]));
    const items = (data || []).map(order => ({
      ...order,
      orderNo: String(order.order_no || '').toUpperCase(),
      vehicleId: order.vehicle_id,
      scheduledAt: order.scheduled_at,
      scheduledEndAt: order.scheduled_end_at,
      contactName: senderByOrder.get(order.id)?.contact_name,
      phone: mask(senderByOrder.get(order.id)?.phone || ''),
      senderCity: senderByOrder.get(order.id)?.city,
      senderDistrict: senderByOrder.get(order.id)?.district,
      receiverCity: receiverByOrder.get(order.id)?.city,
      receiverDistrict: receiverByOrder.get(order.id)?.district,
    }));
    return { items, total: count || 0, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) };
  }

  async detail(id: string, role: string) {
    const client = this.getClient();
    const { data: order, error } = await client.from('orders').select('*').eq('id', id).maybeSingle();
    if (error || !order) throw new NotFoundException('订单不存在');

    const pii = role === 'super_admin' || role === 'operator';
    const [userResult, reviewerResult, addressesResult, itemsResult, quotesResult, statusResult, auditResult] = await Promise.all([
      client.from('users').select('nickname').eq('id', order.user_id).maybeSingle(),
      order.reviewed_by ? client.from('admin_users').select('*').eq('id', order.reviewed_by).maybeSingle() : Promise.resolve({ data: null }),
      client.from('order_addresses').select('*').eq('order_id', id).order('role'),
      client.from('order_items').select('*').eq('order_id', id),
      client.from('order_quotes').select('*').eq('order_id', id).order('created_at', { ascending: false }),
      client.from('order_status_logs').select('*').eq('order_id', id).order('created_at', { ascending: true }),
      client.from('audit_logs').select('id, action, created_at, admin_user_id').eq('target_type', 'order').eq('target_id', id).order('created_at', { ascending: false }),
    ]);
    const addresses = addressesResult.data || [], items = itemsResult.data || [];

    return {
      ...order, nickname: userResult.data?.nickname, reviewer: reviewerResult.data?.nickname || reviewerResult.data?.username,
      addresses: (addresses || []).map((v: any) => pii ? v : { ...v, phone: mask(v.phone), detail_address: '***', longitude: null, latitude: null }),
      items: items.map(item => ({ ...item, categoryLabel: CATEGORY_LABELS[item.category] || item.category || '其他' })),
      quotes: quotesResult.data || [], statusLogs: statusResult.data || [], auditLogs: auditResult.data || [],
    };
  }

  async reviews(q: any) {
    const client = this.getClient();
    const page = Math.max(1, +q.page || 1);
    const pageSize = Math.min(100, Math.max(1, +q.pageSize || 20));
    let query = client.from('audit_logs').select('*', { count: 'exact' }).eq('target_type', 'order');
    if (q.result === 'approved') query = query.eq('action', 'order.approve');
    else if (q.result === 'rejected') query = query.eq('action', 'order.reject');

    const auditResult = await query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    if (auditResult.error || !auditResult.data?.length) {
      let reviewedQuery = client.from('orders').select('id,order_no,status,reviewed_by,reviewed_at,rejection_reason', { count: 'exact' }).not('reviewed_by', 'is', null).not('reviewed_at', 'is', null);
      if (q.result === 'approved') reviewedQuery = reviewedQuery.neq('status', 'rejected');
      else if (q.result === 'rejected') reviewedQuery = reviewedQuery.eq('status', 'rejected');
      const reviewedResult = await reviewedQuery.order('reviewed_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      if (reviewedResult.error) throw new Error(`查询审核记录失败: ${reviewedResult.error.message}`);
      const reviewedRows = reviewedResult.data || [];
      const reviewedIds = reviewedRows.map(order => order.id);
      const reviewerIds = [...new Set(reviewedRows.map(order => order.reviewed_by).filter(Boolean))];
      const [{ data: reviewers }, { data: quotes }] = await Promise.all([
        reviewerIds.length ? client.from('admin_users').select('*').in('id', reviewerIds) : Promise.resolve({ data: [] }),
        reviewedIds.length ? client.from('order_quotes').select('order_id,total_cents,created_at').in('order_id', reviewedIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
      ]);
      const reviewerById = new Map((reviewers || []).map(reviewer => [reviewer.id, reviewer.nickname || reviewer.username]));
      const quoteByOrder = new Map<string, number>();
      for (const quote of quotes || []) if (!quoteByOrder.has(quote.order_id)) quoteByOrder.set(quote.order_id, Number(quote.total_cents) || 0);
      const fallbackItems = reviewedRows.map(order => ({
        id: `review-${order.id}`, action: order.rejection_reason ? 'order.reject' : 'order.approve',
        orderId: order.id, orderNo: order.order_no, reviewer: reviewerById.get(order.reviewed_by),
        created_at: order.reviewed_at, totalCents: quoteByOrder.get(order.id), rejectionReason: order.rejection_reason,
      }));
      const fallbackTotal = reviewedResult.count || 0;
      return { items: fallbackItems, total: fallbackTotal, page, pageSize, totalPages: Math.ceil(fallbackTotal / pageSize) };
    }
    const rows = auditResult.data || [], total = auditResult.count || 0;
    const orderIds = [...new Set((rows || []).map(row => row.target_id).filter(Boolean))];
    const reviewerIds = [...new Set((rows || []).map(row => row.admin_user_id).filter(Boolean))];
    const [{ data: orders }, { data: reviewers }] = await Promise.all([
      orderIds.length ? client.from('orders').select('id,order_no,rejection_reason').in('id', orderIds) : Promise.resolve({ data: [] }),
      reviewerIds.length ? client.from('admin_users').select('*').in('id', reviewerIds) : Promise.resolve({ data: [] }),
    ]);
    const orderById = new Map((orders || []).map(order => [order.id, order]));
    const reviewerById = new Map((reviewers || []).map(reviewer => [reviewer.id, reviewer.nickname || reviewer.username]));
    const items = (rows || []).map(row => {
      const detail = (() => { try { return JSON.parse(row.detail || '{}') as Record<string, unknown>; } catch { return {}; } })();
      const order = orderById.get(row.target_id);
      return { ...row, orderId: row.target_id, orderNo: order?.order_no, reviewer: reviewerById.get(row.admin_user_id), totalCents: detail.totalCents, rejectionReason: detail.rejectionReason || order?.rejection_reason };
    });
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
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
    if (target === 'dispatching') { values.dispatch_note = note || null; values.dispatch_vehicle_count = vehicleCount; values.vehicle_plate = vehiclePlate || null; values.dispatched_at = timestamp; }
    if (target === 'completed') { values.completion_note = note; values.completion_proof_url = proofUrl; values.reserved_vehicle_count = 0; values.completed_at = timestamp; }
    console.log('[transitionOrder] update values:', JSON.stringify(values), 'id:', id, 'current status:', order.status);
    const { data: updated, error } = await client.from('orders').update(values).eq('id', id).eq('status', order.status).select().maybeSingle();
    console.log('[transitionOrder] update result:', JSON.stringify({ updated: !!updated, error: error?.message, data: updated }));
    if (error || !updated) throw new ConflictException('订单状态已变化，请刷新后重试');
    const { error: logError } = await client.from('order_status_logs').insert({ id: randomUUID(), order_id: id, from_status: order.status, to_status: target, operator_type: 'admin', operator_id: adminId, remark: note || `管理员更新为 ${target}`, created_at: timestamp });
    if (logError) throw new Error(`写入订单状态记录失败: ${logError.message}`);
    const auditRecord = { id: randomUUID(), admin_user_id: adminId, action: `order.${target}`, target_type: 'order', target_id: id, detail: JSON.stringify({ note, proofUrl, vehicleCount, vehiclePlate }), created_at: timestamp };
    const { error: auditError } = await client.from('audit_logs').insert(auditRecord);
    if (auditError && /(target_type|target_id|detail)/i.test(auditError.message)) {
      const { target_type: resource_type, target_id: resource_id, detail: detail_json, ...legacyAudit } = auditRecord;
      const { error: legacyAuditError } = await client.from('audit_logs').insert({ ...legacyAudit, resource_type, resource_id, detail_json });
      if (legacyAuditError) throw new Error(`写入审计记录失败: ${legacyAuditError.message}`);
    } else if (auditError) throw new Error(`写入审计记录失败: ${auditError.message}`);
    const statusLabel = STATUS_LABELS[target] || target;
    const notificationRecord = { id: randomUUID(), type: 'order_status', title: `${order.order_no}（${id}）订单状态已更新`, content: `订单已更新为${statusLabel}`, target_path: `/orders/${id}`, order_id: id, order_status: target, created_at: timestamp };
    const { error: notificationError } = await client.from('admin_notifications').insert(notificationRecord);
    if (notificationError && /(order_id|order_status)/i.test(notificationError.message)) {
      const { order_id: _orderId, order_status: _orderStatus, ...compatibleNotification } = notificationRecord;
      const { error: compatibleError } = await client.from('admin_notifications').insert(compatibleNotification);
      if (compatibleError) throw new Error(`写入通知失败: ${compatibleError.message}`);
    } else if (notificationError) throw new Error(`写入通知失败: ${notificationError.message}`);
    serverCache.invalidatePrefix(CACHE_KEYS.ADMIN_DASHBOARD);
    return this.detail(id, 'super_admin');
  }

  async listNotifications(adminId: string, q: any) {
    const page = Math.max(1, Number(q.page) || 1), pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));
    let query = this.getClient().from('admin_notifications').select('*', { count: 'exact' }).or(`admin_user_id.is.null,admin_user_id.eq.${adminId}`);
    if (String(q.unreadOnly || '') === 'true') query = query.is('read_at', null);
    const { data, count, error } = await query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new Error(`查询管理员通知失败: ${error.message}`);
    const orderIds = [...new Set((data || []).map(row => row.order_id || String(row.target_path || '').match(/^\/orders\/([^/]+)$/)?.[1]).filter(Boolean))];
    const [{ count: unreadCount }, { data: orders }, { data: addresses }] = await Promise.all([
      this.getClient().from('admin_notifications').select('*', { count: 'exact', head: true }).or(`admin_user_id.is.null,admin_user_id.eq.${adminId}`).is('read_at', null),
      orderIds.length ? this.getClient().from('orders').select('id,order_no,status').in('id', orderIds) : Promise.resolve({ data: [] }),
      orderIds.length ? this.getClient().from('order_addresses').select('order_id,contact_name,phone').in('order_id', orderIds).eq('role', 'sender') : Promise.resolve({ data: [] }),
    ]);
    const orderById = new Map((orders || []).map(order => [order.id, order]));
    const senderByOrder = new Map((addresses || []).map(address => [address.order_id, address]));
    const items = (data || []).map(row => {
      const orderId = row.order_id || String(row.target_path || '').match(/^\/orders\/([^/]+)$/)?.[1];
      const order = orderId ? orderById.get(orderId) : undefined;
      const sender = orderId ? senderByOrder.get(orderId) : undefined;
      const legacyStatus = String(row.content || '').match(/已更新为\s*([a-z_]+)/i)?.[1] || '';
      const status = row.order_status || legacyStatus || order?.status || '';
      const statusLabel = STATUS_LABELS[status] || status;
      const isNewOrder = row.type === 'new_order';
      return {
        id: row.id, type: row.type,
        title: order ? isNewOrder ? `${order.order_no}（${order.id}）新订单待审核` : `${order.order_no}（${order.id}）订单状态已更新` : row.title,
        content: order ? isNewOrder ? `寄件人：${sender?.contact_name || '—'}，电话：${sender?.phone || '—'}，提交了新订单，当前为${statusLabel}` : `寄件人：${sender?.contact_name || '—'}，电话：${sender?.phone || '—'}，订单已更新为${statusLabel}` : row.content,
        orderId, orderNo: order?.order_no, senderName: sender?.contact_name, senderPhone: sender?.phone,
        status, statusLabel, targetPath: row.target_path, readAt: row.read_at, createdAt: row.created_at,
      };
    });
    return { items, total: count || 0, unreadCount: unreadCount || 0, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) };
  }

  async markNotificationRead(adminId: string, id: string) {
    const client = this.getClient();
    const { data: notification, error: findError } = await client.from('admin_notifications').select('id').eq('id', id).or(`admin_user_id.is.null,admin_user_id.eq.${adminId}`).maybeSingle();
    if (findError) throw new Error(`查询通知失败: ${findError.message}`);
    if (!notification) throw new NotFoundException('通知不存在');
    const { error: updateError } = await client.from('admin_notifications').update({ read_at: new Date().toISOString() }).eq('id', notification.id);
    if (updateError) throw new Error(`更新通知失败: ${updateError.message}`);
  }

  async markAllNotificationsRead(adminId: string) {
    const client = this.getClient();
    const { data: notifications, error: findError } = await client.from('admin_notifications').select('id').or(`admin_user_id.is.null,admin_user_id.eq.${adminId}`).is('read_at', null);
    if (findError) throw new Error(`查询未读通知失败: ${findError.message}`);
    const notificationIds = (notifications || []).map(notification => notification.id);
    if (!notificationIds.length) return;
    const { error: updateError } = await client.from('admin_notifications').update({ read_at: new Date().toISOString() }).in('id', notificationIds);
    if (updateError) throw new Error(`更新通知失败: ${updateError.message}`);
  }
}
