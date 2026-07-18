import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { consumerRequest } from '@/services/consumer-api'
import { useSWR } from '@/stores/data-cache'

type Order = { id: string; orderNo: string; vehicleId: string; status: string; createdAt: string }
const labels: Record<string, string> = { pending_review: '待后台确认', pending_payment: '待支付', rejected: '已拒绝', quote_expired: '报价过期', cancelled: '已取消', paid: '已支付', dispatching: '调度中', delivering: '配送中', completed: '已完成' }

export default function OrdersPage() {
  const { data: orders, loading, refresh } = useSWR<Order[]>(
    'my-orders', () => consumerRequest({ url: '/api/orders' }), 'dynamic'
  )
  useDidShow(() => { refresh() })

  return (
    <View className="min-h-screen bg-slate-50 p-4 space-y-3">
      <Text className="block text-xl font-semibold">我的订单</Text>
      {loading ? <><Skeleton className="h-28" /><Skeleton className="h-28" /></>
        : !(orders || []).length ? <Card><CardContent className="p-8"><Text className="block text-center text-slate-500">暂无订单，先去选择车型下单吧</Text></CardContent></Card>
        : (orders || []).map(order => (
          <Card key={order.id} onClick={() => Taro.navigateTo({ url: `/pages/order/detail/index?id=${order.id}` }).catch(() => Taro.showToast({ title: '订单详情打开失败', icon: 'none' }))}>
            <CardContent className="p-4">
              <View className="flex justify-between"><Text className="block font-medium">{order.orderNo}</Text><Badge>{labels[order.status] || order.status}</Badge></View>
              <Text className="block text-sm text-slate-500 mt-2">车型：{order.vehicleId}</Text>
              <Text className="block text-xs text-slate-400 mt-1">{order.createdAt}</Text>
            </CardContent>
          </Card>
        ))
      }
    </View>
  )
}
