import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ChevronRight, CircleCheck, CircleUser, ClipboardCheck, MapPinHouse, Package, Ticket, Truck, Wallet } from 'lucide-react-taro'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { consumerRequest } from '@/services/consumer-api'
import { useSWR } from '@/stores/data-cache'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ORDER_INITIAL_TAB_KEY } from '@/constants/order-display'
import { DEMO_ORDER_STATS, DEMO_USER } from '@/data/demo'

type UserInfo = { nickname: string; openid: string }
type OrderStats = { pendingPayment: number; pendingReview: number; active: number; completed: number; totalSpent: number }

export default function ProfilePage() {
  const { data: user, loading: loadingUser, refresh: refreshUser } = useSWR<UserInfo>(
    'user-info-demo-v2', async () => {
      try { return await consumerRequest<UserInfo>({ url: '/api/auth/me' }) } catch { return DEMO_USER }
    }, 'session'
  )
  const { data: stats, refresh: refreshStats } = useSWR<OrderStats>(
    'order-stats-demo-v2', async () => {
      try {
        const result = await consumerRequest<OrderStats>({ url: '/api/orders/stats' })
        return result || DEMO_ORDER_STATS
      } catch { return DEMO_ORDER_STATS }
    }, 'dynamic'
  )
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  useDidShow(() => { refreshUser(); refreshStats() })

  const isLoggedIn = !!user?.openid
  const loading = loadingUser

  const handleLogin = () => Taro.navigateTo({ url: '/pages/login/index' })

  const handleUserClick = () => {
    if (!isLoggedIn) return handleLogin()
    setEditName(user?.nickname || '')
    setShowUserDialog(true)
  }

  const handleSaveName = async () => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await consumerRequest({ url: '/api/auth/profile', method: 'PATCH', data: { nickname: editName.trim() } })
      await refreshUser()
      setShowUserDialog(false)
      Taro.showToast({ title: '修改成功', icon: 'success' })
    } catch {
      Taro.showToast({ title: '修改失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const openOrders = (tab = 'all') => {
    Taro.setStorageSync(ORDER_INITIAL_TAB_KEY, tab)
    Taro.switchTab({ url: '/pages/orders/index' })
  }

  const statusItems: Array<{ label: string; count: number; tab: string; icon: React.ReactNode }> = [
    { label: '待审核', count: stats?.pendingReview || 0, tab: 'pending', icon: <ClipboardCheck size={24} color="#F59E0B" /> },
    { label: '待支付', count: stats?.pendingPayment || 0, tab: 'pending', icon: <Wallet size={24} color="#2088D8" /> },
    { label: '配送中', count: stats?.active || 0, tab: 'active', icon: <Truck size={24} color="#4F46E5" /> },
    { label: '已完成', count: stats?.completed || 0, tab: 'completed', icon: <CircleCheck size={24} color="#059669" /> },
  ]

  return (
    <View className="min-h-screen bg-background pb-20">
      {/* 用户信息 */}
      <View className="bg-white px-5 pb-6 pt-7">
        <View className="flex flex-row items-center gap-4" onClick={handleUserClick}>
          <Avatar className="h-16 w-16 bg-blue-50">
            <AvatarFallback><CircleUser size={34} color="#2088D8" /></AvatarFallback>
          </Avatar>
          <View className="flex-1">
            {loading ? (
              <Skeleton className="h-5 w-24 rounded" />
            ) : isLoggedIn ? (
              <>
                <Text className="block text-lg font-semibold">{user?.nickname || '用户'}</Text>
                <Text className="block text-sm text-gray-400 mt-1">唐小识无人配送</Text>
              </>
            ) : (
              <Text className="block text-lg font-semibold text-primary">微信快捷登录</Text>
            )}
          </View>
          <ChevronRight size={18} color="#9ca3af" />
        </View>
      </View>

      {/* 订单状态 */}
      <Card className="mx-4 mt-3">
        <CardContent className="p-4">
          <View className="flex flex-row items-center justify-between mb-3">
            <Text className="block text-base font-semibold">我的订单</Text>
            <View className="flex flex-row items-center" onClick={() => openOrders('all')}>
              <Text className="block text-sm text-gray-400">全部</Text>
              <ChevronRight size={14} color="#9ca3af" />
            </View>
          </View>
          <View className="flex flex-row justify-around">
            {statusItems.map(item => (
              <View key={item.label} className="flex flex-1 flex-col items-center border-r border-slate-100 last:border-r-0" onClick={() => openOrders(item.tab)}>
                <View className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50">
                  {item.icon}
                </View>
                <Text className="block text-xs text-slate-600 mb-1">{item.label}</Text>
                <Text className="block text-xs font-semibold text-slate-800">{item.count}</Text>
              </View>
            ))}
          </View>
        </CardContent>
      </Card>

      {/* 消费金额 */}
      <Card className="mx-4 mt-3">
        <CardContent className="flex flex-row items-center justify-between p-4">
          <Text className="block text-sm text-slate-600">累计消费金额</Text>
          <Text className="block text-lg font-semibold text-primary">¥{((stats?.totalSpent || 0) / 100).toFixed(2)}</Text>
        </CardContent>
      </Card>

      {/* 菜单 */}
      <Card className="mx-4 mt-3">
        <CardContent className="p-0">
          <MenuRow icon={<Package size={19} color="#2088D8" />} label="我的订单" onClick={() => openOrders('all')} />
          <MenuRow icon={<MapPinHouse size={19} color="#2088D8" />} label="地址簿" onClick={() => Taro.navigateTo({ url: '/pages/address/list/index' })} />
          <View className="flex flex-row items-center justify-between px-5 py-4" onClick={() => Taro.showToast({ title: '暂未开放', icon: 'none' })}>
            <View className="flex flex-row items-center gap-3">
              <Ticket size={18} color="#6b7280" />
              <Text className="block text-sm">优惠券</Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
        </CardContent>
      </Card>

      {/* 用户详情弹窗 */}
      {showUserDialog && (
        <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>个人信息</DialogTitle>
            </DialogHeader>
            <View className="space-y-4 py-4">
              <View>
                <Text className="block text-sm text-gray-500 mb-1">用户ID</Text>
                <Text className="block text-sm text-gray-800 font-mono">{user?.openid || ''}</Text>
              </View>
              <View>
                <Text className="block text-sm text-gray-500 mb-2">用户名</Text>
                <View className="bg-gray-50 rounded-lg px-3 py-2">
                  <Input
                    value={editName}
                    onInput={(e: any) => setEditName(e.detail.value)}
                    placeholder="请输入用户名"
                    className="w-full bg-transparent"
                  />
                </View>
              </View>
            </View>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUserDialog(false)}>
                <Text>取消</Text>
              </Button>
              <Button onClick={handleSaveName} disabled={saving || !editName.trim()}>
                <Text>{saving ? '保存中...' : '保存'}</Text>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </View>
  )
}

function MenuRow({ icon, label, hint, onClick, last = false }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void; last?: boolean }) {
  return (
    <View className={`flex items-center justify-between px-5 py-4 ${last ? '' : 'border-b border-slate-100'}`} onClick={onClick}>
      <View className="flex items-center gap-3">{icon}<Text className="block text-sm text-slate-800">{label}</Text></View>
      <View className="flex items-center gap-2">{hint && <Text className="block text-xs text-slate-400">{hint}</Text>}<ChevronRight size={16} color="#CBD5E1" /></View>
    </View>
  )
}
