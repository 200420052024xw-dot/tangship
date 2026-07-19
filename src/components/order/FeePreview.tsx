import { Text, View } from '@tarojs/components'
import { useEffect, useMemo, useState } from 'react'
import type { FC } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Receipt } from 'lucide-react-taro'
import { consumerRequest } from '@/services/consumer-api'
import type { Address } from '@/types/address'
import type { GoodsInfo, PickupType, TimeSlot } from '@/types/order'
import type { Vehicle } from '@/types/vehicle'

interface FeePreviewProps {
  vehicle: Vehicle | null
  senderAddress: Address | null
  receiverAddress: Address | null
  goods: GoodsInfo | null
  pickupType: PickupType
  scheduledSlot: TimeSlot | null
}

interface PricingPreview {
  totalCents: number
}

function distanceMeters(sender: Address, receiver: Address) {
  const toRadians = (value: number) => value * Math.PI / 180
  const earthRadius = 6371000
  const latitudeDelta = toRadians(receiver.latitude - sender.latitude)
  const longitudeDelta = toRadians(receiver.longitude - sender.longitude)
  const senderLatitude = toRadians(sender.latitude)
  const receiverLatitude = toRadians(receiver.latitude)
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(senderLatitude) * Math.cos(receiverLatitude) * Math.sin(longitudeDelta / 2) ** 2
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)))
}

export const FeePreview: FC<FeePreviewProps> = ({
  vehicle,
  senderAddress,
  receiverAddress,
  goods,
  pickupType,
  scheduledSlot,
}) => {
  const [totalCents, setTotalCents] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const input = useMemo(() => {
    if (!vehicle || !senderAddress || !receiverAddress) return null
    const validCoordinates = [senderAddress.longitude, senderAddress.latitude, receiverAddress.longitude, receiverAddress.latitude]
      .every(value => Number.isFinite(value) && value !== 0)
    if (!validCoordinates) return null
    const hour = pickupType === 'scheduled' && scheduledSlot ? Number(scheduledSlot.startTime.split(':')[0]) : new Date().getHours()
    return {
      vehicleId: vehicle.id,
      distanceMeters: distanceMeters(senderAddress, receiverAddress),
      weightKg: goods ? goods.estimatedWeightKg * goods.quantity : 0,
      coldChain: Boolean(vehicle.specs.temperatureRange),
      night: hour >= 22 || hour < 6,
      remote: false,
    }
  }, [goods, pickupType, receiverAddress, scheduledSlot, senderAddress, vehicle])

  useEffect(() => {
    if (!vehicle || !input) {
      setTotalCents(null)
      return
    }
    let cancelled = false
    setLoading(true)
    consumerRequest<PricingPreview>({ url: '/api/content/pricing/preview', method: 'POST', data: input })
      .then(result => { if (!cancelled) setTotalCents(result.totalCents) })
      .catch(() => {
        if (!cancelled) setTotalCents(vehicle.pricingDescription.startFrom !== undefined ? Math.round(vehicle.pricingDescription.startFrom * 100) : null)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [input, vehicle])

  const amount = totalCents === null ? '—' : `¥${(totalCents / 100).toFixed(2)}`

  return (
    <Card className="mb-3 border-blue-100">
      <CardContent className="p-4">
        <View className="mb-3 flex items-center gap-2">
          <Receipt size={16} color="#2088D8" />
          <Text className="block text-sm font-medium text-slate-700">费用预估</Text>
        </View>
        <View className="rounded-lg bg-blue-50 p-3">
          <View className="flex items-center justify-between">
            <Text className="block text-sm text-slate-700">本单预估</Text>
            <Text className="block text-xl font-bold text-primary">{loading ? '计算中…' : amount}</Text>
          </View>
          <Text className="mt-1 block text-xs leading-relaxed text-slate-500">根据当前路线、车型和货物预测，最终费用以后台审核报价为准。</Text>
        </View>
      </CardContent>
    </Card>
  )
}
