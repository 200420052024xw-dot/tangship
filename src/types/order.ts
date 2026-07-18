/**
 * 订单草稿类型 — 唯一权威定义
 *
 * 设计原则:
 * - 只保存非敏感或低敏感字段到本地缓存,便于页面间恢复
 * - 不写入最终价格;价格由服务端基于实际路线/车型/货物/时间核验后给出
 * - 不写入 Taro/React 组件对象
 */

import type { VehicleMode } from './vehicle'
import type { Address } from './address'

export type GoodsCategory =
  | 'documents'
  | 'food'
  | 'daily'
  | 'digital'
  | 'building'
  | 'commercial'
  | 'other'

export interface GoodsCategoryOption {
  value: GoodsCategory
  label: string
}

export interface GoodsInfo {
  category: GoodsCategory
  /** 物品名称/描述 */
  name: string
  /** 数量,正整数 */
  quantity: number
  /** 预估重量 kg */
  estimatedWeightKg: number
  /** 长 mm(选填) */
  lengthMm?: number
  /** 宽 mm(选填) */
  widthMm?: number
  /** 高 mm(选填) */
  heightMm?: number
  /** 估算体积 m³(选填) */
  estimatedVolumeM3?: number
  /** 备注 */
  remark?: string
  /** 易碎 */
  fragile?: boolean
  /** 超长 */
  oversized?: boolean
  /** 需要搬运 */
  needCarry?: boolean
  /** 其他特殊要求 */
  otherRequirements?: string
}

export type PickupType = 'immediate' | 'scheduled'

export interface TimeSlot {
  /** ISO date YYYY-MM-DD */
  date: string
  /** HH:mm */
  startTime: string
  /** HH:mm */
  endTime: string
}

export interface OrderDraft {
  /** 本地草稿 id(每次创建草稿时生成) */
  draftId: string
  /** 服务模式 */
  mode: VehicleMode
  /** 选中的车型 id */
  vehicleId: string
  /** 寄件地址 */
  senderAddress: Address | null
  /** 收件地址 */
  receiverAddress: Address | null
  /** 物品信息 */
  goods: GoodsInfo | null
  /** 用车时间类型 */
  pickupType: PickupType
  /** 预约用车时段(只有 scheduled 模式有效) */
  scheduledSlot: TimeSlot | null
  /** 是否同意协议 */
  agreementAccepted: boolean
  /** 草稿最后更新时间 */
  updatedAt: number
}

/** 表单错误集合 */
export type OrderDraftErrors = Partial<
  Record<
    | 'vehicleId'
    | 'senderAddress'
    | 'receiverAddress'
    | 'goods'
    | 'pickupType'
    | 'scheduledSlot'
    | 'agreementAccepted',
    string
  >
>