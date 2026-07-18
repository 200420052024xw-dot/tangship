/**
 * 物品类型常量
 */

import type { GoodsCategoryOption } from '@/types/order'

export const GOODS_CATEGORY_OPTIONS: GoodsCategoryOption[] = [
  { value: 'documents', label: '文件票据' },
  { value: 'food', label: '食品生鲜' },
  { value: 'daily', label: '日用品' },
  { value: 'digital', label: '数码家电' },
  { value: 'building', label: '建材五金' },
  { value: 'commercial', label: '商业货物' },
  { value: 'other', label: '其他' },
]

export const GOODS_CATEGORY_LABEL: Record<string, string> = GOODS_CATEGORY_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>
)