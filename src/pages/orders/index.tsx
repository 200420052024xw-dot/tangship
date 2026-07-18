import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Truck, Clock3, CircleCheck, CircleX, Hourglass, Ban, Wallet, Loader, Send, MapPin } from 'lucide-react-taro'
import { consumerRequest } from '@/services/consumer-api'
import { useSWR } from '@/stores/data-cache'

type Order = {
  id: string; orderNo: string; vehicleId: string; mode: string; status: string
  createdAt: string; quoteExpiresAt?: string
  sender?: { formattedAddress: string }; receiver?: { formattedAddress: string }
  quote?: { totalCents: number }
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof Clock3 }> = {
  pending_review:  { label: '待确认',  color: 'text-amber-600',  bg: 'bg-amber-50',   icon: Hourglass },
  pending_payment: { label: '待支付',  color: 'text-blue-600',   bg: 'bg-blue-50',    icon: Wallet },
  paid:            { label: '已支付',  color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CircleCheck },
  rejected:        { label: '已拒绝',  color: 'text-red-500',    bg: 'bg-red-50',     icon: CircleX },
  cancelled:       { label: '已取消',  color: 'text-slate-400',  bg: 'bg-slate-100',  icon: Ban },
  quote_expired:   { label: '报价过期', color: 'text-orange-500', bg: 'bg-orange-50',  icon: Clock3 },
  dispatching:     { label: '调度中',  color: 'text-violet-600', bg: 'bg-violet-50',  icon: Loader },
  delivering:      { label: '配送中',  color: 'text-indigo-600', bg: 'bg-indigo-50',  icon: Truck },
  completed:       { label: '已完成',  color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CircleCheck },
}

const modeLabels: Record<string, string> = { single: '单趟配送', monthly: '企业包月', rental: '短租体验', purchase: '整车购买' }

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}小时前`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}天前`
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatCents(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`
}

export default function OrdersPage() {
  const { data: orders, loading, refresh } = useSWR<Order[]>(
    'my-orders', () => consumerRequest({ url: '/api/orders' }), 'dynamic'
  )
  useDidShow(() => { refresh() })

  const orderList = orders || []

  return (
    <View className="min-h-screen bg-slate-50">
      {/* 顶部栏 */}
      <View className="bg-white px-4 pt-4 pb-3 border-b border-slate-100">
        <Text className="block text-xl font-semibold text-slate-800">我的订单</Text>
        {!loading && <Text className="block text-xs text-slate-400 mt-1">共 {orderList.length} 条</Text>}
      </View>

      {loading ? (
        <View className="p-4 space-y-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </View>
      ) : !orderList.length ? (
        <View className="flex flex-col items-center justify-center pt-24">
          <Send size={48} color="#94a3b8" />
          <Text className="block text-slate-400 mt-4">暂无订单</Text>
          <Text className="block text-xs text-slate-300 mt-1">去首页选择车型开始下单</Text>
        </View>
      ) : (
        <View className="p-4 space-y-3">
          {orderList.map(order => {
            const sc = statusConfig[order.status] || { label: order.status, color: 'text-slate-500', bg: 'bg-slate-50', icon: Clock3 }
            const StatusIcon = sc.icon
            return (
              <Card key={order.id} onClick={() => Taro.navigateTo({ url: `/pages/order/detail/index?id=${order.id}` }).catch(() => Taro.showToast({ title: '打开失败', icon: 'none' }))}>
                <CardContent className="p-4">
                  {/* 第一行：单号 + 状态 */}
                  <View className="flex flex-row items-center justify-between">
                    <Text className="block text-sm font-medium text-slate-700">{order.orderNo}</Text>
                    <View className="flex flex-row items-center gap-1">
                      <StatusIcon size={14} color={sc.color === 'text-amber-600' ? '#d97706' : sc.color === 'text-blue-600' ? '#2563eb' : sc.color === 'text-emerald-600' ? '#059669' : sc.color === 'text-red-500' ? '#ef4444' : sc.color === 'text-violet-600' ? '#7c3aed' : sc.color === 'text-indigo-600' ? '#4f46e5' : sc.color === 'text-orange-500' ? '#f97316' : '#94a3b8'} />
                      <Badge className={`${sc.bg} ${sc.color} border-0`}>{sc.label}</Badge>
                    </View>
                  </View>

                  {/* 第二行：地址信息 */}
                  <View className="mt-3 flex flex-row items-start gap-2">
                    <View className="flex flex-col items-center gap-1 pt-1">
                      <Send size={12} color="#059669" />
                      <View className="w-1 h-4 bg-slate-200" />
                      <MapPin size={12} color="#2563eb" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="block text-xs text-slate-600 truncate">{order.sender?.formattedAddress || '寄件地址'}</Text>
                      <Text className="block text-xs text-slate-600 mt-2 truncate">{order.receiver?.formattedAddress || '收件地址'}</Text>
                    </View>
                  </View>

                  {/* 第三行：车型+模式+费用+时间 */}
                  <View className="mt-3 flex flex-row items-center justify-between">
                    <View className="flex flex-row items-center gap-2">
                      <Truck size={14} color="#64748b" />
                      <Text className="block text-xs text-slate-500">{order.vehicleId}</Text>
                      <View className="px-2 py-1 bg-slate-100 rounded">
                        <Text className="text-[10px] text-slate-500">{modeLabels[order.mode] || order.mode}</Text>
                      </View>
                    </View>
                    <View className="flex flex-row items-center gap-3">
                      {order.quote?.totalCents != null && (
                        <Text className="block text-sm font-semibold text-blue-600">{formatCents(order.quote.totalCents)}</Text>
                      )}
                      <Text className="block text-xs text-slate-400">{formatTime(order.createdAt)}</Text>
                    </View>
                  </View>
                </CardContent>
              </Card>
            )
          })}
        </View>
      )}
    </View>
  )
}
