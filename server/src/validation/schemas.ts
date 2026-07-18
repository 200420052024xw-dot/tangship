import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'

const phone = z.string().trim().regex(/^1[3-9]\d{9}$/, '手机号格式不正确')
const finite = z.number().finite()
export const addressInputSchema = z.object({
  contactName: z.string().trim().min(1, '联系人不能为空').max(50),
  phone,
  province: z.string().trim().max(50).default(''), city: z.string().trim().max(50).default(''), district: z.string().trim().max(50).default(''), poiName: z.string().trim().max(100).default(''),
  formattedAddress: z.string().trim().min(3, '完整地址不能为空').max(300), detailAddress: z.string().trim().min(1, '详细门牌地址不能为空').max(200),
  longitude: finite.min(-180).max(180), latitude: finite.min(-90).max(90),
  usageType: z.enum(['sender', 'receiver', 'both']).default('both'), isDefaultSender: z.boolean().default(false), isDefaultReceiver: z.boolean().default(false),
  migrationKey: z.string().trim().min(1).max(120).optional(),
}).strict()
export const orderAddressSchema = addressInputSchema.omit({ usageType: true, isDefaultSender: true, isDefaultReceiver: true, migrationKey: true })
export const orderItemSchema = z.object({ category: z.string().trim().min(1).max(50), name: z.string().trim().min(1).max(100), quantity: z.number().int().min(1).max(10000), estimatedWeightKg: z.number().finite().positive().max(10000), lengthMm: z.number().int().positive().max(100000).optional(), widthMm: z.number().int().positive().max(100000).optional(), heightMm: z.number().int().positive().max(100000).optional(), fragile: z.boolean().optional(), oversized: z.boolean().optional(), needCarry: z.boolean().optional(), remark: z.string().trim().max(500).optional() }).strict()
export const createOrderSchema = z.object({ vehicleId: z.string().uuid().or(z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/)), mode: z.literal('single'), pickupType: z.enum(['immediate', 'scheduled']), scheduledAt: z.string().datetime({ offset: true }).optional(), scheduledEndAt: z.string().datetime({ offset: true }).optional(), customerRemark: z.string().trim().max(500).optional(), sender: orderAddressSchema, receiver: orderAddressSchema, items: z.array(orderItemSchema).min(1).max(50) }).strict()

export type AddressInputDto = z.infer<typeof addressInputSchema>
export type CreateOrderDto = z.infer<typeof createOrderSchema>
export function parseDto<T>(schema: z.ZodType<T>, value: unknown): T { const result = schema.safeParse(value); if (!result.success) throw new BadRequestException(result.error.issues[0]?.message || '请求参数不合法'); return result.data }
