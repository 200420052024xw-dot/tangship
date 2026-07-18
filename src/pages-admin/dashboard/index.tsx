import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { adminRequest, getAdminInfo, logoutAdmin } from '@/services/admin-api'

type Dashboard = { pendingReview: number; pendingPayment: number; todayNew: number; rejected: number }
export default function AdminDashboard() {
  const [data, setData] = useState<Dashboard>(), [error, setError] = useState('')
  useDidShow(() => { adminRequest<Dashboard>({ url: '/api/admin/dashboard' }).then(setData).catch(reason => setError((reason as Error).message)) })
  const go = (url: string) => Taro.navigateTo({ url }).catch(() => Taro.showToast({ title: '页面打开失败，请重新编译小程序', icon: 'none' }))
  const exit = async () => { await logoutAdmin(); await Taro.switchTab({ url: '/pages/index/index' }) }
  if (!data && !error) return <View className="p-4 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-40" /></View>
  return <View className="min-h-screen bg-slate-50 p-4 space-y-4"><Card><CardContent className="p-4"><Text className="block text-xl font-semibold">管理员工作台</Text><Text className="block mt-1 text-sm text-slate-500">{getAdminInfo()?.username} · {getAdminInfo()?.role}</Text></CardContent></Card>{error ? <Card><CardContent className="p-4"><Text className="block text-red-600">{error}</Text></CardContent></Card> : <View className="grid grid-cols-2 gap-3"><Metric label="待审核" value={data?.pendingReview || 0} /><Metric label="待支付" value={data?.pendingPayment || 0} /><Metric label="今日新增" value={data?.todayNew || 0} /><Metric label="已拒绝" value={data?.rejected || 0} /></View>}<View className="space-y-3"><Button className="w-full" onClick={() => go('/pages-admin/orders/index')}><Text>订单管理与审核</Text></Button><Button className="w-full" variant="outline" onClick={() => go('/pages-admin/reviews/index')}><Text>审核记录</Text></Button><Button className="w-full" variant="outline" onClick={() => go('/pages-admin/settings/index')}><Text>车型与计费设置</Text></Button><Button className="w-full" variant="secondary" onClick={exit}><Text>进入用户端</Text></Button></View></View>
}
function Metric({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-4"><Text className="block text-sm text-slate-500">{label}</Text><Text className="block mt-2 text-2xl font-bold text-blue-600">{value}</Text></CardContent></Card> }
