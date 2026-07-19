import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useMemo, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Truck, Clock3, CircleCheck, CircleX, Hourglass, Ban, Wallet, Loader, Inbox, Trash2 } from 'lucide-react-taro'
import { consumerRequest } from '@/services/consumer-api'
import { useSWR } from '@/stores/data-cache'
import { ORDER_INITIAL_TAB_KEY, ORDER_TAB_FILTERS as TAB_FILTERS, ORDER_TAB_LABELS as TAB_LABELS } from '@/constants/order-display'
import { primeOrderDetail, removeOrderSnapshots } from '@/services/order-detail'
import { FixedActionBar } from '@/components/layout/fixed-action-bar'

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

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const year = d.getFullYear() === now.getFullYear() ? '' : `${d.getFullYear()}年`
  return `${year}${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const didShowOnceRef = useRef(false)
  const { data: orders, loading, refresh } = useSWR<Order[]>(
    'my-orders-demo-v2',
    async () => {
      let raw: any[]
      const result = await consumerRequest<any[]>({ url: '/api/orders' })
      console.log('[Orders] list response:', result)
      raw = Array.isArray(result) ? result : []
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
          totalFeeCents: o.quote.total_fee_cents ?? o.quote.total_cents,
          distanceMeters: o.quote.distance_meters,
          expiresAt: o.quote.expires_at,
        } : null,
      }))
    },
    'dynamic'
  )
  useDidShow(() => {
    const initialTab = Taro.getStorageSync(ORDER_INITIAL_TAB_KEY)
    if (typeof initialTab === 'string' && TAB_FILTERS[initialTab]) {
      setActiveTab(initialTab)
      Taro.removeStorageSync(ORDER_INITIAL_TAB_KEY)
    }
    if (didShowOnceRef.current) refresh()
    else didShowOnceRef.current = true
  })

  const allOrders = (orders || []).filter(order => !deletedIds.has(order.id))

  /** 按 Tab 分组筛选 */
  const filteredOrders = activeTab === 'all'
    ? allOrders
    : allOrders.filter(o => (TAB_FILTERS[activeTab] || []).includes(o.status))

  /** 当前筛选的统计 */
  const stats = useMemo(() => {
    const count = filteredOrders.length
    const totalCents = filteredOrders.reduce((sum, o) => sum + (o.quote?.totalFeeCents || 0), 0)
    return { count, totalCents }
  }, [filteredOrders])

  const toggleSelecting = () => {
    setSelecting(current => !current)
    setSelectedIds(new Set())
  }

  const toggleSelected = (id: string) => {
    setSelectedIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDelete = async () => {
    if (!selectedIds.size || deleting) return
    const ids = [...selectedIds]
    const realIds = ids.filter(id => !id.startsWith('demo-'))
    setDeleting(true)
    try {
      if (realIds.length) {
        await consumerRequest<{ deletedIds: string[] }>({
          url: '/api/orders',
          method: 'DELETE',
          data: { ids: realIds },
        })
      }
      setDeletedIds(current => new Set([...current, ...ids]))
      removeOrderSnapshots(ids)
      setSelectedIds(new Set())
      setSelecting(false)
      Taro.showToast({ title: `已删除${ids.length}个订单`, icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '删除失败', icon: 'none' })
    } finally {
      setDeleting(false)
    }
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
          <Card
            key={order.id}
            className={selecting && selectedIds.has(order.id) ? 'border-primary bg-blue-50' : ''}
            onClick={() => {
              if (selecting) {
                toggleSelected(order.id)
              } else {
                primeOrderDetail(order)
                Taro.navigateTo({ url: `/pages/order/detail/index?id=${order.id}` })
                  .catch(() => Taro.showToast({ title: '打开失败', icon: 'none' }))
              }
            }}
          >
            <CardContent className="p-4">
              {/* 第一行：车型名 + 状态标签 */}
              <View className="flex flex-row items-center justify-between">
                <View className="flex flex-row items-center gap-2">
                  {selecting && <Checkbox checked={selectedIds.has(order.id)} />}
                  <Text className="block text-sm font-semibold text-slate-900">{order.vehicleName || order.vehicleId}</Text>
                </View>
                <View className="flex flex-row items-center gap-1">
                  <StatusIcon size={14} color={getIconColor(sc.color)} />
                  <Badge className={`${sc.bg} ${sc.color} border-0`}>{sc.label}</Badge>
                </View>
              </View>

              {/* 第二行：地址信息 */}
              <View className="mt-3 space-y-1">
                <View className="flex flex-row items-center gap-2">
                  <View className="h-2 w-2 rounded-full bg-emerald-500" />
                  <Text className="block text-xs text-slate-600 truncate flex-1">{sender?.formattedAddress || '寄件地址'}</Text>
                </View>
                <View className="flex flex-row items-center gap-2">
                  <View className="h-2 w-2 rounded-full bg-red-500" />
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
    <View className={`min-h-screen bg-background ${selecting ? 'pb-36' : ''}`}>
      {/* Tab 筛选栏 */}
      <View className="border-b border-slate-100 bg-white px-2 pt-2">
        <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value); setSelectedIds(new Set()) }} className="w-full">
          <TabsList className="h-11 w-full rounded-none bg-white p-0">
            {Object.keys(TAB_FILTERS).map(tab => (
              <TabsTrigger key={tab} value={tab} className="h-11 flex-1 rounded-none data-active:border-b-2">
                <Text className="block">{TAB_LABELS[tab]}</Text>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </View>

      {/* 统计条 + 删除 */}
      {!loading && (
        <View className="flex flex-row items-center justify-between px-4 py-2 bg-white border-b border-slate-100">
          <View className="flex flex-row items-center gap-4">
            <Text className="block text-xs text-slate-500">共 <Text className="text-sm font-semibold text-slate-700">{stats.count}</Text> 单</Text>
            {stats.totalCents > 0 && (
              <Text className="block text-xs text-slate-500">合计 <Text className="text-sm font-semibold text-blue-600">{formatCents(stats.totalCents)}</Text></Text>
            )}
          </View>
          <Button variant={selecting ? 'secondary' : 'ghost'} size="sm" onClick={toggleSelecting} className="px-2">
            <View className="flex flex-row items-center gap-1">
              <Trash2 size={14} color={selecting ? '#1868B8' : '#475569'} />
              <Text className="block text-xs text-slate-600">{selecting ? '取消' : '删除订单'}</Text>
            </View>
          </Button>
        </View>
      )}

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

      {selecting && (
        <FixedActionBar bottom={50} safeArea={false}>
          <View className="flex w-full flex-row items-center justify-between gap-4">
            <Text className="block min-w-0 flex-1 text-sm text-slate-600">已选择 {selectedIds.size} 个订单</Text>
            <Button
              className="shrink-0"
              variant="destructive"
              disabled={!selectedIds.size || deleting}
              onClick={() => {
                if (!selectedIds.size) { Taro.showToast({ title: '请先选择要删除的订单', icon: 'none' }); return }
                setDeleteDialogOpen(true)
              }}
            >
              <Text className="block">{deleting ? '删除中…' : '确认删除'}</Text>
            </Button>
          </View>
        </FixedActionBar>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle><Text className="block text-lg font-semibold">确认删除订单？</Text></AlertDialogTitle>
            <AlertDialogDescription>
              <Text className="block text-sm text-slate-500">将删除已选择的 {selectedIds.size} 个订单。删除后不会再显示在“我的订单”中。</Text>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel><Text className="block text-center">再想想</Text></AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}><Text className="block text-center">确认删除</Text></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  )
}
