import { Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel
} from '@/components/ui/alert-dialog'
import { CircleCheck, CircleX, Hourglass, Wallet, Ban, Truck, Send, MapPin, Clock3, Receipt, CircleAlert, Phone } from 'lucide-react-taro'
import { consumerRequest } from '@/services/consumer-api'

type Detail = Record<string, any>

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof Clock3 }> = {
  pending_review:  { label: '待确认',  color: 'text-amber-600',  bg: 'bg-amber-50',   icon: Hourglass },
  pending_payment: { label: '待支付',  color: 'text-blue-600',   bg: 'bg-blue-50',    icon: Wallet },
  paid:            { label: '已支付',  color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CircleCheck },
  rejected:        { label: '已拒绝',  color: 'text-red-500',    bg: 'bg-red-50',     icon: CircleX },
  cancelled:       { label: '已取消',  color: 'text-slate-400',  bg: 'bg-slate-100',  icon: Ban },
  quote_expired:   { label: '报价过期', color: 'text-orange-500', bg: 'bg-orange-50',  icon: Clock3 },
  dispatching:     { label: '调度中',  color: 'text-violet-600', bg: 'bg-violet-50',  icon: Truck },
  delivering:      { label: '配送中',  color: 'text-indigo-600', bg: 'bg-indigo-50',  icon: Truck },
  completed:       { label: '已完成',  color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CircleCheck },
}

const modeLabels: Record<string, string> = { single: '单趟配送', monthly: '企业包月', rental: '短租体验', purchase: '整车购买' }

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function yuan(cents: number) { return `¥${(cents / 100).toFixed(2)}` }

function getIconColor(colorClass: string): string {
  const map: Record<string, string> = {
    'text-amber-600': '#d97706', 'text-blue-600': '#2563eb', 'text-emerald-600': '#059669',
    'text-red-500': '#ef4444', 'text-slate-400': '#94a3b8', 'text-orange-500': '#f97316',
    'text-violet-600': '#7c3aed', 'text-indigo-600': '#4f46e5',
  }
  return map[colorClass] || '#94a3b8'
}

const STEPS = [
  { key: 'submit',    label: '提交',  icon: Send },
  { key: 'review',    label: '确认',  icon: Hourglass },
  { key: 'payment',   label: '支付',  icon: Wallet },
  { key: 'delivery',  label: '配送',  icon: Truck },
  { key: 'complete',  label: '完成',  icon: CircleCheck },
]

function getStepIndex(status: string) {
  if (status === 'pending_review') return 1
  if (status === 'pending_payment') return 2
  if (status === 'paid') return 2.5
  if (status === 'dispatching') return 3
  if (status === 'delivering') return 3.5
  if (status === 'completed') return 4
  if (status === 'rejected' || status === 'cancelled') return -1
  return 0
}

