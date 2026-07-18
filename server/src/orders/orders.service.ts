import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DatabaseService } from '../database/database.service'
import { CreateOrderInput, OrderStatus, canTransition } from './orders.types'

const now = () => new Date().toISOString()
@Injectable()
export class OrdersService {
  constructor(private database: DatabaseService) {}

  private validate(data: CreateOrderInput) {
    if (!data.idempotencyKey || data.idempotencyKey.length > 100) throw new BadRequestException('缺少有效幂等键')
    const vehicle = this.database.db.prepare('SELECT enabled,modes_json modesJson,specs_json specsJson FROM vehicle_catalog WHERE id=?').get(data.vehicleId) as any
    if (!vehicle || !vehicle.enabled) throw new BadRequestException('车型不存在或已下架')
    const modes = JSON.parse(vehicle.modesJson || '[]') as string[]
    if (data.mode !== 'single' || !modes.includes(data.mode)) throw new BadRequestException('该车型不支持当前业务模式，请重新选择')
    const normalized = (address: CreateOrderInput['sender']) => [address.contactName, address.phone, address.formattedAddress, address.detailAddress, address.longitude, address.latitude].map(value => String(value).trim().toLowerCase()).join('|')
    if (normalized(data.sender) === normalized(data.receiver)) throw new BadRequestException('寄件地址与收件地址不能完全相同')
    const maxLoadKg = Number(JSON.parse(vehicle.specsJson || '{}').maxLoadKg || 0)
    const totalWeight = data.items.reduce((sum, item) => sum + item.estimatedWeightKg * item.quantity, 0)
    if (totalWeight <= 0) throw new BadRequestException('物品重量必须大于 0')
    if (maxLoadKg > 0 && totalWeight > maxLoadKg) throw new BadRequestException(`物品总重量超过所选车型最大载重 ${maxLoadKg}kg`)
    if (data.pickupType === 'scheduled') {
      const start = new Date(data.scheduledAt || ''), end = new Date(data.scheduledEndAt || '')
      if (!Number.isFinite(start.getTime()) || start.getTime() < Date.now() + 60 * 60_000) throw new BadRequestException('预约开始时间必须至少晚于当前时间 60 分钟')
      if (!Number.isFinite(end.getTime()) || end <= start) throw new BadRequestException('预约结束时间必须晚于开始时间')
    } else if (data.scheduledAt || data.scheduledEndAt) throw new BadRequestException('立即用车不能提交预约时间')
  }

