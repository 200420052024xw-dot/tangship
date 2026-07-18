import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { adminRequest } from '@/services/admin-api'

type Row = { id: string; orderNo: string; status: string; contactName: string; phone: string; senderDistrict: string; receiverDistrict: string; createdAt: string }
type Page = { items: Row[]; page: number; totalPages: number; total: number }
export default function AdminOrders() {
  const [data, setData] = useState<Page>(), [keyword, setKeyword] = useState(''), [page, setPage] = useState(1), [error, setError] = useState('')
  const load = (nextPage = page) => adminRequest<Page>({ url: `/api/admin/orders?page=${nextPage}&pageSize=20&status=pending_review&keyword=${encodeURIComponent(keyword)}` }).then(value => { setData(value); setPage(nextPage); setError('') }).catch(reason => setError((reason as Error).message))
  useDidShow(() => { void load() })
  return <View className="min-h-screen bg-slate-50 p-4 space-y-3"><View className="flex gap-2"><Input value={keyword} onInput={event => setKeyword(event.detail.value)} placeholder="联系人或手机号" /><Button onClick={() => load(1)}><Text>搜索</Text></Button></View>{error && <Card><CardContent className="p-4"><Text className="block text-red-600">{error}</Text></CardContent></Card>}{data?.items.map(order => <Card key={order.id} onClick={() => Taro.navigateTo({ url: `/pages-admin/order-detail/index?id=${order.id}` })}><CardContent className="p-4 space-y-2"><View className="flex justify-between"><Text className="block font-semibold">{order.orderNo}</Text><Badge>待审核</Badge></View><Text className="block text-sm text-slate-600">{order.contactName} {order.phone}</Text><Text className="block text-sm text-slate-500">{order.senderDistrict || '—'} → {order.receiverDistrict || '—'}</Text><Text className="block text-xs text-slate-400">{new Date(order.createdAt).toLocaleString()}</Text></CardContent></Card>)}{data && data.items.length === 0 && <Card><CardContent className="p-8 text-center"><Text className="block text-slate-500">暂无待审核订单</Text></CardContent></Card>}<View className="flex justify-between"><Button variant="outline" disabled={page <= 1} onClick={() => load(page - 1)}><Text>上一页</Text></Button><Text className="block self-center text-sm">{page} / {Math.max(data?.totalPages || 1, 1)}</Text><Button variant="outline" disabled={page >= (data?.totalPages || 1)} onClick={() => load(page + 1)}><Text>下一页</Text></Button></View></View>
}
