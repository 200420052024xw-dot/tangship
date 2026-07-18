/**
 * 费用预览 — 不显示最终成交价
 *
 * - 仅展示价格构成说明
 * - 明确提示"最终费用将在服务端核验路线、车型、货物和时间后计算"
 * - 显示"待核价"占位
 */

import { View, Text } from '@tarojs/components'
import type { FC } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Receipt, Info } from 'lucide-react-taro'
import type { Vehicle } from '@/types/vehicle'

interface Props {
  vehicle: Vehicle | null
}

export const FeePreview: FC<Props> = ({ vehicle }) => {
  return (
    <Card className="mb-3 bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-100">
      <CardContent className="p-4">
        <View className="flex items-center justify-between mb-3">
          <View className="flex items-center gap-2">
            <Receipt size={16} color="#2088D8" />
            <Text className="block text-sm font-medium text-slate-700">费用说明</Text>
          </View>
          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
            待核价
          </Badge>
        </View>

        {vehicle?.pricingDescription?.breakdown && (
          <View className="bg-white rounded-lg p-3 mb-3">
            {vehicle.pricingDescription.breakdown.map((b, idx) => (
              <View key={idx}>
                <View className="flex items-center justify-between py-1">
                  <Text className="block text-xs text-slate-600">{b.label}</Text>
                  <Text className="block text-xs text-slate-700">
                    {typeof b.amount === 'number' ? `¥${b.amount}` : b.amount}
                  </Text>
                </View>
                {idx < vehicle.pricingDescription.breakdown!.length - 1 && <Separator />}
              </View>
            ))}
          </View>
        )}

        <View className="flex items-center justify-between">
          <Text className="block text-sm text-slate-600">本单预估</Text>
          <Text className="block text-lg font-bold text-slate-400">—</Text>
        </View>

        <View className="mt-3 bg-white rounded-lg p-3 flex items-start gap-2">
          <Info size={14} color="#94A3B8" className="mt-1 shrink-0" />
          <Text className="block text-xs text-slate-500 leading-relaxed">
            最终费用将在服务端核验路线、车型、货物和时间后计算;下单页不显示最终成交价。
          </Text>
        </View>
      </CardContent>
    </Card>
  )
}