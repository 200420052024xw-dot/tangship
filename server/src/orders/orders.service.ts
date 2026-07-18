import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateOrderInput, OrderStatus, canTransition, ORDER_MODES } from './orders.types';
import { serverCache, CACHE_TTL, CACHE_KEYS } from '../common/server-cache';

const now = () => new Date().toISOString();

@Injectable()
export class OrdersService {
  constructor(private supabase: SupabaseService) {}

  private getClient() { return this.supabase.getClient(); }

  private async validate(data: CreateOrderInput) {
    if (!data.idempotencyKey || data.idempotencyKey.length > 100) throw new BadRequestException('缺少有效幂等键');
    const { data: vehicle } = await this.getClient().from('vehicle_catalog').select('enabled, modes_json, specs_json').eq('id', data.vehicleId).maybeSingle();
    if (!vehicle || !vehicle.enabled) throw new BadRequestException('车型不存在或已下架');
    const modes = JSON.parse(vehicle.modes_json || '[]') as string[];
    if (!ORDER_MODES.includes(data.mode as any) || !modes.includes(data.mode)) throw new BadRequestException('该车型不支持当前业务模式，请重新选择');
    const normalized = (address: CreateOrderInput['sender']) =>
      [address.contactName, address.phone, address.formattedAddress, address.detailAddress, address.longitude, address.latitude].map(v => String(v).trim().toLowerCase()).join('|');
    if (normalized(data.sender) === normalized(data.receiver)) throw new BadRequestException('寄件地址与收件地址不能完全相同');
    const maxLoadKg = Number(JSON.parse(vehicle.specs_json || '{}').maxLoadKg || 0);
    const totalWeight = data.items.reduce((sum, item) => sum + item.estimatedWeightKg * item.quantity, 0);
    if (totalWeight <= 0) throw new BadRequestException('物品重量必须大于 0');
    if (maxLoadKg > 0 && totalWeight > maxLoadKg) throw new BadRequestException(`物品总重量超过所选车型最大载重 ${maxLoadKg}kg`);
    if (data.pickupType === 'scheduled') {
      const start = new Date(data.scheduledAt || ''), end = new Date(data.scheduledEndAt || '');
      if (!Number.isFinite(start.getTime()) || start.getTime() < Date.now() + 60 * 60_000) throw new BadRequestException('预约开始时间必须至少晚于当前时间 60 分钟');
      if (!Number.isFinite(end.getTime()) || end <= start) throw new BadRequestException('预约结束时间必须晚于开始时间');
    } else if (data.scheduledAt || data.scheduledEndAt) throw new BadRequestException('立即用车不能提交预约时间');
  }

