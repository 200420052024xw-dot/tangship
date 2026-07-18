import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ChevronRight, ClipboardList, MapPinHouse, User } from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { consumerRequest } from '@/services/consumer-api'
import { useSWR } from '@/stores/data-cache'

type UserInfo = { nickname: string; openid: string }
type Order = { status: string }

export default function ProfilePage() {
  const { data: user, loading: loadingUser, refresh: refreshUser } = useSWR<UserInfo>(
    'user-info', () => consumerRequest({ url: '/api/auth/me' }), 'session'
  )
  const { data: orders, loading: loadingOrders, refresh: refreshOrders } = useSWR<Order[]>(
    'my-orders', () => consumerRequest({ url: '/api/orders' }), 'dynamic'
  )
  useDidShow(() => { refreshUser(); refreshOrders() })

  const pending = (orders || []).filter(order => order.status === 'pending_review').length
  const payment = (orders || []).filter(order => order.status === 'pending_payment').length
  const unavailable = () => Taro.showToast({ title: '本阶段暂未开放', icon: 'none' })
  const loading = loadingUser && loadingOrders

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      {/* 用户信息卡片 */}
      <Card className="mx-4 mt-4 rounded-2xl">
        <CardContent className="flex flex-row items-center gap-4 p-5">
          <View className="flex h-14 w-14 items-center justify-center rounded-full bg-primary bg-opacity-10">
            <User size={28} color="var(--primary)" />
          </View>
          <View className="flex-1">
            {loading ? (
              <Skeleton className="h-5 w-24 rounded" />
            ) : (
              <>
                <Text className="block text-lg font-semibold">{user?.nickname || '用户'}</Text>
                <Text className="block text-sm text-gray-400 mt-1">九识智能配送</Text>
              </>
            )}
          </View>
          <ChevronRight size={18} color="#9ca3af" />
        </CardContent>
      </Card>

      {/* 订单统计 */}
      <Card className="mx-4 mt-3 rounded-2xl">
        <CardContent className="flex flex-row justify-around p-5">
          <View className="flex flex-col items-center gap-1" onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}>
            <ClipboardList size={22} color="var(--primary)" />
            <Text className="block text-xs text-gray-500 mt-1">待审核</Text>
            {pending > 0 && <Badge variant="destructive" className="mt-1">{pending}</Badge>}
          </View>
          <View className="flex flex-col items-center gap-1" onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}>
            <ClipboardList size={22} color="#f59e0b" />
            <Text className="block text-xs text-gray-500 mt-1">待支付</Text>
            {payment > 0 && <Badge variant="destructive" className="mt-1">{payment}</Badge>}
          </View>
          <View className="flex flex-col items-center gap-1" onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}>
            <ClipboardList size={22} color="#10b981" />
            <Text className="block text-xs text-gray-500 mt-1">全部</Text>
          </View>
        </CardContent>
      </Card>

      {/* 菜单 */}
      <Card className="mx-4 mt-3 rounded-2xl">
        <CardContent className="p-0">
          <View className="flex flex-row items-center justify-between px-5 py-4 border-b border-gray-100" onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}>
            <View className="flex flex-row items-center gap-3">
              <ClipboardList size={18} color="#6b7280" />
              <Text className="block text-sm">我的订单</Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
          <View className="flex flex-row items-center justify-between px-5 py-4 border-b border-gray-100" onClick={() => Taro.navigateTo({ url: '/pages/address/list/index' })}>
            <View className="flex flex-row items-center gap-3">
              <MapPinHouse size={18} color="#6b7280" />
              <Text className="block text-sm">地址簿</Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
          <View className="flex flex-row items-center justify-between px-5 py-4" onClick={unavailable}>
            <View className="flex flex-row items-center gap-3">
              <ClipboardList size={18} color="#6b7280" />
              <Text className="block text-sm">优惠券</Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
        </CardContent>
      </Card>

      <Card className="mx-4 mt-3 rounded-2xl">
        <CardContent className="p-0">
          <View className="flex flex-row items-center justify-between px-5 py-4 border-b border-gray-100" onClick={unavailable}>
            <View className="flex flex-row items-center gap-3">
              <ClipboardList size={18} color="#6b7280" />
              <Text className="block text-sm">企业包月</Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
          <View className="flex flex-row items-center justify-between px-5 py-4" onClick={unavailable}>
            <View className="flex flex-row items-center gap-3">
              <ClipboardList size={18} color="#6b7280" />
              <Text className="block text-sm">租购咨询</Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
        </CardContent>
      </Card>
    </View>
  )
}
