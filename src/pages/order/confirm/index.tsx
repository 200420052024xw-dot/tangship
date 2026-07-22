import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/page-header'
import { FixedActionBar } from '@/components/layout/fixed-action-bar'
import { useOrderDraftStore } from '@/stores/orderDraft'
import { fetchVehicle } from '@/services/vehicle-catalog'
import type { Vehicle } from '@/types/vehicle'
import { consumerRequest } from '@/services/consumer-api'
import { MapPin, Package, Send, Truck } from 'lucide-react-taro'
import { formatOrderTimeRange } from '@/utils/order-time'

export default function OrderConfirmPage() {
  const { draft, resetOrderDraft } = useOrderDraftStore()
  const [submitting, setSubmitting] = useState(false)
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)

  useEffect(() => {
    if (draft.vehicleId) fetchVehicle(draft.vehicleId).then(setVehicle).catch(() => setVehicle(null))
  }, [draft.vehicleId])

  const submit = async () => {
    if (!draft.senderAddress || !draft.receiverAddress || !draft.goods || submitting) return
    setSubmitting(true)
    try {
      const address = (value: typeof draft.senderAddress) => ({
        contactName: value!.contactName,
        phone: value!.mobile,
        province: value!.province,
        city: value!.city,
        district: value!.district,
        poiName: value!.poiName,
        formattedAddress: value!.formattedAddress || value!.poiName,
        detailAddress: value!.detailAddress,
        longitude: value!.longitude,
        latitude: value!.latitude,
      })
      const scheduledAt = draft.pickupType === 'scheduled' && draft.scheduledSlot
        ? new Date(`${draft.scheduledSlot.date}T${draft.scheduledSlot.startTime}:00+08:00`).toISOString()
        : undefined
      const scheduledEndAt = draft.pickupType === 'scheduled' && draft.scheduledSlot
        ? new Date(`${draft.scheduledSlot.date}T${draft.scheduledSlot.endTime}:00+08:00`).toISOString()
        : undefined
      const order = await consumerRequest<{ id: string }>({
        url: '/api/orders',
        method: 'POST',
        header: { 'idempotency-key': draft.draftId },
        data: {
          vehicleId: draft.vehicleId,
          mode: draft.mode,
          pickupType: draft.pickupType,
          scheduledAt,
          scheduledEndAt,
          sender: address(draft.senderAddress),
          receiver: address(draft.receiverAddress),
          items: [draft.goods],
        },
      })
      resetOrderDraft()
      await Taro.redirectTo({ url: `/pages/order/detail/index?id=${order.id}&from=submit` })
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!vehicle || !draft.goods || !draft.senderAddress || !draft.receiverAddress) {
    return <View className="flex min-h-screen items-center justify-center"><Text className="block text-slate-500">订单信息不完整</Text></View>
  }

  const senderAddress = `${draft.senderAddress.formattedAddress} ${draft.senderAddress.detailAddress}`
  const receiverAddress = `${draft.receiverAddress.formattedAddress} ${draft.receiverAddress.detailAddress}`

  return (
    <View className="min-h-screen bg-background pb-28">
      <PageHeader title="核对下单信息" />
      <View className="space-y-3 p-4">
        <Card>
          <CardContent className="p-4">
            <Text className="mb-4 block text-base font-semibold text-slate-900">配送路线</Text>
            <RouteRow icon={<Send size={16} color="#10B981" />} label="寄件地址" address={senderAddress} contact={`${draft.senderAddress.contactName} ${draft.senderAddress.mobile}`} />
            <View className="ml-2 h-5 border-l border-dashed border-slate-200" />
            <RouteRow icon={<MapPin size={16} color="#EF4444" />} label="收件地址" address={receiverAddress} contact={`${draft.receiverAddress.contactName} ${draft.receiverAddress.mobile}`} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Text className="mb-3 block text-base font-semibold text-slate-900">配送车辆</Text>
            <View className="flex items-center gap-3">
              <View className="flex h-16 w-20 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                {vehicle.images?.[0] ? <Image className="h-full w-full" mode="aspectFit" src={vehicle.images[0]} /> : <View className="flex flex-col items-center"><Truck size={28} color="#2088D8" /><Text className="block text-xs text-slate-500">{vehicle.name}</Text></View>}
              </View>
              <View className="flex-1">
                <Text className="block text-sm font-semibold text-slate-900">{vehicle.fullName}</Text>
                <Text className="mt-1 block text-xs text-slate-500">载重 {vehicle.specs.maxLoadKg}kg · 容积 {vehicle.specs.cargoVolume}</Text>
              </View>
            </View>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Text className="mb-3 block text-base font-semibold text-slate-900">物品与用车</Text>
            <SummaryRow label="物品名称" value={draft.goods.name} />
            <SummaryRow label="数量 / 重量" value={`${draft.goods.quantity}件 / ${draft.goods.estimatedWeightKg}kg`} />
            <SummaryRow label="用车时间" value={draft.pickupType === 'immediate' ? formatOrderTimeRange(new Date()) : `${draft.scheduledSlot?.date} ${draft.scheduledSlot?.startTime}-${draft.scheduledSlot?.endTime}`} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <View className="flex items-center justify-between">
              <Text className="block text-base font-semibold text-slate-900">费用</Text>
              <Badge className="border-0 bg-amber-50 text-amber-600">待后台确认</Badge>
            </View>
            <Text className="mt-2 block text-xs leading-relaxed text-slate-500">后台将核验车辆、路线与价格，确认后才可支付。</Text>
          </CardContent>
        </Card>
      </View>

      <FixedActionBar>
        <Button className="h-12 w-full bg-primary text-white" disabled={submitting} onClick={submit}>
          <Text className="block text-base">{submitting ? '提交中…' : '提交后台审核'}</Text>
        </Button>
      </FixedActionBar>
    </View>
  )
}

function RouteRow({ icon, label, address, contact }: { icon: React.ReactNode; label: string; address: string; contact: string }) {
  return (
    <View className="flex items-start gap-3">
      <View className="pt-1">{icon}</View>
      <View className="flex-1">
        <Text className="block text-xs text-slate-400">{label}</Text>
        <Text className="mt-1 block text-sm font-medium text-slate-800">{address}</Text>
        <Text className="mt-1 block text-xs text-slate-500">{contact}</Text>
      </View>
    </View>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
      <View className="flex items-center gap-2"><Package size={14} color="#94A3B8" /><Text className="block text-sm text-slate-500">{label}</Text></View>
      <Text className="block max-w-xs text-right text-sm text-slate-800">{value}</Text>
    </View>
  )
}
