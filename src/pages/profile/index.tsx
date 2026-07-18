import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { ChevronRight, ClipboardList, MapPinHouse, User } from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { consumerRequest } from '@/services/consumer-api'

type UserInfo = { nickname: string; openid: string }
type Order = { status: string }
export default function ProfilePage() {
  const [user, setUser] = useState<UserInfo>(), [orders, setOrders] = useState<Order[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('')
  useDidShow(() => { setLoading(true); Promise.all([consumerRequest<UserInfo>({ url: '/api/auth/me' }), consumerRequest<Order[]>({ url: '/api/orders' })]).then(([me, rows]) => { setUser(me); setOrders(rows); setError('') }).catch(reason => setError(reason instanceof Error ? reason.message : '用户信息加载失败')).finally(() => setLoading(false)) })
  const pending = orders.filter(order => order.status === 'pending_review').length
  const payment = orders.filter(order => order.status === 'pending_payment').length
  const unavailable = () => Taro.showToast({ title: '本阶段暂未开放', icon: 'none' })
  if (loading) return <View className="p-4 space-y-3"><Skeleton className="h-24" /><Skeleton className="h-36" /></View>
  return <View className="min-h-screen bg-slate-50 p-4 space-y-3"><Card><CardContent className="p-4"><View className="flex items-center gap-4"><View className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center"><User size={28} color="#2088D8" /></View><View><Text className="block text-lg font-semibold">{user?.nickname || '开发用户'}</Text><Text className="block text-xs text-slate-500 mt-1">{error || '当前为 SQLite 开发身份'}</Text></View></View></CardContent></Card><View className="grid grid-cols-3 gap-3"><Stat label="全部订单" value={orders.length} /><Stat label="待审核" value={pending} /><Stat label="待支付" value={payment} /></View><Card><CardContent className="p-0"><Menu icon={<ClipboardList size={20} color="#2088D8" />} label="我的订单" onClick={() => Taro.switchTab({ url: '/pages/orders/index' })} /><Menu icon={<MapPinHouse size={20} color="#10B981" />} label="地址簿" onClick={() => Taro.navigateTo({ url: '/pages/address/list/index?usage=both' })} /><Menu label="优惠券" disabled onClick={unavailable} /><Menu label="企业包月" disabled onClick={unavailable} /><Menu label="租购咨询" disabled onClick={unavailable} /></CardContent></Card></View>
}
function Stat({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-3 text-center"><Text className="block text-xl font-bold text-blue-600">{value}</Text><Text className="block text-xs text-slate-500 mt-1">{label}</Text></CardContent></Card> }
function Menu({ icon, label, disabled, onClick }: { icon?: React.ReactNode; label: string; disabled?: boolean; onClick: () => void }) { return <View className="flex items-center justify-between p-4 border-b border-slate-100" onClick={onClick}><View className="flex items-center gap-3">{icon}<Text className="block text-sm">{label}</Text>{disabled && <Badge variant="outline">暂未开放</Badge>}</View><ChevronRight size={16} color="#94A3B8" /></View> }
