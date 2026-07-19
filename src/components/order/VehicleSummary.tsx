/**
 * 已选车型卡片 — 下单页顶部展示
 *
 * - 只读展示当前草稿中的车型
 * - 点击"更换车型"回调;外部负责导航与草稿重置
 */

import { Image, View, Text } from '@tarojs/components'
import type { FC } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Snowflake, ChevronRight, Truck } from 'lucide-react-taro'
import type { Vehicle } from '@/types/vehicle'

interface Props {
  vehicle: Vehicle
  onChange: () => void
}

export const VehicleSummary: FC<Props> = ({ vehicle, onChange }) => {
  return (
    <Card className="mb-3">
      <CardContent className="p-3">
        <View className="flex items-center gap-3">
          <View className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
            {vehicle.images?.[0] ? (
              <Image className="h-full w-full" mode="aspectFit" src={vehicle.images[0]} />
            ) : (
              <View className="flex flex-col items-center"><Truck size={26} color="#2088D8" /><Text className="block text-xs font-semibold text-slate-500">{vehicle.name}</Text></View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <View className="flex items-center gap-2">
              <Text className="block text-sm font-medium text-slate-800 truncate">
                {vehicle.fullName}
              </Text>
              {vehicle.specs.temperatureRange && (
                <Snowflake size={12} color="#06B6D4" />
              )}
            </View>
            <Text className="block text-xs text-slate-500 mt-2">
              载重 {vehicle.specs.maxLoadKg}kg · 容积 {vehicle.specs.cargoVolume}
            </Text>
            {vehicle.specs.temperatureRange && (
              <Text className="block text-xs text-cyan-600 mt-1">
                温控 {vehicle.specs.temperatureRange}
              </Text>
            )}
          </View>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-blue-600 shrink-0"
            onClick={onChange}
          >
            <View className="flex items-center gap-1">
              <Text className="block">更换</Text>
              <ChevronRight size={12} color="#2088D8" />
            </View>
          </Button>
        </View>
      </CardContent>
    </Card>
  )
}
