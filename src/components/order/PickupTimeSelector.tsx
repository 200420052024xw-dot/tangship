/**
 * 用车时间选择
 *
 * - 立即用车 / 预约用车
 * - 预约用车：点击后底部 Drawer 弹窗选择日期+时段，确认后显示已选时间
 */

import { View, Text } from '@tarojs/components'
import { useMemo, useState } from 'react'
import type { FC } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Clock, Zap, Calendar, ChevronDown } from 'lucide-react-taro'
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
function getBookableDates(): { label: string; shortLabel: string; value: string }[] {
  const result: { label: string; shortLabel: string; value: string }[] = []
  const now = new Date()
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

  for (let i = 0; i < BOOKABLE_DAYS; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    const dateStr = toLocalISO(d)
    let shortLabel: string
    if (i === 0) shortLabel = '今天'
    else if (i === 1) shortLabel = '明天'
    else if (i === 2) shortLabel = '后天'
    else shortLabel = weekDays[d.getDay()]

    const label = `${shortLabel} ${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
    result.push({ label, shortLabel, value: dateStr })
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

/** 格式化已选时间显示 */
function formatScheduledDisplay(slot: TimeSlot, dates: { shortLabel: string; value: string }[]): string {
  const dateItem = dates.find(d => d.value === slot.date)
  const dateLabel = dateItem?.shortLabel || slot.date
  return `${dateLabel} ${slot.startTime}-${slot.endTime}`
}

export const PickupTimeSelector: FC<Props> = ({
  pickupType,
  scheduledSlot,
  onPickupTypeChange,
  onScheduledSlotChange,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Drawer 内临时选中的值
  const [tempDate, setTempDate] = useState<string>('')
  const [tempSlot, setTempSlot] = useState<{ start: string; end: string } | null>(null)

  const bookableDates = useMemo(() => getBookableDates(), [])

  const handlePickupTypeChange = (type: PickupType) => {
    onPickupTypeChange(type)
    if (type === 'scheduled' && !scheduledSlot) {
      // 打开 Drawer 让用户选择
      const defaultDate = bookableDates[0]?.value || ''
      setTempDate(defaultDate)
      setTempSlot(getHalfHourSlots(defaultDate)[0] || null)
      setDrawerOpen(true)
    }
  }

  const handleDrawerConfirm = () => {
    if (tempDate && tempSlot) {
      onScheduledSlotChange({
        date: tempDate,
        startTime: tempSlot.start,
        endTime: tempSlot.end,
      })
    }
    setDrawerOpen(false)
  }

  const handleReschedule = () => {
    setTempDate(scheduledSlot?.date || bookableDates[0]?.value || '')
    setTempSlot(
      scheduledSlot
        ? { start: scheduledSlot.startTime, end: scheduledSlot.endTime }
        : null
    )
    setDrawerOpen(true)
  }

  const handleDateSelect = (dateValue: string) => {
    setTempDate(dateValue)
    const firstSlot = getHalfHourSlots(dateValue)[0]
    setTempSlot(firstSlot || null)
  }

  // Drawer 内时段列表基于临时日期
  const drawerSlots = useMemo(
    () => getHalfHourSlots(tempDate),
    [tempDate],
  )

  const tempSlotKey = tempSlot ? `${tempSlot.start}-${tempSlot.end}` : ''

  return (
    <>
      <Card className="mb-3">
        <CardContent className="p-4 space-y-3">
          <View className="flex items-center gap-2">
            <Clock size={16} color="#2088D8" />
            <Text className="block text-base font-semibold text-slate-800">用车时间</Text>
          </View>

          {/* 类型选择 */}
          <ToggleGroup
            type="single"
            value={pickupType}
            onValueChange={(v) => {
              if (v && typeof v === 'string') handlePickupTypeChange(v as PickupType)
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
                立即用车：约 {PREP_MINUTES.immediate} 分钟内确认可用时间
              </Text>
            </View>
          )}

          {/* 预约用车 — 已选时间展示 */}
          {pickupType === 'scheduled' && scheduledSlot && (
            <View
              className="bg-blue-50 rounded-lg p-3 flex items-center justify-between"
              onClick={handleReschedule}
            >
              <View className="flex items-center gap-2">
                <Calendar size={16} color="#2088D8" />
                <Text className="block text-sm text-blue-700 font-medium">
                  {formatScheduledDisplay(scheduledSlot, bookableDates)}
                </Text>
              </View>
              <ChevronDown size={16} color="#2088D8" />
            </View>
          )}

          {pickupType === 'scheduled' && !scheduledSlot && (
            <View
              className="bg-slate-50 rounded-lg p-3 flex items-center justify-center"
              onClick={handleReschedule}
            >
              <Text className="block text-sm text-slate-500">点击选择预约时间</Text>
            </View>
          )}
        </CardContent>
      </Card>

      {/* 底部弹窗选择日期+时段 */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>选择预约时间</DrawerTitle>
          </DrawerHeader>

          <View className="px-4 pb-4 space-y-4" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {/* 日期选择 */}
            <View>
              <Text className="block text-sm font-medium text-slate-700 mb-2">选择日期</Text>
              <View className="flex gap-2">
                {bookableDates.map(d => {
                  const isSelected = tempDate === d.value
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
              {drawerSlots.length === 0 ? (
                <View className="bg-slate-50 rounded-lg p-3">
                  <Text className="block text-sm text-slate-500">当天可预约时段已满，请选择其他日期</Text>
                </View>
              ) : (
                <View className="grid grid-cols-3 gap-2">
                  {drawerSlots.map(slot => {
                    const key = `${slot.start}-${slot.end}`
                    const isSelected = key === tempSlotKey
                    return (
                      <View
                        key={key}
                        className={`rounded-lg py-2 px-1 text-center ${isSelected ? 'bg-blue-500' : 'bg-slate-50 active:bg-blue-50'}`}
                        onClick={() => setTempSlot(slot)}
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
          </View>

          <DrawerFooter>
            <Button
              className="w-full"
              disabled={!tempDate || !tempSlot}
              onClick={handleDrawerConfirm}
            >
              <Text className="text-white">确认预约</Text>
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}