  create(userId: string, data: CreateOrderInput) {
    this.validate(data)
    const existing = this.database.db.prepare('SELECT id FROM orders WHERE user_id=? AND idempotency_key=?').get(userId, data.idempotencyKey) as { id: string } | undefined
    if (existing) return this.detail(userId, existing.id)
    const id = randomUUID(), created = now(), orderNo = `DD${created.slice(0, 10).replace(/-/g, '')}${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`
    const tx = this.database.db.transaction(() => {
      this.database.db.prepare('INSERT INTO orders(id,order_no,user_id,vehicle_id,status,pickup_type,scheduled_at,scheduled_end_at,customer_remark,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id, orderNo, userId, data.vehicleId, 'pending_review', data.pickupType, data.scheduledAt ? new Date(data.scheduledAt).toISOString() : null, data.scheduledEndAt ? new Date(data.scheduledEndAt).toISOString() : null, data.customerRemark || null, data.idempotencyKey, created, created)
      const addressInsert = this.database.db.prepare('INSERT INTO order_addresses VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      for (const [role, address] of [['sender', data.sender], ['receiver', data.receiver]] as const) addressInsert.run(randomUUID(), id, role, address.contactName, address.phone, address.province || '', address.city || '', address.district || '', address.poiName || '', address.formattedAddress, address.detailAddress || '', address.longitude, address.latitude)
      const itemInsert = this.database.db.prepare('INSERT INTO order_items VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      for (const item of data.items) itemInsert.run(randomUUID(), id, item.category, item.name, item.quantity, item.estimatedWeightKg, item.lengthMm ?? null, item.widthMm ?? null, item.heightMm ?? null, item.fragile ? 1 : 0, item.oversized ? 1 : 0, item.needCarry ? 1 : 0, item.remark || null)
      this.log(id, null, 'pending_review', 'user', userId, '用户提交订车需求')
    })
    try { tx() } catch (error: any) { if (String(error?.code).includes('CONSTRAINT_UNIQUE')) { const duplicate = this.database.db.prepare('SELECT id FROM orders WHERE user_id=? AND idempotency_key=?').get(userId, data.idempotencyKey) as { id: string } | undefined; if (duplicate) return this.detail(userId, duplicate.id) } throw error }
    return this.detail(userId, id)
  }

  list(userId: string) { return this.database.db.prepare('SELECT id,order_no orderNo,vehicle_id vehicleId,status,pickup_type pickupType,scheduled_at scheduledAt,scheduled_end_at scheduledEndAt,created_at createdAt FROM orders WHERE user_id=? ORDER BY created_at DESC').all(userId) }
  detail(userId: string, id: string) { const order = this.database.db.prepare('SELECT id,order_no,user_id,vehicle_id,status,pickup_type,scheduled_at,scheduled_end_at,customer_remark,rejection_reason,user_note,created_at,updated_at FROM orders WHERE id=? AND user_id=?').get(id, userId) as any; if (!order) throw new NotFoundException('订单不存在'); return this.expand(order, false) }
  adminList(status?: string) { return status ? this.database.db.prepare('SELECT * FROM orders WHERE status=? ORDER BY created_at DESC').all(status) : this.database.db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all() }
  adminDetail(id: string) { const order = this.database.db.prepare('SELECT * FROM orders WHERE id=?').get(id) as any; if (!order) throw new NotFoundException('订单不存在'); return this.expand(order, true) }
  private expand(order: any, admin = true) { return { ...order, addresses: this.database.db.prepare('SELECT * FROM order_addresses WHERE order_id=?').all(order.id), items: this.database.db.prepare('SELECT * FROM order_items WHERE order_id=?').all(order.id), quote: this.database.db.prepare('SELECT * FROM order_quotes WHERE order_id=? ORDER BY created_at DESC LIMIT 1').get(order.id) || null, statusLogs: admin ? this.database.db.prepare('SELECT * FROM order_status_logs WHERE order_id=? ORDER BY created_at').all(order.id) : undefined } }

  cancel(userId: string, id: string) {
    const order = this.database.db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(id, userId) as any
    if (!order) throw new NotFoundException('订单不存在')
    if (!canTransition(order.status as OrderStatus, 'cancelled')) throw new ConflictException('当前状态不能取消')
    const time = now()
    this.database.db.transaction(() => { const result = this.database.db.prepare('UPDATE orders SET status=?,updated_at=? WHERE id=? AND user_id=? AND status=?').run('cancelled', time, id, userId, order.status); if (result.changes !== 1) throw new ConflictException('订单状态已变化，请刷新后重试'); this.log(id, order.status, 'cancelled', 'user', userId, '用户取消') })()
    return this.detail(userId, id)
  }

  review(adminId: string, id: string, data: any) {
    const order = this.database.db.prepare('SELECT * FROM orders WHERE id=?').get(id) as any
    if (!order) throw new NotFoundException('订单不存在')
    if (order.status !== 'pending_review') throw new ConflictException('订单已审核或状态不允许审核')
    const time = now()
    if (data.decision === 'reject') {
      if (!String(data.rejectionReason || '').trim()) throw new BadRequestException('拒绝原因不能为空')
      this.database.db.transaction(() => { const result = this.database.db.prepare("UPDATE orders SET status='rejected',reviewed_by=?,reviewed_at=?,rejection_reason=?,updated_at=? WHERE id=? AND status='pending_review'").run(adminId, time, data.rejectionReason.trim(), time, id); if (result.changes !== 1) throw new ConflictException('订单已被审核'); this.log(id, 'pending_review', 'rejected', 'admin', adminId, data.rejectionReason); this.audit(adminId, 'order.reject', id, data) })()
      return this.adminDetail(id)
    }
    if (data.decision !== 'approve') throw new BadRequestException('decision 必须是 approve 或 reject')
    const keys = ['baseFeeCents', 'distanceFeeCents', 'vehicleFeeCents', 'serviceFeeCents', 'discountCents', 'distanceMeters']
    for (const key of keys) if (!Number.isInteger(data[key]) || data[key] < 0) throw new BadRequestException(`${key} 必须是非负整数`)
    const total = data.baseFeeCents + data.distanceFeeCents + data.vehicleFeeCents + data.serviceFeeCents - data.discountCents
    if (total < 0) throw new BadRequestException('优惠不能超过费用合计')
    const expires = new Date(data.expiresAt)
    if (!Number.isFinite(expires.getTime()) || expires <= new Date()) throw new BadRequestException('报价有效期必须晚于当前时间')
    this.database.db.transaction(() => { const result = this.database.db.prepare("UPDATE orders SET status='pending_payment',reviewed_by=?,reviewed_at=?,updated_at=? WHERE id=? AND status='pending_review'").run(adminId, time, time, id); if (result.changes !== 1) throw new ConflictException('订单已被审核'); this.database.db.prepare('INSERT INTO order_quotes VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(), id, data.baseFeeCents, data.distanceFeeCents, data.vehicleFeeCents, data.serviceFeeCents, data.discountCents, total, data.distanceMeters, expires.toISOString(), adminId, time); this.log(id, 'pending_review', 'pending_payment', 'admin', adminId, '审核通过并报价'); this.audit(adminId, 'order.approve', id, { ...data, totalCents: total }) })()
    return this.adminDetail(id)
  }

  validatePayment(userId: string, id: string, amountCents: number) { const order = this.detail(userId, id) as any; if (order.status !== 'pending_payment') throw new ConflictException('订单不是待支付状态'); if (!order.quote || new Date(order.quote.expires_at) <= new Date()) { const changed = this.database.db.prepare("UPDATE orders SET status='quote_expired',updated_at=? WHERE id=? AND status='pending_payment'").run(now(), id); if (changed.changes === 1) this.log(id, 'pending_payment', 'quote_expired', 'system', 'system', '报价过期'); throw new ConflictException('报价已过期') } if (amountCents !== order.quote.total_cents) throw new ForbiddenException('支付金额必须等于有效报价'); throw new ConflictException('支付功能待接入') }
  reviewWithNotes(adminId: string, id: string, data: any) { return this.database.db.transaction(() => { const result = this.review(adminId, id, data); this.database.db.prepare('UPDATE orders SET internal_note=?,user_note=? WHERE id=?').run(String(data.internalNote || '') || null, String(data.userNote || '') || null, id); return result })() }
  private log(orderId: string, from: string | null, to: string, operatorType: string, operatorId: string, remark: string) { this.database.db.prepare('INSERT INTO order_status_logs VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(), orderId, from, to, operatorType, operatorId, remark, now()) }
  private audit(adminId: string, action: string, id: string, detail: unknown) { this.database.db.prepare('INSERT INTO audit_logs VALUES(?,?,?,?,?,?,?)').run(randomUUID(), adminId, action, 'order', id, JSON.stringify(detail), now()) }
}
