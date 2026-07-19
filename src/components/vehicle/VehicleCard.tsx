/**
 * 车型卡片 — 首页车型网格中使用的单张卡片
 *
 * - 只负责展示车型基础信息和点击跳转
 * - 价格区域仅展示起步参考价,不展示最终成交价
 * - 整个卡片作为可点击区域,触发外层传入的 onSelect 回调
 */

import { Image, View, Text } from '@tarojs/components'
import type { FC } from 'react'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Snowflake, Truck } from 'lucide-react-taro'
import type { Vehicle } from '@/types/vehicle'

interface Props {
  vehicle: Vehicle
  /** 索引用于动画延迟(瀑布流逐张入场) */
  index?: number
  /** 点击回调:跳转详情页 */
  onSelect: (vehicle: Vehicle) => void
  disabled?: boolean
}

export const VehicleCard: FC<Props> = ({ vehicle, index = 0, onSelect, disabled = false }) => {
  const showPrice = vehicle.pricingDescription.startFrom !== undefined
  const priceUnit = vehicle.serviceMode === 'monthly' ? '/月起' : vehicle.serviceMode === 'rental' ? ' 起' : '/趟起'

  return (
    <Card
      className={`cursor-pointer overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 active:opacity-90 ${disabled ? 'pointer-events-none opacity-80' : ''}`}
      style={{ animationDelay: `${index * 100}ms` }}
      onClick={() => { if (!disabled) onSelect(vehicle) }}
    >
      <CardContent className="flex p-3">
        <View className="relative mr-3 flex h-28 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
          {vehicle.images?.[0] ? <Image className="h-full w-full" mode="aspectFit" src={vehicle.images[0]} /> : (
            <View className="flex flex-col items-center gap-2"><Truck size={42} color="#2088D8" strokeWidth={1.4} /><Text className="block text-sm font-semibold text-slate-500">{vehicle.name}</Text></View>
          )}
          {vehicle.specs.temperatureRange && (
            <Badge className="absolute right-1 top-1 border-0 bg-cyan-500 px-1 py-0 text-xs text-white"><Snowflake size={9} color="#fff" />冷藏</Badge>
          )}
        </View>
        <View className="flex min-w-0 flex-1 flex-col justify-center">
          <CardTitle className="mb-2 truncate text-base font-semibold text-slate-900">{vehicle.fullName}</CardTitle>
          <Text className="block truncate text-xs text-slate-500">{vehicle.subtitle}</Text>
          <View className="mt-2 flex flex-wrap items-center gap-1">
            <Text className="block rounded bg-blue-50 px-2 py-1 text-xs text-primary">{vehicle.specs.maxLoadKg > 0 ? `${vehicle.specs.maxLoadKg}kg 载重` : '载重待确认'}</Text>
            <Text className="block rounded bg-slate-100 px-2 py-1 text-xs text-slate-500">{vehicle.specs.cargoVolume}</Text>
          </View>
          <View className="mt-2 flex items-center justify-between">
            <Text className="block text-xs text-slate-400">续航 {vehicle.specs.maxRangeKm || '—'}km</Text>
            {showPrice && <Text className="block text-sm font-semibold text-primary">¥{vehicle.pricingDescription.startFrom}{priceUnit}</Text>}
          </View>
        </View>
      </CardContent>
    </Card>
  )
}
