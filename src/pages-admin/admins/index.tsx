import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { UserPlus, Trash2 } from 'lucide-react-taro'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { adminRequest, getAdminInfo } from '@/services/admin-api'

type WechatUser = {
  id: string
  nickname: string
  openid?: string
  status: string
  lastLoginAt: string
  bindingId?: string
  role?: 'super_admin' | 'operator' | 'finance'
}

type UserPage = {
  items: WechatUser[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function AdminOperators() {
  const [keyword, setKeyword] = useState('')
  const [data, setData] = useState<UserPage>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<WechatUser>()

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await adminRequest<UserPage>({ url: `/api/admin/wechat-users?page=1&pageSize=50&keyword=${encodeURIComponent(keyword.trim())}` })
      setData(result)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '加载微信用户失败')
    } finally {
      setLoading(false)
    }
  }

  useDidShow(() => { void load() })

  const grant = async (row: WechatUser) => {
    setBusyId(row.id)
    try {
      await adminRequest({ url: '/api/admin/wechat-bindings', method: 'POST', data: { userId: row.id, role: 'operator' } })
      await Taro.showToast({ title: '已添加为运营人员', icon: 'success' })
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '添加运营人员失败')
    } finally {
      setBusyId('')
    }
  }

  const remove = async () => {
    if (!deleteTarget?.bindingId) return
    const target = deleteTarget
    setDeleteTarget(undefined)
    setBusyId(target.id)
    try {
      await adminRequest({ url: `/api/admin/wechat-bindings/${target.bindingId}`, method: 'DELETE' })
      await Taro.showToast({ title: '运营授权已删除', icon: 'success' })
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '删除运营授权失败')
    } finally {
      setBusyId('')
    }
  }

  if (getAdminInfo()?.role !== 'super_admin') {
    return <View className="min-h-screen bg-slate-50 p-4"><Card><CardContent className="p-6"><Text className="block text-center text-red-600">仅超级管理员可以管理运营人员</Text></CardContent></Card></View>
  }

  return <View className="min-h-screen bg-slate-50 p-4 space-y-3">
    <Card><CardContent className="p-4 space-y-3">
      <View>
        <Text className="block text-lg font-semibold text-slate-900">微信运营人员</Text>
        <Text className="block mt-1 text-xs text-slate-500">目标用户需先登录一次小程序；这里只能添加运营角色</Text>
      </View>
      <View className="flex flex-row gap-2">
        <View className="flex-1"><Input value={keyword} onInput={event => setKeyword(event.detail.value)} placeholder="搜索昵称或用户 ID" /></View>
        <Button disabled={loading} onClick={() => void load()}><Text>查询</Text></Button>
      </View>
    </CardContent></Card>

    {error && <Card><CardContent className="p-4"><Text className="block text-sm text-red-600">{error}</Text></CardContent></Card>}
    {loading && !data ? <View className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></View> : data?.items.map(row => {
      const isSystemAdmin = row.role === 'super_admin'
      const isOperator = Boolean(row.bindingId) && !isSystemAdmin
      return <Card key={row.id}><CardContent className="p-4 space-y-3">
        <View className="flex flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="block font-semibold text-slate-900">{row.nickname || '微信用户'}</Text>
            <Text className="block mt-1 text-xs text-slate-500">{row.id}</Text>
            <Text className="block mt-1 text-xs text-slate-400">最近登录：{new Date(row.lastLoginAt).toLocaleString()}</Text>
          </View>
          <Badge variant={isSystemAdmin ? 'default' : isOperator ? 'secondary' : 'outline'}>{isSystemAdmin ? '系统管理员' : isOperator ? '运营' : '未授权'}</Badge>
        </View>
        {isSystemAdmin ? <Text className="block text-xs text-slate-400">系统管理员授权不可在此删除</Text> : isOperator ? <Button className="w-full" variant="destructive" disabled={busyId === row.id} onClick={() => setDeleteTarget(row)}><View className="flex flex-row items-center gap-2"><Trash2 size={16} color="#ffffff" /><Text>删除运营授权</Text></View></Button> : <Button className="w-full" disabled={busyId === row.id} onClick={() => void grant(row)}><View className="flex flex-row items-center gap-2"><UserPlus size={16} color="#ffffff" /><Text>添加为运营人员</Text></View></Button>}
      </CardContent></Card>
    })}
    {data && data.items.length === 0 && <Card><CardContent className="p-8"><Text className="block text-center text-slate-500">没有符合条件的微信用户</Text></CardContent></Card>}

    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open) setDeleteTarget(undefined) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除运营授权</AlertDialogTitle>
          <AlertDialogDescription>确认删除“{deleteTarget?.nickname || deleteTarget?.id}”的运营权限？删除后该微信用户将无法进入管理员工作台。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel><Text>取消</Text></AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void remove()}><Text>确认删除</Text></AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </View>
}
