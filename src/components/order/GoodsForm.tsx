/**
 * 物品信息表单 — 必填 + 选填字段
 *
 * - 物品类型、名称、数量、重量必填
 * - 长宽高、备注、易碎、超长、需要搬运、其他特殊要求选填
 * - 选择"其他"类型时要求填写物品说明
 */

import { View, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'
import type { FC } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Package, CircleAlert } from 'lucide-react-taro'
import type { GoodsInfo, GoodsCategory } from '@/types/order'
import { GOODS_CATEGORY_OPTIONS } from '@/constants/goods'
import {
  isValidPositiveInteger,
  isValidPositiveNumber,
  parseNumber,
} from '@/utils/validators'

interface Props {
  value: GoodsInfo | null
  onChange: (next: GoodsInfo) => void
  /** 超过车型载重时由外部提示 */
  overloadHint?: string | null
}

function emptyGoods(): GoodsInfo {
  return {
    category: 'documents',
    name: '',
    quantity: 1,
    estimatedWeightKg: 0,
    fragile: false,
    oversized: false,
    needCarry: false,
  }
}

export const GoodsForm: FC<Props> = ({ value, onChange, overloadHint }) => {
  const [goods, setGoods] = useState<GoodsInfo>(value || emptyGoods())

  useEffect(() => {
    if (value) setGoods(value)
  }, [value])

  const update = (patch: Partial<GoodsInfo>) => {
    const next = { ...goods, ...patch }
    setGoods(next)
    onChange(next)
  }

  const qtyError = !isValidPositiveInteger(goods.quantity)
  const weightError = !isValidPositiveNumber(goods.estimatedWeightKg)
  const nameError = !goods.name.trim()

  return (
    <Card className="mb-3">
      <CardContent className="p-4 space-y-4">
        <View className="flex items-center gap-2">
          <Package size={16} color="#F59E0B" />
          <Text className="block text-base font-semibold text-slate-800">物品信息</Text>
        </View>

        {/* 物品类型 */}
        <View>
          <Text className="block text-sm font-medium text-slate-700 mb-2">
            物品类型 <Text className="text-red-500">*</Text>
          </Text>
          <ToggleGroup
            type="single"
            value={goods.category}
            onValueChange={(v) => {
              if (v && typeof v === 'string') update({ category: v as GoodsCategory })
            }}
            className="flex-wrap gap-2"
          >
            {GOODS_CATEGORY_OPTIONS.map(opt => (
              <ToggleGroupItem
                key={opt.value}
                value={opt.value}
                className="rounded-full px-3 py-1 text-sm"
              >
                <Text className="block">{opt.label}</Text>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </View>

        {/* 物品名称 */}
        <View>
          <Text className="block text-sm font-medium text-slate-700 mb-2">
            物品名称 / 描述 <Text className="text-red-500">*</Text>
          </Text>
          <View className="bg-slate-50 rounded-lg px-3 py-1">
            <Input
              className={`w-full bg-transparent border-0 focus-within:ring-0 focus-within:border-0 ${nameError ? 'ring-1 ring-red-300' : ''}`}
              placeholder={goods.category === 'other' ? '请说明是什么物品' : '如:文件 5 份 / 苹果一箱'}
              value={goods.name}
              onInput={(e) => update({ name: e.detail.value })}
              maxlength={50}
            />
          </View>
          {nameError && (
            <Text className="block text-xs text-red-500 mt-1">请填写物品名称</Text>
          )}
          {goods.category === 'other' && !goods.name.trim() && (
            <Text className="block text-xs text-amber-600 mt-1">
              选择&quot;其他&quot;时,请说明具体是什么物品
            </Text>
          )}
        </View>

        {/* 数量 + 重量 */}
        <View className="grid grid-cols-2 gap-3">
          <View>
            <Text className="block text-sm font-medium text-slate-700 mb-2">
              数量 <Text className="text-red-500">*</Text>
            </Text>
            <View className="bg-slate-50 rounded-lg px-3 py-1 flex items-center">
              <Input
                className="flex-1 bg-transparent border-0 focus-within:ring-0 focus-within:border-0"
                type="number"
                placeholder="1"
                value={String(goods.quantity)}
                onInput={(e) => update({ quantity: parseNumber(e.detail.value) || 0 })}
              />
              <Text className="block text-xs text-slate-400 ml-1">件</Text>
            </View>
            {qtyError && (
              <Text className="block text-xs text-red-500 mt-1">数量必须为正整数</Text>
            )}
          </View>
          <View>
            <Text className="block text-sm font-medium text-slate-700 mb-2">
              预估重量 <Text className="text-red-500">*</Text>
            </Text>
            <View className="bg-slate-50 rounded-lg px-3 py-1 flex items-center">
              <Input
                className="flex-1 bg-transparent border-0 focus-within:ring-0 focus-within:border-0"
                type="number"
                placeholder="0"
                value={goods.estimatedWeightKg ? String(goods.estimatedWeightKg) : ''}
                onInput={(e) => update({ estimatedWeightKg: parseNumber(e.detail.value) || 0 })}
              />
              <Text className="block text-xs text-slate-400 ml-1">kg</Text>
            </View>
            {weightError && (
              <Text className="block text-xs text-red-500 mt-1">请填写有效重量</Text>
            )}
          </View>
        </View>

        {/* 长宽高(选填) */}
        <View>
          <Text className="block text-sm font-medium text-slate-700 mb-2">
            尺寸(选填)
          </Text>
          <View className="grid grid-cols-3 gap-2">
            <View className="bg-slate-50 rounded-lg px-3 py-1">
              <Input
                className="w-full bg-transparent border-0 text-sm"
                type="number"
                placeholder="长"
                value={goods.lengthMm ? String(goods.lengthMm) : ''}
                onInput={(e) => update({ lengthMm: parseNumber(e.detail.value) || undefined })}
              />
              <Text className="block text-xs text-slate-400 text-right">mm</Text>
            </View>
            <View className="bg-slate-50 rounded-lg px-3 py-1">
              <Input
                className="w-full bg-transparent border-0 text-sm"
                type="number"
                placeholder="宽"
                value={goods.widthMm ? String(goods.widthMm) : ''}
                onInput={(e) => update({ widthMm: parseNumber(e.detail.value) || undefined })}
              />
              <Text className="block text-xs text-slate-400 text-right">mm</Text>
            </View>
            <View className="bg-slate-50 rounded-lg px-3 py-1">
              <Input
                className="w-full bg-transparent border-0 text-sm"
                type="number"
                placeholder="高"
                value={goods.heightMm ? String(goods.heightMm) : ''}
                onInput={(e) => update({ heightMm: parseNumber(e.detail.value) || undefined })}
              />
              <Text className="block text-xs text-slate-400 text-right">mm</Text>
            </View>
          </View>
        </View>

        {/* 特殊属性开关 */}
        <View className="space-y-3">
          <View className="flex items-center justify-between">
            <Label className="text-sm text-slate-700">易碎</Label>
            <Switch
              checked={!!goods.fragile}
              onCheckedChange={(c) => update({ fragile: c })}
            />
          </View>
          <View className="flex items-center justify-between">
            <Label className="text-sm text-slate-700">超长</Label>
            <Switch
              checked={!!goods.oversized}
              onCheckedChange={(c) => update({ oversized: c })}
            />
          </View>
          <View className="flex items-center justify-between">
            <Label className="text-sm text-slate-700">需要搬运</Label>
            <Switch
              checked={!!goods.needCarry}
              onCheckedChange={(c) => update({ needCarry: c })}
            />
          </View>
        </View>

        {/* 备注 */}
        <View>
          <Text className="block text-sm font-medium text-slate-700 mb-2">备注(选填)</Text>
          <View className="bg-slate-50 rounded-lg p-2">
            <Textarea
              className="w-full bg-transparent border-0 text-sm"
              placeholder="其他特殊要求或说明(最多 200 字)"
              value={goods.remark || ''}
              onInput={(e) => update({ remark: e.detail.value })}
              maxlength={200}
              style={{ minHeight: '60px' }}
            />
          </View>
        </View>

        {/* 超载提示 */}
        {overloadHint && (
          <View className="bg-amber-50 rounded-lg p-3 flex items-start gap-2">
            <CircleAlert size={14} color="#F59E0B" className="mt-1 shrink-0" />
            <Text className="block text-xs text-amber-700 flex-1">{overloadHint}</Text>
          </View>
        )}

        {/* 禁运提示 */}
        <View className="bg-red-50 rounded-lg p-3">
          <Text className="block text-xs text-red-700 leading-relaxed">
            禁运提示:危险化学品、易燃易爆品、枪支弹药、毒品等法律法规禁止运输的物品不可下单。
            下单即视为同意相关运输协议。
          </Text>
        </View>
      </CardContent>
    </Card>
  )
}