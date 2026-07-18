import { Text, View } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { adminRequest } from '@/services/admin-api'

type Review = { id: string; action: string; orderNo: string; reviewer: string; created_at: string; totalCents?: number; rejectionReason?: string }
export default function Reviews() { const [rows, setRows] = useState<Review[]>([]), [error, setError] = useState(''); useLoad(() => { adminRequest<{ items: Review[] }>({ url: '/api/admin/reviews?page=1&pageSize=50' }).then(value => setRows(value.items)).catch(reason => setError((reason as Error).message)) }); return <View className="min-h-screen bg-slate-50 p-4 space-y-3">{error && <Text className="block text-red-600">{error}</Text>}{rows.map(row => <Card key={row.id}><CardContent className="p-4 space-y-1"><View className="flex justify-between"><Text className="block font-semibold">{row.orderNo}</Text><Badge variant={row.action === 'order.approve' ? 'default' : 'destructive'}>{row.action === 'order.approve' ? '已批准' : '已拒绝'}</Badge></View><Text className="block text-sm">审核人：{row.reviewer}</Text><Text className="block text-xs text-slate-500">{new Date(row.created_at).toLocaleString()}</Text>{row.totalCents != null && <Text className="block text-blue-600">报价：¥{(row.totalCents / 100).toFixed(2)}</Text>}{row.rejectionReason && <Text className="block text-red-600">{row.rejectionReason}</Text>}</CardContent></Card>)}</View> }
