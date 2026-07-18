/**
 * 用车时间选择
 *
 * - 立即用车 / 预约用车
 * - 预约用车:日期 + 时间段(半小时/1 小时/2 小时/自定义起止)
 * - 准备时间常量定义在常量区,UI 仅消费
 */

import { View, Text } from '@tarojs/components'
import { useEffect } from 'react'
import type { FC } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Input } from '@/components/ui/input'
import { Clock, Zap, Calendar } from 'lucide-react-taro'
import type { PickupType, TimeSlot } from '@/types/order'

/**
 * 准备时间常量 — 不在 UI 中散落魔法数字
 */
export const PREP_MINUTES = {
  immediate: 30, // 立即用车:最少 30 分钟准备
  scheduled: 60, // 预约用车:最少 60 分钟间隔
}

const TIME_SLOTS = [
  { label: '半小时内', minutes: 30 },
  { label: '1 小时内', minutes: 60 },
  { label: '2 小时内', minutes: 120 },
  { label: '4 小时内', minutes: 240 },
]

interface Props {
  pickupType: PickupType
  scheduledSlot: TimeSlot | null
  onPickupTypeChange: (type: PickupType) => void
  onScheduledSlotChange: (slot: TimeSlot | null) => void
}

function pad(n: number) { return String(n).padStart(2, '0') }

function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toHHmm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function todayDate(): string {
  return toLocalISO(new Date())
}

function nowPlusMinutes(min: number): { date: string; time: string } {
  const d = new Date(Date.now() + min * 60_000)
  return { date: toLocalISO(d), time: toHHmm(d) }
}

export const PickupTimeSelector: FC<Props> = ({
  pickupType,
  scheduledSlot,
  onPickupTypeChange,
  onScheduledSlotChange,
}) => {
  // 预约用车:初始化默认值
  useEffect(() => {
    if (pickupType !== 'scheduled') return
    if (scheduledSlot) return
    const init = nowPlusMinutes(PREP_MINUTES.scheduled)
    const end = new Date(Date.now() + (PREP_MINUTES.scheduled + 60) * 60_000)
    onScheduledSlotChange({
      date: init.date,
      startTime: init.time,
      endTime: toHHmm(end),
    })
  }, [pickupType, scheduledSlot, onScheduledSlotChange])

  const handlePickRelative = (minutes: number) => {
    const slot = nowPlusMinutes(PREP_MINUTES.scheduled)
    const end = new Date(Date.now() + (PREP_MINUTES.scheduled + minutes) * 60_000)
    onScheduledSlotChange({
      date: slot.date,
      startTime: slot.time,
      endTime: toHHmm(end),
    })
  }

  const handleDateChange = (date: string) => {
    if (!scheduledSlot) return
    onScheduledSlotChange({ ...scheduledSlot, date })
  }

  const handleStartTimeChange = (startTime: string) => {
    if (!scheduledSlot) return
    onScheduledSlotChange({ ...scheduledSlot, startTime })
  }

  const handleEndTimeChange = (endTime: string) => {
    if (!scheduledSlot) return
    onScheduledSlotChange({ ...scheduledSlot, endTime })
  }

  return (
    <Card className="mb-3">
      <CardContent className="p-4 space-y-4">
        <View className="flex items-center gap-2">
          <Clock size={16} color="#2088D8" />
          <Text className="block text-base font-semibold text-slate-800">用车时间</Text>
        </View>

        {/* 类型选择 */}
        <ToggleGroup
          type="single"
          value={pickupType}
          onValueChange={(v) => {
            if (v && typeof v === 'string') onPickupTypeChange(v as PickupType)
          }}
          className="flex gap-2"
        >
          <ToggleGroupItem value="immediate" className="flex-1 rounded-lg px-3 py-2 text-sm">
            <View className="flex items-center gap-2">
              <Zap size={14} color="#2088D8" />
              <Text className="block">立即用车</Text>
            </View>
          </ToggleGroupItem>
          <ToggleGroupItem value="scheduled" className="flex-1 rounded-lg px-3 py-2 text-sm">
            <View className="flex items-center gap-2">
              <Calendar size={14} color="#2088D8" />
              <Text className="block">预约用车</Text>
            </View>
          </ToggleGroupItem>
        </ToggleGroup>

        {/* 立即用车提示 */}
        {pickupType === 'immediate' && (
          <View className="bg-blue-50 rounded-lg p-3">
            <Text className="block text-sm text-blue-700">
              立即用车:服务端将在约 {PREP_MINUTES.immediate} 分钟内确认可用时间
            </Text>
          </View>
        )}

        {/* 预约用车 */}
        {pickupType === 'scheduled' && (
          <View className="space-y-3">
            <View>
              <Text className="block text-sm font-medium text-slate-700 mb-2">快捷时段</Text>
              <View className="grid grid-cols-2 gap-2">
                {TIME_SLOTS.map(s => (
                  <View
                    key={s.minutes}
                    className="bg-slate-50 rounded-lg py-2 px-3 text-center active:bg-blue-50"
                    onClick={() => handlePickRelative(s.minutes)}
                  >
                    <Text className="block text-sm text-slate-700">{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="grid grid-cols-3 gap-2">
              <View>
                <Text className="block text-xs text-slate-500 mb-1">日期</Text>
                <View className="bg-slate-50 rounded-lg px-2 py-1">
                  <Input
                    className="w-full bg-transparent border-0 text-sm"
                    type="text"
                    placeholder={todayDate()}
                    value={scheduledSlot?.date || ''}
                    onInput={(e) => handleDateChange(e.detail.value)}
                  />
                </View>
              </View>
              <View>
                <Text className="block text-xs text-slate-500 mb-1">起</Text>
                <View className="bg-slate-50 rounded-lg px-2 py-1">
                  <Input
                    className="w-full bg-transparent border-0 text-sm"
                    type="text"
                    placeholder="HH:mm"
                    value={scheduledSlot?.startTime || ''}
                    onInput={(e) => handleStartTimeChange(e.detail.value)}
                  />
                </View>
              </View>
              <View>
                <Text className="block text-xs text-slate-500 mb-1">止</Text>
                <View className="bg-slate-50 rounded-lg px-2 py-1">
                  <Input
                    className="w-full bg-transparent border-0 text-sm"
                    type="text"
                    placeholder="HH:mm"
                    value={scheduledSlot?.endTime || ''}
                    onInput={(e) => handleEndTimeChange(e.detail.value)}
                  />
                </View>
              </View>
            </View>

            <View className="bg-amber-50 rounded-lg p-3">
              <Text className="block text-xs text-amber-700">
                预约时段需至少提前 {PREP_MINUTES.scheduled} 分钟;
                最终可用时间以后端确认结果为准
              </Text>
            </View>
          </View>
        )}
      </CardContent>
    </Card>
  )
}
