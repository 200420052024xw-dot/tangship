/**
 * 用车时间选择
 *
 * - 立即用车 / 预约用车
 * - 预约用车：选择日期（今天/明天/后天）+ 选择时间段（每半小时一个时段）
 * - 用户选择，不让用户填写
 */

import { View, Text } from '@tarojs/components'
import { useEffect, useMemo } from 'react'
import type { FC } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Clock, Zap, Calendar } from 'lucide-react-taro'
import type { PickupType, TimeSlot } from '@/types/order'

/**
 * 准备时间常量
 */
export const PREP_MINUTES = {
  immediate: 30,
  scheduled: 60,
}

/** 可预约天数：今天 + 明天 + 后天 = 3天 */
const BOOKABLE_DAYS = 3

/** 时间段起始小时（6:00 起至 22:00） */
const START_HOUR = 6
const END_HOUR = 22

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

function toHHmm(h: number, m: number): string {
  return `${pad(h)}:${pad(m)}`
}

/** 获取可预约日期列表 */
function getBookableDates(): { label: string; value: string }[] {
  const result: { label: string; value: string }[] = []
  const now = new Date()
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

  for (let i = 0; i < BOOKABLE_DAYS; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    const dateStr = toLocalISO(d)
    let label: string
    if (i === 0) label = '今天'
    else if (i === 1) label = '明天'
    else if (i === 2) label = '后天'
    else label = weekDays[d.getDay()]

    label += ` ${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
    result.push({ label, value: dateStr })
  }
  return result
}

/** 获取半小时时段列表 */
function getHalfHourSlots(dateStr: string): { label: string; start: string; end: string }[] {
  const slots: { label: string; start: string; end: string }[] = []
  const now = new Date()
  const isToday = dateStr === toLocalISO(now)

  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (let m = 0; m < 60; m += 30) {
      const start = toHHmm(h, m)
      const endMin = m + 30
      const endH = endMin >= 60 ? h + 1 : h
      const endM = endMin >= 60 ? 0 : endMin
      const end = toHHmm(endH, endM)

      // 今天：跳过已过去的时间段（至少提前1小时）
      if (isToday) {
        const slotTime = new Date(now)
        slotTime.setHours(h, m, 0, 0)
        const minTime = new Date(now.getTime() + PREP_MINUTES.scheduled * 60_000)
        if (slotTime < minTime) continue
      }

      slots.push({ label: `${start}-${end}`, start, end })
    }
  }
  return slots
}

export const PickupTimeSelector: FC<Props> = ({
  pickupType,
  scheduledSlot,
  onPickupTypeChange,
  onScheduledSlotChange,
}) => {
  const bookableDates = useMemo(() => getBookableDates(), [])
  const timeSlots = useMemo(
    () => getHalfHourSlots(scheduledSlot?.date || bookableDates[0]?.value || ''),
    [scheduledSlot?.date, bookableDates],
  )

  // 预约用车：初始化默认值
  useEffect(() => {
    if (pickupType !== 'scheduled') return
    if (scheduledSlot) return
    const defaultDate = bookableDates[0]?.value
    if (!defaultDate) return
    const defaultSlot = getHalfHourSlots(defaultDate)[0]
    if (defaultSlot) {
      onScheduledSlotChange({
        date: defaultDate,
        startTime: defaultSlot.start,
        endTime: defaultSlot.end,
      })
    }
  }, [pickupType, scheduledSlot, onPickupTypeChange, bookableDates])

  const handleDateSelect = (dateValue: string) => {
    const firstSlot = getHalfHourSlots(dateValue)[0]
    onScheduledSlotChange({
      date: dateValue,
      startTime: firstSlot?.start || '08:00',
      endTime: firstSlot?.end || '08:30',
    })
  }

  const handleSlotSelect = (slot: { start: string; end: string }) => {
    if (!scheduledSlot) return
    onScheduledSlotChange({
      ...scheduledSlot,
      startTime: slot.start,
      endTime: slot.end,
    })
  }

  /** 当前选中的时段key */
  const selectedSlotKey = scheduledSlot
    ? `${scheduledSlot.startTime}-${scheduledSlot.endTime}`
    : ''

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
              立即用车：服务端将在约 {PREP_MINUTES.immediate} 分钟内确认可用时间
            </Text>
          </View>
        )}

        {/* 预约用车 */}
        {pickupType === 'scheduled' && (
          <View className="space-y-3">
            {/* 日期选择 */}
            <View>
              <Text className="block text-sm font-medium text-slate-700 mb-2">选择日期</Text>
              <View className="flex gap-2">
                {bookableDates.map(d => {
                  const isSelected = scheduledSlot?.date === d.value
                  return (
                    <View
                      key={d.value}
                      className={`flex-1 rounded-lg py-2 px-1 text-center ${isSelected ? 'bg-blue-500' : 'bg-slate-50 active:bg-blue-50'}`}
                      onClick={() => handleDateSelect(d.value)}
                    >
                      <Text className={`block text-sm ${isSelected ? 'text-white font-medium' : 'text-slate-700'}`}>
                        {d.label}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </View>

            {/* 时间段选择 */}
            <View>
              <Text className="block text-sm font-medium text-slate-700 mb-2">选择时段</Text>
              {timeSlots.length === 0 ? (
                <View className="bg-slate-50 rounded-lg p-3">
                  <Text className="block text-sm text-slate-500">当天可预约时段已满，请选择其他日期</Text>
                </View>
              ) : (
                <View className="grid grid-cols-3 gap-2">
                  {timeSlots.map(slot => {
                    const key = `${slot.start}-${slot.end}`
                    const isSelected = key === selectedSlotKey
                    return (
                      <View
                        key={key}
                        className={`rounded-lg py-2 px-1 text-center ${isSelected ? 'bg-blue-500' : 'bg-slate-50 active:bg-blue-50'}`}
                        onClick={() => handleSlotSelect(slot)}
                      >
                        <Text className={`block text-xs ${isSelected ? 'text-white font-medium' : 'text-slate-700'}`}>
                          {slot.label}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>

            <View className="bg-amber-50 rounded-lg p-3">
              <Text className="block text-xs text-amber-700">
                预约时段需至少提前 {PREP_MINUTES.scheduled} 分钟；最终可用时间以后端确认结果为准
              </Text>
            </View>
          </View>
        )}
      </CardContent>
    </Card>
  )
}