export default function OrderDetailPage() {
  const [order, setOrder] = useState<Detail | null>(null)
  const [orderId, setOrderId] = useState('')
  const [paying, setPaying] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  useLoad(({ id }) => {
    setOrderId(id)
    consumerRequest<Detail>({ url: `/api/orders/${id}` })
      .then(setOrder)
      .catch(() => Taro.showToast({ title: '加载失败', icon: 'none' }))
  })

  const handlePay = async () => {
    if (!order?.quote || paying) return
    setPaying(true)
    try {
      const result = await consumerRequest<Detail>({
        url: `/api/orders/${orderId}/pay`, method: 'POST',
        data: { amountCents: order.quote.total_cents }
      })
      setOrder(result)
      Taro.showToast({ title: '支付成功', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '支付失败', icon: 'none' })
    } finally { setPaying(false) }
  }

  const handleCancel = async () => {
    try {
      const result = await consumerRequest<Detail>({ url: `/api/orders/${orderId}/cancel`, method: 'POST' })
      setOrder(result)
      Taro.showToast({ title: '已取消', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '取消失败', icon: 'none' })
    }
  }

  if (!order) return (
    <View className="min-h-screen bg-slate-50 p-4 space-y-3">
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </View>
  )

  const sc = statusConfig[order.status] || { label: order.status, color: 'text-slate-500', bg: 'bg-slate-50', icon: Clock3 }
  const StatusIcon = sc.icon
  const sender = order.addresses?.find((a: Detail) => a.role === 'sender')
  const receiver = order.addresses?.find((a: Detail) => a.role === 'receiver')
  const quote = order.quote
  const stepIdx = getStepIndex(order.status)
  const isTerminal = stepIdx === -1 || order.status === 'completed'
  const canCancel = ['pending_review', 'pending_payment'].includes(order.status)
  const isPaid = order.status === 'paid'

  return (
    <View className="min-h-screen bg-slate-50 pb-6">
      {/* 顶部状态栏 */}
      <View className={`${sc.bg} px-4 pt-5 pb-4`}>
        <View className="flex flex-row items-center gap-2">
          <StatusIcon size={24} color={getIconColor(sc.color)} />
          <View>
            <Text className={`block text-lg font-semibold ${sc.color}`}>{sc.label}</Text>
            <Text className="block text-xs text-slate-500 mt-1">{order.order_no}</Text>
          </View>
        </View>
      </View>

      <View className="px-4 -mt-2 space-y-3">
        {/* 状态步骤条 - 加大字号和图标 */}
        {!isTerminal && (
          <Card>
            <CardContent className="p-4">
              <View className="flex flex-row items-center justify-between">
                {STEPS.map((step, i) => {
                  const StepIcon = step.icon
                  const done = stepIdx >= i
                  const active = Math.floor(stepIdx) === i
                  return (
                    <View key={step.key} className="flex flex-col items-center flex-1">
                      <View className={`w-9 h-9 rounded-full flex items-center justify-center ${done ? 'bg-blue-500' : active ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        <StepIcon size={18} color={done ? '#ffffff' : active ? '#2563eb' : '#94a3b8'} />
                      </View>
                      <Text className={`block text-xs mt-1 font-medium ${done ? 'text-blue-600' : 'text-slate-400'}`}>{step.label}</Text>
                    </View>
                  )
                })}
              </View>
            </CardContent>
          </Card>
        )}

        {/* 地址信息卡 - 图标与文字对齐 */}
        <Card>
          <CardContent className="p-4">
            <View className="space-y-3">
              <View className="flex flex-row items-center gap-2">
                <Send size={16} color="#059669" />
                <View className="flex-1 min-w-0">
                  <Text className="block text-xs text-slate-400">寄件地址</Text>
                  <Text className="block text-sm text-slate-700 mt-1">{sender?.formatted_address || '—'}{sender?.detail_address ? ` ${sender.detail_address}` : ''}</Text>
                  <Text className="block text-xs text-slate-400 mt-1">{sender?.contact_name} {sender?.phone}</Text>
                </View>
              </View>
              <View className="flex flex-row items-center gap-2">
                <MapPin size={16} color="#2563eb" />
                <View className="flex-1 min-w-0">
                  <Text className="block text-xs text-slate-400">收件地址</Text>
                  <Text className="block text-sm text-slate-700 mt-1">{receiver?.formatted_address || '—'}{receiver?.detail_address ? ` ${receiver.detail_address}` : ''}</Text>
                  <Text className="block text-xs text-slate-400 mt-1">{receiver?.contact_name} {receiver?.phone}</Text>
                </View>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 订单信息卡 */}
        <Card>
          <CardHeader><CardTitle>订单信息</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Row label="车型" value={order.vehicle_id} />
            <Row label="服务模式" value={modeLabels[order.mode] || order.mode} />
            <Row label="物品" value={order.items?.map((i: Detail) => `${i.name} × ${i.quantity}`).join('、')} />
            <Row label="预约时间" value={order.scheduled_at ? formatTime(order.scheduled_at) : '立即用车'} />
            <Row label="下单时间" value={formatTime(order.created_at)} />
          </CardContent>
        </Card>

        {/* 待确认提示 */}
        {order.status === 'pending_review' && (
          <Card>
            <CardContent className="p-4">
              <View className="flex flex-row items-start gap-2">
                <Hourglass size={16} color="#d97706" className="mt-1 shrink-0" />
                <View>
                  <Text className="block text-sm font-medium text-amber-700">等待后台确认</Text>
                  <Text className="block text-xs text-slate-500 mt-1">工作人员将确认车辆与配送价格，请耐心等待</Text>
                </View>
              </View>
            </CardContent>
          </Card>
        )}

        {/* 报价明细卡 */}
        {order.status === 'pending_payment' && quote && (
          <Card>
            <CardHeader>
              <View className="flex flex-row items-center gap-2">
                <Receipt size={16} color="#2563eb" />
                <CardTitle>报价明细</CardTitle>
              </View>
            </CardHeader>
            <CardContent className="space-y-2">
              <Row label="基础费" value={yuan(quote.base_fee_cents)} />
              <Row label="距离费" value={`${yuan(quote.distance_fee_cents)}（${(quote.distance_meters / 1000).toFixed(1)}km）`} />
              <Row label="车辆费" value={yuan(quote.vehicle_fee_cents)} />
              <Row label="服务费" value={yuan(quote.service_fee_cents)} />
              {quote.discount_cents > 0 && <Row label="优惠" value={`-${yuan(quote.discount_cents)}`} />}
              <Separator />
              <View className="flex flex-row items-center justify-between">
                <Text className="block text-sm font-medium text-slate-700">合计</Text>
                <Text className="block text-lg font-bold text-blue-600">{yuan(quote.total_cents)}</Text>
              </View>
              {quote.expires_at && <Row label="有效期至" value={formatTime(quote.expires_at)} />}
              {order.user_note && (
                <View className="mt-2 rounded-lg bg-blue-50 p-3">
                  <Text className="block text-xs text-blue-700">后台说明：{order.user_note}</Text>
                </View>
              )}
              <Button className="w-full mt-3" disabled={paying} onClick={handlePay}>
                <Text className="block">{paying ? '支付中…' : '确认支付'}</Text>
              </Button>
              <View className="mt-2 rounded-lg bg-amber-50 p-2">
                <Text className="block text-xs text-amber-700">当前为测试模式，点击即完成支付</Text>
              </View>
            </CardContent>
          </Card>
        )}

        {/* 已支付 */}
        {isPaid && (
          <Card>
            <CardContent className="p-4">
              <View className="flex flex-row items-center gap-2">
                <CircleCheck size={20} color="#059669" />
                <Text className="block text-base font-semibold text-emerald-600">已支付</Text>
              </View>
              <Text className="block text-sm text-slate-500 mt-2">等待调度配送，请留意通知</Text>
            </CardContent>
          </Card>
        )}

        {/* 已拒绝 */}
        {order.status === 'rejected' && (
          <Card>
            <CardContent className="p-4">
              <View className="flex flex-row items-start gap-2">
                <CircleAlert size={16} color="#ef4444" className="mt-1 shrink-0" />
                <View>
                  <Text className="block text-sm font-medium text-red-600">订单被拒绝</Text>
                  {order.rejection_reason && <Text className="block text-xs text-slate-500 mt-1">原因：{order.rejection_reason}</Text>}
                </View>
              </View>
              <Button className="w-full mt-3" onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
                <Text className="block">重新下单</Text>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 操作按钮 */}
        {canCancel && (
          <Button variant="outline" className="w-full" onClick={() => setCancelDialogOpen(true)}>
            <Text className="block">取消订单</Text>
          </Button>
        )}

        {/* 已支付订单 - 联系客服 */}
        {isPaid && (
          <Button variant="outline" className="w-full" onClick={() => Taro.makePhoneCall({ phoneNumber: '400-000-0000' }).catch(() => Taro.showToast({ title: '客服电话：400-000-0000', icon: 'none', duration: 3000 }))}>
            <View className="flex flex-row items-center gap-2">
              <Phone size={16} color="#475569" />
              <Text className="block">联系客服</Text>
            </View>
          </Button>
        )}
      </View>

      {/* 取消订单确认弹窗 */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Text className="block text-lg font-semibold">确认取消订单？</Text>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Text className="block text-sm text-slate-500">取消后订单将无法恢复，如需再次下单请重新选择车型。</Text>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text className="block">再想想</Text>
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>
              <Text className="block">确认取消</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex flex-row justify-between gap-4">
      <Text className="block text-sm text-slate-500 shrink-0">{label}</Text>
      <Text className="block text-sm text-slate-800 text-right">{value}</Text>
    </View>
  )
}
