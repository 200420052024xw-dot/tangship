import { Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { consumerRequest } from '@/services/consumer-api'

type Detail = Record<string, any>
const labels: Record<string, string> = { pending_review: '待后台确认', pending_payment: '待支付', rejected: '已拒绝', quote_expired: '报价已过期', cancelled: '已取消', paid: '已支付', dispatching: '调度中', delivering: '配送中', completed: '已完成' }
export default function OrderDetailPage() {
  const [order, setOrder] = useState<Detail | null>(null)
  const [orderId, setOrderId] = useState('')
  useLoad(({ id }) => {
    setOrderId(id)
    consumerRequest<Detail>({ url: `/api/orders/${id}` })
      .then(setOrder)
      .catch(() => Taro.showToast({ title: '加载失败', icon: 'none' }))
  })
  if (!order) return <View className="p-4"><Text className="block">加载中…</Text></View>
  const sender = order.addresses?.find((a: Detail) => a.role === 'sender')
  const receiver = order.addresses?.find((a: Detail) => a.role === 'receiver')
  const quote = order.quote
  return <View className="min-h-screen bg-slate-50 p-4 space-y-3">
    <Card><CardHeader><View className="flex justify-between"><CardTitle>{order.order_no}</CardTitle><Badge>{labels[order.status] || order.status}</Badge></View></CardHeader><CardContent className="space-y-2"><Line label="车型" value={order.vehicle_id} /><Line label="寄件地址" value={`${sender?.formatted_address || ''} ${sender?.detail_address || ''}`} /><Line label="收件地址" value={`${receiver?.formatted_address || ''} ${receiver?.detail_address || ''}`} /><Line label="物品" value={order.items?.map((i: Detail) => `${i.name} × ${i.quantity}`).join('、')} /><Line label="预约时间" value={order.scheduled_at || '立即用车'} /></CardContent></Card>
    {order.status === 'pending_review' && <Card><CardContent className="p-4"><Text className="block text-sm text-slate-600">后台确认车辆与价格后可支付</Text></CardContent></Card>}
    {order.status === 'pending_payment' && quote && <Card><CardHeader><CardTitle>后台确认价格</CardTitle></CardHeader><CardContent className="space-y-2"><Line label="基础费" value={yuan(quote.base_fee_cents)} /><Line label="距离费" value={yuan(quote.distance_fee_cents)} /><Line label="车辆费" value={yuan(quote.vehicle_fee_cents)} /><Line label="服务费" value={yuan(quote.service_fee_cents)} /><Line label="优惠" value={`-${yuan(quote.discount_cents)}`} /><Line label="合计" value={yuan(quote.total_cents)} /><Line label="报价有效期" value={quote.expires_at} />{order.user_note && <View className="mt-3 rounded-lg bg-blue-50 p-3"><Text className="block text-xs text-blue-700">后台说明：{order.user_note}</Text></View>}<Button className="w-full mt-3" disabled><Text className="block">支付功能待接入</Text></Button></CardContent></Card>}
    {order.status === 'rejected' && <Card><CardContent className="p-4"><Text className="block text-red-600">拒绝原因：{order.rejection_reason}</Text><Button className="w-full mt-3" onClick={() => Taro.switchTab({ url: '/pages/index/index' })}><Text className="block">重新下单</Text></Button></CardContent></Card>}
    {['pending_review', 'pending_payment'].includes(order.status) && <Button variant="outline" className="w-full" onClick={() => consumerRequest<Detail>({ url: `/api/orders/${orderId}/cancel`, method: 'POST' }).then(setOrder).catch(error => Taro.showToast({ title: error instanceof Error ? error.message : '取消失败', icon: 'none' }))}><Text className="block">取消订单</Text></Button>}
  </View>
}
function yuan(cents: number) { return `¥${(cents / 100).toFixed(2)}` }
function Line({ label, value }: { label: string; value: string }) { return <View className="flex justify-between gap-4"><Text className="block text-sm text-slate-500">{label}</Text><Text className="block text-sm text-slate-800 text-right">{value}</Text></View> }
