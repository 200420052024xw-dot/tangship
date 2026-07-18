import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useOrderDraftStore } from '@/stores/orderDraft'
import { fetchVehicle } from '@/services/vehicle-catalog'
import type { Vehicle } from '@/types/vehicle'
import { consumerRequest } from '@/services/consumer-api'

export default function OrderConfirmPage() {
  const { draft, resetOrderDraft } = useOrderDraftStore()
  const [submitting, setSubmitting] = useState(false)
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  useEffect(() => { if (draft.vehicleId) fetchVehicle(draft.vehicleId).then(setVehicle).catch(() => setVehicle(null)) }, [draft.vehicleId])
  const submit = async () => {
    if (!draft.senderAddress || !draft.receiverAddress || !draft.goods || submitting) return
    setSubmitting(true)
    try {
      const address = (a: typeof draft.senderAddress) => ({ contactName: a!.contactName, phone: a!.mobile, province: a!.province, city: a!.city, district: a!.district, poiName: a!.poiName, formattedAddress: a!.formattedAddress || a!.poiName, detailAddress: a!.detailAddress, longitude: a!.longitude, latitude: a!.latitude })
      const scheduledAt = draft.pickupType === 'scheduled' && draft.scheduledSlot ? new Date(`${draft.scheduledSlot.date}T${draft.scheduledSlot.startTime}:00+08:00`).toISOString() : undefined
      const scheduledEndAt = draft.pickupType === 'scheduled' && draft.scheduledSlot ? new Date(`${draft.scheduledSlot.date}T${draft.scheduledSlot.endTime}:00+08:00`).toISOString() : undefined
      const order = await consumerRequest<{ id: string }>({ url: '/api/orders', method: 'POST', header: { 'idempotency-key': draft.draftId }, data: { vehicleId: draft.vehicleId, mode: draft.mode, pickupType: draft.pickupType, scheduledAt, scheduledEndAt, sender: address(draft.senderAddress), receiver: address(draft.receiverAddress), items: [draft.goods] } })
      const id = order.id
      resetOrderDraft()
      await Taro.redirectTo({ url: `/pages/order/detail/index?id=${id}` })
    } catch (error) { Taro.showToast({ title: error instanceof Error ? error.message : '提交失败', icon: 'none' }) } finally { setSubmitting(false) }
  }
  if (!vehicle || !draft.goods || !draft.senderAddress || !draft.receiverAddress) return <View className="min-h-screen flex items-center justify-center"><Text className="block text-slate-500">订单信息不完整</Text></View>
  return <View className="min-h-screen bg-slate-50 p-4 pb-28 space-y-3">
    <Card><CardHeader><CardTitle>订单核对</CardTitle></CardHeader><CardContent className="space-y-3"><Row label="车型" value={vehicle.fullName} /><Row label="寄件地址" value={`${draft.senderAddress.formattedAddress} ${draft.senderAddress.detailAddress}`} /><Row label="收件地址" value={`${draft.receiverAddress.formattedAddress} ${draft.receiverAddress.detailAddress}`} /><Row label="物品" value={`${draft.goods.name} × ${draft.goods.quantity}`} /><Row label="预约时间" value={draft.pickupType === 'immediate' ? '立即用车' : `${draft.scheduledSlot?.date} ${draft.scheduledSlot?.startTime}`} /></CardContent></Card>
    <Card><CardContent className="p-4"><View className="flex justify-between"><Text className="block text-sm">费用</Text><Badge variant="outline">待后台确认</Badge></View><Text className="block mt-3 text-sm text-slate-500">后台将确认车辆、路线与价格；确认后才可支付。</Text></CardContent></Card>
    <View style={{position:'fixed',bottom:0,left:0,right:0,padding:'12px 16px',backgroundColor:'#fff',zIndex:100}}><Button className="w-full" disabled={submitting} onClick={submit}><Text className="block">{submitting ? '提交中…' : '提交后台审核'}</Text></Button></View>
  </View>
}
function Row({label,value}:{label:string;value:string}){return <View><Text className="block text-xs text-slate-500">{label}</Text><Text className="block text-sm text-slate-800 mt-1">{value}</Text></View>}
