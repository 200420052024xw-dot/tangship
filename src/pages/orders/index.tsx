import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, Clock3, CircleCheck, CircleX, Hourglass, Ban, Wallet, Loader, Truck, MapPin, ChevronRight } from 'lucide-react-taro'
import { consumerRequest } from '@/services/consumer-api'
import { useSWR } from '@/stores/data-cache'

type Order = {
  id: string; orderNo: string; vehicleId: string; mode: string; status: string
  createdAt: string; quoteExpiresAt?: string
  sender?: { formattedAddress: string }; receiver?: { formattedAddress: string }
  quote?: { totalCents: number }
}

/* ── 统一状态配置：蓝色系=进行中，绿色=完成，灰色=终态 ── */
const statusConfig: Record<string, { label: string; color: string; bg: string; dotColor: string; icon: typeof Clock3 }> = {
  pending_review:  { label: '待确认',  color: 'text-amber-700',  bg: 'bg-amber-50',   dotColor: '#f59e0b', icon: Hourglass },
  pending_payment: { label: '待支付',  color: 'text-blue-700',   bg: 'bg-blue-50',    dotColor: '#3b82f6', icon: Wallet },
  paid:            { label: '已支付',  color: 'text-blue-700',   bg: 'bg-blue-50',    dotColor: '#3b82f6', icon: CircleCheck },
  dispatching:     { label: '调度中',  color: 'text-blue-700',   bg: 'bg-blue-50',    dotColor: '#3b82f6', icon: Loader },
  delivering:      { label: '配送中',  color: 'text-blue-700',   bg: 'bg-blue-50',    dotColor: '#3b82f6', icon: Truck },
  completed:       { label: '已完成',  color: 'text-emerald-700', bg: 'bg-emerald-50', dotColor: '#10b981', icon: CircleCheck },
  rejected:        { label: '已拒绝',  color: 'text-slate-500',  bg: 'bg-slate-100',  dotColor: '#94a3b8', icon: CircleX },
  cancelled:       { label: '已取消',  color: 'text-slate-500',  bg: 'bg-slate-100',  dotColor: '#94a3b8', icon: Ban },
  quote_expired:   { label: '报价过期', color: 'text-slate-500', bg: 'bg-slate-100',  dotColor: '#94a3b8', icon: Clock3 },
}

const modeLabels: Record<string, string> = { single: '散单', monthly: '包月', rental: '租购', purchase: '购买' }

function formatRelative(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}小时前`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}天前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatCents(cents: number) {
  return `¥${(cents / 100).toFixed(0)}`
}

export default function OrdersPage() {
  const { data: orders, loading, refresh } = useSWR<Order[]>(
    'my-orders', () => consumerRequest({ url: '/api/orders' }), 'dynamic'
  )
  useDidShow(() => { refresh() })

  const orderList = orders || []

  return (
    <View className="min-h-screen bg-gray-100">
      {/* 顶部栏 */}
      <View className="bg-white px-5 pt-5 pb-4">
        <Text className="block text-xl font-bold text-slate-800">我的订单</Text>
        {!loading && <Text className="block text-xs text-slate-400 mt-1">共 {orderList.length} 条记录</Text>}
      </View>

      {loading ? (
        <View className="p-4 space-y-3">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </View>
      ) : !orderList.length ? (
        <View className="flex flex-col items-center justify-center pt-28">
          <Package size={56} color="#cbd5e1" />
          <Text className="block text-slate-400 mt-4 text-base">暂无订单</Text>
          <Text className="block text-xs text-slate-300 mt-2">去首页选择车型开始下单</Text>
        </View>
      ) : (
        <View className="px-4 pt-3 space-y-3 pb-24">
          {orderList.map(order => {
            const sc = statusConfig[order.status] || { label: order.status, color: 'text-slate-500', bg: 'bg-slate-50', dotColor: '#94a3b8', icon: Clock3 }
            const isActive = ['pending_review', 'pending_payment', 'paid', 'dispatching', 'delivering'].includes(order.status)
            return (
              <View
                key={order.id}
                className="bg-white rounded-2xl overflow-hidden"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                onClick={() => Taro.navigateTo({ url: `/pages/order/detail/index?id=${order.id}` }).catch(() => Taro.showToast({ title: '打开失败', icon: 'none' }))}
              >
                {/* 顶部色条 - 进行中蓝色，已完成绿色，终态灰色 */}
                <View className={`h-1 ${isActive ? 'bg-blue-500' : order.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-300'}`} />

                <View className="px-4 pt-3 pb-3">
                  {/* 第一行：订单号 + 状态标签 */}
                  <View className="flex flex-row items-center justify-between">
                    <Text className="block text-xs text-slate-400">{order.orderNo}</Text>
                    <View className={`${sc.bg} px-2 py-0.5 rounded-full flex flex-row items-center gap-1`}>
                      <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dotColor }} />
                      <Text className={`block text-xs font-medium ${sc.color}`}>{sc.label}</Text>
                    </View>
                  </View>

                  {/* 地址流：发货 → 收货 */}
                  <View className="mt-3 flex flex-row items-start">
                    {/* 竖线装饰 */}
                    <View className="flex flex-col items-center mr-3 pt-1">
                      <View className="w-2 h-2 rounded-full bg-blue-500" style={{ borderWidth: 2, borderColor: '#bfdbfe' }} />
                      <View className="w-0.5 h-5 bg-slate-200" />
                      <MapPin size={12} color="#ef4444" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="block text-sm text-slate-700 truncate">{order.sender?.formattedAddress || '寄件地址'}</Text>
                      <Text className="block text-sm text-slate-700 mt-3 truncate">{order.receiver?.formattedAddress || '收件地址'}</Text>
                    </View>
                  </View>

                  {/* 底部：车型+模式 | 价格+时间 */}
                  <View className="mt-3 flex flex-row items-center justify-between">
                    <View className="flex flex-row items-center gap-2">
                      <Truck size={13} color="#94a3b8" />
                      <Text className="block text-xs text-slate-500">{order.vehicleId}</Text>
                      <View className="px-1.5 py-0.5 bg-slate-100 rounded">
                        <Text className="text-[10px] text-slate-400">{modeLabels[order.mode] || order.mode}</Text>
                      </View>
                    </View>
                    <View className="flex flex-row items-center gap-2">
                      {order.quote?.totalCents != null && (
                        <Text className="block text-base font-bold text-blue-600">{formatCents(order.quote.totalCents)}</Text>
                      )}
                    </View>
                  </View>

                  {/* 最底部时间 */}
                  <View className="mt-2 flex flex-row items-center justify-between">
                    <Text className="block text-[10px] text-slate-300">{formatRelative(order.createdAt)}</Text>
                    <ChevronRight size={14} color="#cbd5e1" />
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
