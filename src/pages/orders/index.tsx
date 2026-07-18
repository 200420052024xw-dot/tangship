import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Truck, Clock3, CircleCheck, CircleX, Hourglass, Ban, Wallet, Loader, Send, MapPin, Inbox } from 'lucide-react-taro'
import { consumerRequest } from '@/services/consumer-api'
import { useSWR } from '@/stores/data-cache'

type Address = {
  role: string; contactName: string; phone: string
  formattedAddress: string; detailAddress: string
}
type Quote = { baseFeeCents: number; distanceFeeCents: number; vehicleFeeCents: number; serviceFeeCents: number; discountCents: number; totalFeeCents: number }
type OrderItem = { category: string; name: string; quantity: number; estimatedWeightKg: number }
type Order = {
  id: string; orderNo: string; vehicleId: string; vehicleName?: string
  mode: string; status: string; pickupType: string
  createdAt: string; scheduledAt?: string; quoteExpiresAt?: string
  addresses: Address[]; items: OrderItem[]; quote: Quote | null
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

/** Tab 分组：按用户视角而非系统状态 */
const TAB_FILTERS: Record<string, string[]> = {
  all:       [],
  pending:   ['pending_review', 'pending_payment'],
  active:    ['paid', 'dispatching', 'delivering'],
  completed: ['completed'],
  closed:    ['rejected', 'cancelled', 'quote_expired'],
}

const TAB_LABELS: Record<string, string> = {
  all: '全部', pending: '待处理', active: '进行中', completed: '已完成', closed: '已取消',
}

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

function getIconColor(colorClass: string): string {
  const map: Record<string, string> = {
    'text-amber-600': '#d97706', 'text-blue-600': '#2563eb', 'text-emerald-600': '#059669',
    'text-red-500': '#ef4444', 'text-slate-400': '#94a3b8', 'text-orange-500': '#f97316',
    'text-violet-600': '#7c3aed', 'text-indigo-600': '#4f46e5',
  }
  return map[colorClass] || '#94a3b8'
}

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState('all')
  const { data: orders, loading, refresh } = useSWR<Order[]>(
    'my-orders',
    async () => {
      const raw: any[] = await consumerRequest({ url: '/api/orders' })
      return raw.map((o: any) => ({
        ...o,
        orderNo: o.order_no,
        vehicleId: o.vehicle_id,
        vehicleName: o.vehicle_name,
        pickupType: o.pickup_type,
        createdAt: o.created_at,
        scheduledAt: o.scheduled_at,
        quoteExpiresAt: o.quote_expires_at,
        addresses: (o.addresses || []).map((a: any) => ({
          ...a,
          contactName: a.contact_name,
          formattedAddress: a.formatted_address,
          detailAddress: a.detail_address,
        })),
        items: (o.items || []).map((i: any) => ({
          ...i,
          estimatedWeightKg: i.estimated_weight_kg,
        })),
        quote: o.quote ? {
          ...o.quote,
          baseFeeCents: o.quote.base_fee_cents,
          distanceFeeCents: o.quote.distance_fee_cents,
          vehicleFeeCents: o.quote.vehicle_fee_cents,
          serviceFeeCents: o.quote.service_fee_cents,
          discountCents: o.quote.discount_cents,
          totalFeeCents: o.quote.total_fee_cents,
          distanceMeters: o.quote.distance_meters,
          expiresAt: o.quote.expires_at,
        } : null,
      }))
    },
    'dynamic'
  )
  useDidShow(() => { refresh() })

  const allOrders = orders || []

  /** 按 Tab 分组筛选 */
  const filteredOrders = activeTab === 'all'
    ? allOrders
    : allOrders.filter(o => (TAB_FILTERS[activeTab] || []).includes(o.status))

  /** 每个 Tab 的数量角标 */
  const tabCount = (tab: string) => {
    if (tab === 'all') return allOrders.length
    return allOrders.filter(o => (TAB_FILTERS[tab] || []).includes(o.status)).length
  }

  const renderEmpty = () => (
    <View className="flex flex-col items-center justify-center pt-16">
      <Inbox size={48} color="#cbd5e1" />
      <Text className="block text-slate-400 mt-4">暂无{TAB_LABELS[activeTab]}订单</Text>
    </View>
  )

  const renderList = () => (
    <View className="space-y-3">
      {filteredOrders.map(order => {
        const sc = statusConfig[order.status] || { label: order.status, color: 'text-slate-500', bg: 'bg-slate-50', icon: Clock3 }
        const StatusIcon = sc.icon
        const sender = order.addresses?.find(a => a.role === 'sender')
        const receiver = order.addresses?.find(a => a.role === 'receiver')
        const itemSummary = order.items?.length ? `${order.items[0].name}等${order.items.reduce((s, i) => s + i.quantity, 0)}件` : ''
        return (
          <Card key={order.id} onClick={() => Taro.navigateTo({ url: `/pages/order/detail/index?id=${order.id}` }).catch(() => Taro.showToast({ title: '打开失败', icon: 'none' }))}>
            <CardContent className="p-4">
              {/* 第一行：车型名 + 状态标签 */}
              <View className="flex flex-row items-center justify-between">
                <View className="flex flex-row items-center gap-2">
                  <Truck size={16} color="#475569" />
                  <Text className="block text-sm font-semibold text-slate-800">{order.vehicleName || order.vehicleId}</Text>
                </View>
                <View className="flex flex-row items-center gap-1">
                  <StatusIcon size={14} color={getIconColor(sc.color)} />
                  <Badge className={`${sc.bg} ${sc.color} border-0`}>{sc.label}</Badge>
                </View>
              </View>

              {/* 第二行：地址信息 */}
              <View className="mt-3 space-y-1">
                <View className="flex flex-row items-center gap-2">
                  <Send size={14} color="#059669" />
                  <Text className="block text-xs text-slate-600 truncate flex-1">{sender?.formattedAddress || '寄件地址'}</Text>
                </View>
                <View className="flex flex-row items-center gap-2">
                  <MapPin size={14} color="#2563eb" />
                  <Text className="block text-xs text-slate-600 truncate flex-1">{receiver?.formattedAddress || '收件地址'}</Text>
                </View>
              </View>

              {/* 第三行：物品摘要+费用+时间 */}
              <View className="mt-3 flex flex-row items-center justify-between">
                <Text className="block text-xs text-slate-400 truncate max-w-[50%]">{itemSummary}</Text>
                <View className="flex flex-row items-center gap-3">
                  {order.quote?.totalFeeCents != null && (
                    <Text className="block text-sm font-semibold text-blue-600">{formatCents(order.quote.totalFeeCents)}</Text>
                  )}
                  <Text className="block text-xs text-slate-400">{formatTime(order.createdAt)}</Text>
                </View>
              </View>
            </CardContent>
          </Card>
        )
      })}
    </View>
  )

  return (
    <View className="min-h-screen bg-slate-50">
      {/* 顶部栏 */}
      <View className="bg-white px-4 pt-4 pb-2 border-b border-slate-100">
        <Text className="block text-xl font-semibold text-slate-800">我的订单</Text>
      </View>

      {/* Tab 筛选栏 */}
      <View className="bg-white px-2 pb-0 border-b border-slate-100">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full">
            {Object.keys(TAB_FILTERS).map(tab => (
              <TabsTrigger key={tab} value={tab} className="flex-1 relative">
                <Text className="block">{TAB_LABELS[tab]}</Text>
                {tabCount(tab) > 0 && (
                  <View className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-red-500 flex items-center justify-center px-1">
                    <Text className="block text-white text-[10px] leading-none">{tabCount(tab)}</Text>
                  </View>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </View>

      {/* 内容区 */}
      <View className="p-4">
        {loading ? (
          <View className="space-y-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </View>
        ) : !filteredOrders.length ? (
          renderEmpty()
        ) : (
          renderList()
        )}
      </View>
    </View>
  )
}
