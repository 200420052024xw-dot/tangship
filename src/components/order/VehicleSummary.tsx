/**
 * 已选车型卡片 — 下单页顶部展示
 *
 * - 只读展示当前草稿中的车型
 * - 点击"更换车型"回调;外部负责导航与草稿重置
 */

import { View, Text } from '@tarojs/components'
import type { FC } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Truck, Snowflake, ChevronRight } from 'lucide-react-taro'
import type { Vehicle } from '@/types/vehicle'

interface Props {
  vehicle: Vehicle
  onChange: () => void
}

export const VehicleSummary: FC<Props> = ({ vehicle, onChange }) => {
  return (
    <Card className="mb-4 bg-blue-50 border-blue-200">
      <CardContent className="p-3">
        <View className="flex items-center gap-3">
          {/* 车型缩略图(占位) */}
          <View
            className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#2088D8' }}
          >
            <Text className="block text-white text-base font-bold">{vehicle.name}</Text>
          </View>
          <View className="flex-1 min-w-0">
            <View className="flex items-center gap-2">
              <Truck size={14} color="#2088D8" />
              <Text className="block text-sm font-medium text-slate-800 truncate">
                {vehicle.fullName}
              </Text>
              {vehicle.specs.temperatureRange && (
                <Snowflake size={12} color="#06B6D4" />
              )}
            </View>
            <Text className="block text-xs text-slate-500 mt-1">
              载重 {vehicle.specs.maxLoadKg} kg · {vehicle.specs.cargoVolume}
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