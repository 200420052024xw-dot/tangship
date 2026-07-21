import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { adminRequest } from '@/services/admin-api'

type Inquiry = { id: string; type: 'monthly' | 'rental'; vehicleId?: string; contactName: string; phone: string; companyName?: string; consultContent?: string; deliveryCycle?: string; monthlyTrips?: number; status: 'pending' | 'contacted' | 'closed'; note?: string; createdAt: string }
type Page = { items: Inquiry[]; total: number }
const TYPE_LABEL = { monthly: '包月专线', rental: '租购服务' }
const STATUS_LABEL = { pending: '待处理', contacted: '已联系', closed: '已关闭' }

export default function AdminInquiries() {
  const type = (String(Taro.getCurrentInstance().router?.params.type || 'monthly') === 'rental' ? 'rental' : 'monthly') as Inquiry['type']
  const [rows, setRows] = useState<Inquiry[]>([]), [note, setNote] = useState<Record<string, string>>({}), [error, setError] = useState('')
  const load = () => adminRequest<Page>({ url: `/api/admin/operations/inquiries?page=1&pageSize=100&type=${type}` }).then(value => { setRows(value.items); setError('') }).catch(reason => setError((reason as Error).message))
  useDidShow(() => { void load() })
  const update = async (row: Inquiry, status: Inquiry['status']) => { try { await adminRequest({ url: `/api/admin/operations/inquiries/${row.id}/status`, method: 'PUT', data: { status, note: note[row.id] || row.note || '' } }); await Taro.showToast({ title: '状态已更新', icon: 'success' }); await load() } catch (reason) { setError((reason as Error).message) } }
  return <View className="min-h-screen bg-slate-50 p-4 space-y-3"><Card><CardContent className="p-4"><Text className="block text-lg font-semibold">{TYPE_LABEL[type]}咨询</Text><Text className="block mt-1 text-sm text-slate-500">共 {rows.length} 条，优先联系待处理客户。</Text></CardContent></Card>{error && <Card><CardContent className="p-4"><Text className="block text-red-600">{error}</Text></CardContent></Card>}{rows.map(row => <Card key={row.id}><CardContent className="p-4 space-y-3"><View className="flex justify-between"><View><Text className="block font-semibold">{row.contactName} · {row.phone}</Text><Text className="block mt-1 text-xs text-slate-500">{row.companyName || '个人客户'} · {new Date(row.createdAt).toLocaleString()}</Text></View><Badge variant={row.status === 'pending' ? 'destructive' : 'secondary'}>{STATUS_LABEL[row.status]}</Badge></View><Text className="block text-sm">车型：{row.vehicleId || '未选择'}</Text>{row.type === 'monthly' && <Text className="block text-sm text-slate-600">周期：{row.deliveryCycle || '未填写'} · 预计 {row.monthlyTrips || 0} 趟/月</Text>}{row.consultContent && <Text className="block text-sm text-slate-600">{row.consultContent}</Text>}<Textarea value={note[row.id] ?? row.note ?? ''} onInput={event => setNote(current => ({ ...current, [row.id]: event.detail.value }))} placeholder="填写跟进备注" /><View className="flex gap-2"><Button className="flex-1" variant="outline" onClick={() => update(row, 'contacted')}><Text>标记已联系</Text></Button><Button className="flex-1" variant="secondary" onClick={() => update(row, 'closed')}><Text>关闭咨询</Text></Button></View></CardContent></Card>)}{rows.length === 0 && !error && <Card><CardContent className="p-8 text-center"><Text className="block text-slate-500">暂无{TYPE_LABEL[type]}咨询</Text></CardContent></Card>}</View>
}
