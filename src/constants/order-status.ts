/**
 * 订单状态常量 - 前后端共享的唯一状态定义来源
 * 
 * 历史说明：后端曾使用 "delivering"，前端曾使用 "in_progress"
 * 已统一为 "in_progress"，此文件为唯一权威来源
 * 
 * 后端引用：server/src/orders/orders.types.ts
 * 前端引用：src/pages/orders/index.tsx
 */

/** 订单状态枚举值 */
export const ORDER_STATUS = {
  /** 待处理 */
  PENDING: 'pending',
  /** 已接单 */
  ACCEPTED: 'accepted',
  /** 配送中（原 delivering，已统一为 in_progress） */
  IN_PROGRESS: 'in_progress',
  /** 已完成 */
  COMPLETED: 'completed',
  /** 已取消 */
  CANCELLED: 'cancelled',
} as const

/** 订单状态类型 */
export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS]

/** 订单状态显示名称映射 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [ORDER_STATUS.PENDING]: '待处理',
  [ORDER_STATUS.ACCEPTED]: '已接单',
  [ORDER_STATUS.IN_PROGRESS]: '配送中',
  [ORDER_STATUS.COMPLETED]: '已完成',
  [ORDER_STATUS.CANCELLED]: '已取消',
}

/** 订单类型枚举值 */
export const ORDER_TYPE = {
  /** 按趟散单 */
  SINGLE: 'single',
  /** 包月专线 */
  MONTHLY: 'monthly',
  /** 租车购车 */
  RENTAL: 'rental',
} as const

/** 订单类型 */
export type OrderType = typeof ORDER_TYPE[keyof typeof ORDER_TYPE]

/** 订单类型显示名称映射 */
export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  [ORDER_TYPE.SINGLE]: '按趟配送',
  [ORDER_TYPE.MONTHLY]: '包月专线',
  [ORDER_TYPE.RENTAL]: '租车购车',
}
