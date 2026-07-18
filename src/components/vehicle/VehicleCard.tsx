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
import { Truck, Weight, Snowflake } from 'lucide-react-taro'
import type { Vehicle } from '@/types/vehicle'

interface Props {
  vehicle: Vehicle
  /** 索引用于动画延迟(瀑布流逐张入场) */
  index?: number
  /** 点击回调:跳转详情页 */
  onSelect: (vehicle: Vehicle) => void
}

export const VehicleCard: FC<Props> = ({ vehicle, index = 0, onSelect }) => {
  const showPrice = vehicle.pricingDescription.startFrom !== undefined

  return (
    <Card
      className="cursor-pointer hover:translate-y-[-4px] hover:shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 overflow-hidden"
      style={{ animationDelay: `${index * 100}ms` }}
      onClick={() => onSelect(vehicle)}
    >
      <View
        className="w-full h-28 relative overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: '#2088D8' }}
      >
        {vehicle.images?.[0] ? <Image className="w-full h-full" mode="aspectFill" src={vehicle.images[0]} /> : <Text className="block text-white text-xl font-bold">{vehicle.name}</Text>}
        {vehicle.specs.temperatureRange && (
          <View className="absolute top-2 right-2">
            <Badge className="text-xs bg-cyan-500 text-white border-0 px-2 py-0">
              <Snowflake size={10} color="#fff" />
              冷藏
            </Badge>
          </View>
        )}
      </View>
      <CardContent className="p-3">
        <CardTitle className="text-sm font-semibold mb-2 truncate">
          {vehicle.fullName}
        </CardTitle>
        <View className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <Truck size={12} color="#94A3B8" />
          <Text className="block">{vehicle.specs.cargoVolume}</Text>
        </View>
        <View className="flex items-center gap-2 text-xs text-slate-500">
          <Weight size={12} color="#94A3B8" />
          <Text className="block">
            {vehicle.specs.maxLoadKg > 0
              ? `${vehicle.specs.maxLoadKg} kg`
              : '以实际车型为准'}
          </Text>
        </View>
        {showPrice && (
          <Text className="block text-sm font-medium text-blue-600 mt-2">
            ¥{vehicle.pricingDescription.startFrom}/趟起
          </Text>
        )}
      </CardContent>
    </Card>
  )
}
