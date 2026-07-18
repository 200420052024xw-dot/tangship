import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
    const result = {
      pendingReview: await count('pending_review'),
      pendingPayment: await count('pending_payment'),
      todayNew: todayNew || 0,
      rejected: await count('rejected'),
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
      const { data: reviewer } = o.reviewed_by ? await client.from('admin_users').select('username').eq('id', o.reviewed_by).maybeSingle() : { data: null };
      (enriched as any[]).push({
        ...o, orderNo: o.order_no, vehicleId: o.vehicle_id, scheduledAt: o.scheduled_at,
        contactName: sender?.contact_name, phone: mask(sender?.phone),
        senderDistrict: sender?.district, receiverDistrict: receiver?.district,
        reviewer: reviewer?.username,
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
    const { data: reviewerUser } = order.reviewed_by ? await client.from('admin_users').select('username').eq('id', order.reviewed_by).maybeSingle() : { data: null };

    const { data: addresses } = await client.from('order_addresses').select('*').eq('order_id', id).order('role');
    const { data: items } = await client.from('order_items').select('*').eq('order_id', id);
    const { data: quotes } = await client.from('order_quotes').select('*').eq('order_id', id).order('created_at', { ascending: false });
    const { data: statusLogs } = await client.from('order_status_logs').select('*').eq('order_id', id).order('created_at', { ascending: true });
    const { data: auditLogs } = await client.from('audit_logs').select('id, action, created_at, admin_user_id').eq('target_type', 'order').eq('target_id', id).order('created_at', { ascending: false });

    return {
      ...order, nickname: user?.nickname, reviewer: reviewerUser?.username,
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

    const { data: items, count: total } = await query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    return { items: items || [], total: total || 0, page, pageSize, totalPages: Math.ceil((total || 0) / pageSize) };
  }
}