  async create(userId: string, data: CreateOrderInput) {
    await this.validate(data);
    const client = this.getClient();

    // Idempotency check
    const { data: existing } = await client.from('orders').select('id').eq('user_id', userId).eq('idempotency_key', data.idempotencyKey).maybeSingle();
    if (existing) return this.detail(userId, existing.id);

    const id = randomUUID();
    const created = now();
    const orderNo = `DD${created.slice(0, 10).replace(/-/g, '')}${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;

    // Create order
    const { error: orderErr } = await client.from('orders').insert({
      id, order_no: orderNo, user_id: userId, vehicle_id: data.vehicleId,
      status: 'pending_review', pickup_type: data.pickupType,
      scheduled_at: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : null,
      scheduled_end_at: data.scheduledEndAt ? new Date(data.scheduledEndAt).toISOString() : null,
      customer_remark: data.customerRemark || null, idempotency_key: data.idempotencyKey,
      created_at: created, updated_at: created,
    });
    if (orderErr) {
      // Check idempotency again on constraint violation
      const { data: dup } = await client.from('orders').select('id').eq('user_id', userId).eq('idempotency_key', data.idempotencyKey).maybeSingle();
      if (dup) return this.detail(userId, dup.id);
      throw new Error(`创建订单失败: ${orderErr.message}`);
    }

    // Addresses
    for (const [role, address] of [['sender', data.sender], ['receiver', data.receiver]] as const) {
      const { error: addrErr } = await client.from('order_addresses').insert({
        id: randomUUID(), order_id: id, role, contact_name: address.contactName,
        phone: address.phone, province: address.province || '', city: address.city || '',
        district: address.district || '', poi_name: address.poiName || '',
        formatted_address: address.formattedAddress, detail_address: address.detailAddress || '',
        longitude: address.longitude, latitude: address.latitude,
      });
      if (addrErr) throw new Error(`创建地址失败: ${addrErr.message}`);
    }

    // Items
    for (const item of data.items) {
      const { error: itemErr } = await client.from('order_items').insert({
        id: randomUUID(), order_id: id, category: item.category, name: item.name,
        quantity: item.quantity, estimated_weight_kg: item.estimatedWeightKg,
        length_mm: item.lengthMm ?? null, width_mm: item.widthMm ?? null,
        height_mm: item.heightMm ?? null, fragile: item.fragile ? 1 : 0,
        oversized: item.oversized ? 1 : 0, need_carry: item.needCarry ? 1 : 0,
        remark: item.remark || null,
      });
      if (itemErr) throw new Error(`创建物品失败: ${itemErr.message}`);
    }

    await this.log(id, null, 'pending_review', 'user', userId, '用户提交订车需求');
    serverCache.invalidatePrefix(CACHE_KEYS.ORDERS_PREFIX);
    return this.detail(userId, id);
  }

  async list(userId: string) {
    const cacheKey = CACHE_KEYS.ORDERS_PREFIX + userId;
    const cached = serverCache.get<any[]>(cacheKey);
    if (cached) return cached;

    const client = this.getClient();
    // 1. 查订单主表（含 mode/物品摘要字段）
    const { data: orders, error } = await client.from('orders')
      .select('id, order_no, vehicle_id, mode, status, pickup_type, scheduled_at, scheduled_end_at, created_at, updated_at')
      .eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(`查询订单失败: ${error.message}`);

    if (!orders || orders.length === 0) {
      serverCache.set(cacheKey, [], CACHE_TTL.DYNAMIC);
      return [];
    }

    // 2. 批量查关联数据（地址 + 物品 + 最新报价 + 车型名称）
    const orderIds = orders.map(o => o.id);
    const vehicleIds = [...new Set(orders.map(o => o.vehicle_id))];
    const [addrRes, itemRes, quoteRes, vehicleRes] = await Promise.all([
      client.from('order_addresses').select('order_id, role, contact_name, phone, formatted_address, detail_address').in('order_id', orderIds),
      client.from('order_items').select('order_id, category, name, quantity, estimated_weight_kg').in('order_id', orderIds),
      client.from('order_quotes').select('order_id, total_fee_cents').in('order_id', orderIds).order('created_at', { ascending: false }),
      client.from('vehicle_catalog').select('id, name').in('id', vehicleIds),
    ]);

    // 3. 组装
    const addrMap = new Map<string, any[]>();
    for (const a of (addrRes.data || [])) {
      if (!addrMap.has(a.order_id)) addrMap.set(a.order_id, []);
      addrMap.get(a.order_id)!.push(a);
    }
    const itemMap = new Map<string, any[]>();
    for (const i of (itemRes.data || [])) {
      if (!itemMap.has(i.order_id)) itemMap.set(i.order_id, []);
      itemMap.get(i.order_id)!.push(i);
    }
    const quoteMap = new Map<string, any>();
    for (const q of (quoteRes.data || [])) {
      if (!quoteMap.has(q.order_id)) quoteMap.set(q.order_id, q); // 只取最新一条
    }
    const vehicleNameMap = new Map<string, string>();
    for (const v of (vehicleRes.data || [])) {
      vehicleNameMap.set(v.id, v.name);
    }

    const result = orders.map(o => ({
      ...o,
      vehicle_name: vehicleNameMap.get(o.vehicle_id) || o.vehicle_id,
      addresses: addrMap.get(o.id) || [],
      items: itemMap.get(o.id) || [],
      quote: quoteMap.get(o.id) || null,
    }));

    serverCache.set(cacheKey, result, CACHE_TTL.DYNAMIC);
    return result;
  }

  async detail(userId: string, id: string) {
    const { data: order, error } = await this.getClient().from('orders').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
    if (error || !order) throw new NotFoundException('订单不存在');
    return this.expand(order, false);
  }

  async adminList(status?: string) {
    let query = this.getClient().from('orders').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new Error(`查询订单失败: ${error.message}`);
    return data;
  }

  async adminDetail(id: string) {
    const { data: order, error } = await this.getClient().from('orders').select('*').eq('id', id).maybeSingle();
    if (error || !order) throw new NotFoundException('订单不存在');
    return this.expand(order, true);
  }

  private async expand(order: any, admin = true) {
    const client = this.getClient();
    const [addrRes, itemRes, quoteRes] = await Promise.all([
      client.from('order_addresses').select('*').eq('order_id', order.id),
      client.from('order_items').select('*').eq('order_id', order.id),
      client.from('order_quotes').select('*').eq('order_id', order.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    let statusLogs: any = undefined;
    if (admin) {
      const { data: logs } = await client.from('order_status_logs').select('*').eq('order_id', order.id).order('created_at', { ascending: true });
      statusLogs = logs;
    }
    return { ...order, addresses: (addrRes.data || []) as any, items: (itemRes.data || []) as any, quote: quoteRes.data || null, statusLogs };
  }

  async cancel(userId: string, id: string) {
    const { data: order } = await this.getClient().from('orders').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
    if (!order) throw new NotFoundException('订单不存在');
    if (!canTransition(order.status as OrderStatus, 'cancelled')) throw new ConflictException('当前状态不能取消');
    const time = now();
    const { data: updated, error } = await this.getClient().from('orders').update({ status: 'cancelled', updated_at: time }).eq('id', id).eq('user_id', userId).eq('status', order.status).select().maybeSingle();
    if (error || !updated) throw new ConflictException('订单状态已变化，请刷新后重试');
    await this.log(id, order.status, 'cancelled', 'user', userId, '用户取消');
    serverCache.invalidatePrefix(CACHE_KEYS.ORDERS_PREFIX);
    return this.detail(userId, id);
  }

  async review(adminId: string, id: string, data: any) {
    const client = this.getClient();
    const { data: order } = await client.from('orders').select('*').eq('id', id).maybeSingle();
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'pending_review') throw new ConflictException('订单已审核或状态不允许审核');
    const time = now();

    if (data.decision === 'reject') {
      if (!String(data.rejectionReason || '').trim()) throw new BadRequestException('拒绝原因不能为空');
      const { error } = await client.from('orders').update({ status: 'rejected', reviewed_by: adminId, reviewed_at: time, rejection_reason: data.rejectionReason.trim(), updated_at: time }).eq('id', id).eq('status', 'pending_review');
      if (error) throw new ConflictException('订单已被审核');
      await this.log(id, 'pending_review', 'rejected', 'admin', adminId, data.rejectionReason);
      await this.audit(adminId, 'order.reject', id, data);
      return this.adminDetail(id);
    }

    if (data.decision !== 'approve') throw new BadRequestException('decision 必须是 approve 或 reject');
    const keys = ['baseFeeCents', 'distanceFeeCents', 'vehicleFeeCents', 'serviceFeeCents', 'discountCents', 'distanceMeters'];
    for (const key of keys) if (!Number.isInteger(data[key]) || data[key] < 0) throw new BadRequestException(`${key} 必须是非负整数`);
    const total = data.baseFeeCents + data.distanceFeeCents + data.vehicleFeeCents + data.serviceFeeCents - data.discountCents;
    if (total < 0) throw new BadRequestException('优惠不能超过费用合计');
    const expires = new Date(data.expiresAt);
    if (!Number.isFinite(expires.getTime()) || expires <= new Date()) throw new BadRequestException('报价有效期必须晚于当前时间');

    const { error: updateErr } = await client.from('orders').update({ status: 'pending_payment', reviewed_by: adminId, reviewed_at: time, updated_at: time }).eq('id', id).eq('status', 'pending_review');
    if (updateErr) throw new ConflictException('订单已被审核');
    const { error: quoteErr } = await client.from('order_quotes').insert({
      id: randomUUID(), order_id: id, base_fee_cents: data.baseFeeCents,
      distance_fee_cents: data.distanceFeeCents, vehicle_fee_cents: data.vehicleFeeCents,
      service_fee_cents: data.serviceFeeCents, discount_cents: data.discountCents,
      total_cents: total, distance_meters: data.distanceMeters,
      expires_at: expires.toISOString(), created_by: adminId, created_at: time,
    });
    if (quoteErr) throw new Error(`创建报价失败: ${quoteErr.message}`);
    await this.log(id, 'pending_review', 'pending_payment', 'admin', adminId, '审核通过并报价');
    await this.audit(adminId, 'order.approve', id, { ...data, totalCents: total });
    return this.adminDetail(id);
  }

  async validatePayment(userId: string, id: string, amountCents: number) {
    const order = await this.detail(userId, id) as any;
    if (order.status !== 'pending_payment') throw new ConflictException('订单不是待支付状态');
    const client = this.getClient();

    if (!order.quote || new Date(order.quote.expires_at) <= new Date()) {
      const { data: changed } = await client.from('orders').update({ status: 'quote_expired', updated_at: now() }).eq('id', id).eq('status', 'pending_payment').select().maybeSingle();
      if (changed) await this.log(id, 'pending_payment', 'quote_expired', 'system', 'system', '报价过期');
      throw new ConflictException('报价已过期');
    }
    if (amountCents !== order.quote.total_cents) throw new ForbiddenException('支付金额必须等于有效报价');

    const time = now();
    const paymentId = randomUUID();
    const { error: payErr } = await client.from('orders').update({ status: 'paid', updated_at: time }).eq('id', id).eq('status', 'pending_payment');
    if (payErr) throw new ConflictException('订单状态已变化，请刷新后重试');
    const { error: insertErr } = await client.from('payments').insert({
      id: paymentId, order_id: id, amount_cents: amountCents,
      provider: 'mock', status: 'success', provider_tx_id: null, created_at: time, updated_at: time,
    });
    if (insertErr) throw new Error(`创建支付记录失败: ${insertErr.message}`);
    await this.log(id, 'pending_payment', 'paid', 'user', userId, '模拟支付成功');
    serverCache.invalidatePrefix(CACHE_KEYS.ORDERS_PREFIX);
    return this.detail(userId, id);
  }

  async reviewWithNotes(adminId: string, id: string, data: any) {
    const result = await this.review(adminId, id, data);
    await this.getClient().from('orders').update({
      internal_note: String(data.internalNote || '') || null,
      user_note: String(data.userNote || '') || null,
    }).eq('id', id);
    serverCache.invalidatePrefix(CACHE_KEYS.ORDERS_PREFIX);
    serverCache.invalidate(CACHE_KEYS.ADMIN_DASHBOARD);
    return result;
  }

  private async log(orderId: string, from: string | null, to: string, operatorType: string, operatorId: string, remark: string) {
    await this.getClient().from('order_status_logs').insert({
      id: randomUUID(), order_id: orderId, from_status: from, to_status: to,
      operator_type: operatorType, operator_id: operatorId, remark, created_at: now(),
    });
  }

  private async audit(adminId: string, action: string, targetId: string, detail: unknown) {
    await this.getClient().from('audit_logs').insert({
      id: randomUUID(), admin_user_id: adminId, action, target_type: 'order',
      target_id: targetId, detail: JSON.stringify(detail), created_at: now(),
    });
  }
}
