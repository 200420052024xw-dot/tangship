import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { adminRequest, getAdminInfo, logoutAdmin } from '@/services/admin-api'

type Dashboard = {
  pendingReview: number
  pendingPayment: number
  paid: number
  dispatching: number
  delivering: number
  todayNew: number
  rejected: number
  pendingMonthly: number
  pendingRental: number
  unreadNotifications: number
  vehicleCapacity: Array<{ id: string; name: string; totalCount: number; reservedCount: number; availableCount: number; insufficient?: boolean }>
}
export default function AdminDashboard() {
  const [data, setData] = useState<Dashboard>(), [error, setError] = useState('')
  const admin = getAdminInfo()
  useDidShow(() => { adminRequest<Dashboard>({ url: '/api/admin/dashboard' }).then(setData).catch(reason => setError((reason as Error).message)) })
  const go = (url: string) => Taro.navigateTo({ url }).catch(() => Taro.showToast({ title: '页面打开失败，请重新编译小程序', icon: 'none' }))
  const exit = async () => { await logoutAdmin(); await Taro.switchTab({ url: '/pages/index/index' }) }
  if (!data && !error) return <View className="p-4 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-40" /></View>
  return <View className="min-h-screen bg-slate-50 p-4 space-y-4"><Card><CardContent className="p-4"><Text className="block text-xl font-semibold">管理员工作台</Text><Text className="block mt-1 text-sm text-slate-500">{admin?.username} · {admin?.role}</Text></CardContent></Card>{error ? <Card><CardContent className="p-4"><Text className="block text-red-600">{error}</Text></CardContent></Card> : <><View className="grid grid-cols-2 gap-3"><Metric label="待审核" value={data?.pendingReview || 0} /><Metric label="待派车" value={(data?.paid || 0) + (data?.dispatching || 0)} /><Metric label="包月待联系" value={data?.pendingMonthly || 0} /><Metric label="租购待联系" value={data?.pendingRental || 0} /></View><Card><CardContent className="p-4 space-y-3"><Text className="block font-semibold">车型参考数量</Text>{data?.vehicleCapacity?.map(vehicle => <View key={vehicle.id} className="relative flex justify-between border-b border-slate-100 py-2"><View><Text className="block text-sm font-medium">{vehicle.name}</Text><Text className="block text-xs text-slate-500">总量 {vehicle.totalCount} · 已预占 {vehicle.reservedCount}</Text>{vehicle.insufficient && <Text className="block text-xs text-red-600">当前预占超过总量</Text>}</View>{vehicle.availableCount <= 0 ? <Badge variant="destructive">余量 0 台</Badge> : <Text className="block text-lg font-semibold text-blue-600">可用 {vehicle.availableCount}</Text>}</View>)}</CardContent></Card></>}<View className="space-y-3"><Button className="w-full" onClick={() => go('/pages-admin/orders/index')}><Text>按趟订单与审核</Text></Button><Button className="w-full" variant="outline" onClick={() => go('/pages-admin/inquiries/index?type=monthly')}><Text>包月咨询（待处理 {data?.pendingMonthly || 0}）</Text></Button><Button className="w-full" variant="outline" onClick={() => go('/pages-admin/inquiries/index?type=rental')}><Text>租购咨询（待处理 {data?.pendingRental || 0}）</Text></Button><Button className="w-full" variant="outline" onClick={() => go('/pages-admin/notifications/index')}><Text>通知中心（未读 {data?.unreadNotifications || 0}）</Text></Button><Button className="w-full" variant="outline" onClick={() => go('/pages-admin/reviews/index')}><Text>审核记录</Text></Button>{admin?.role === 'super_admin' && <><Button className="w-full" variant="outline" onClick={() => go('/pages-admin/settings/index')}><Text>车型数量与计费设置</Text></Button><Button className="w-full" variant="outline" onClick={() => go('/pages-admin/admins/index')}><Text>运营人员授权</Text></Button></>}<Button className="w-full" variant="secondary" onClick={exit}><Text>进入用户端</Text></Button></View></View>
}
function Metric({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-4"><Text className="block text-sm text-slate-500">{label}</Text><Text className="block mt-2 text-2xl font-bold text-blue-600">{value}</Text></CardContent></Card> }
