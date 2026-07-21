import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { adminRequest } from '@/services/admin-api'

type Notification = { id: string; type: string; title: string; content: string; targetPath?: string; readAt?: string; createdAt: string }
type Page = { items: Notification[]; unreadCount: number }

export default function AdminNotifications() {
  const [data, setData] = useState<Page>({ items: [], unreadCount: 0 }), [error, setError] = useState('')
  const load = () => adminRequest<Page>({ url: '/api/admin/notifications?page=1&pageSize=100' }).then(value => { setData(value); setError('') }).catch(reason => setError((reason as Error).message))
  useDidShow(() => { void load() })
  const read = async (row: Notification) => { if (!row.readAt) await adminRequest({ url: `/api/admin/notifications/${row.id}/read`, method: 'PUT' }); if (row.targetPath?.startsWith('/orders')) await Taro.navigateTo({ url: '/pages-admin/orders/index' }); else if (row.targetPath?.includes('rental')) await Taro.navigateTo({ url: '/pages-admin/inquiries/index?type=rental' }); else if (row.targetPath?.includes('inquiries')) await Taro.navigateTo({ url: '/pages-admin/inquiries/index?type=monthly' }); else await load() }
  const readAll = async () => { try { await adminRequest({ url: '/api/admin/notifications/read-all', method: 'PUT' }); await load() } catch (reason) { setError((reason as Error).message) } }
  return <View className="min-h-screen bg-slate-50 p-4 space-y-3"><Card><CardContent className="p-4 flex justify-between items-center"><View><Text className="block text-lg font-semibold">通知中心</Text><Text className="block mt-1 text-sm text-slate-500">未读 {data.unreadCount} 条</Text></View><Button variant="outline" disabled={data.unreadCount === 0} onClick={readAll}><Text>全部已读</Text></Button></CardContent></Card>{error && <Text className="block text-red-600">{error}</Text>}{data.items.map(row => <Card key={row.id} onClick={() => read(row)}><CardContent className="p-4 space-y-2"><View className="flex justify-between"><Text className="block font-semibold">{row.title}</Text>{!row.readAt && <Badge>未读</Badge>}</View><Text className="block text-sm text-slate-600">{row.content}</Text><Text className="block text-xs text-slate-400">{new Date(row.createdAt).toLocaleString()}</Text></CardContent></Card>)}{data.items.length === 0 && <Card><CardContent className="p-8 text-center"><Text className="block text-slate-500">暂无通知</Text></CardContent></Card>}</View>
}
