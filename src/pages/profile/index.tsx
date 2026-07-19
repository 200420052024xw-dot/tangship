import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ChevronRight, CircleCheck, CircleUser, ClipboardCheck, MapPinHouse, Ticket, Truck, Wallet } from 'lucide-react-taro'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { consumerRequest } from '@/services/consumer-api'
import { useSWR } from '@/stores/data-cache'

type UserInfo = { nickname: string; openid: string }
type OrderStats = { pendingPayment: number; pendingReview: number; active: number; completed: number; totalSpent: number }

export default function ProfilePage() {
  const { data: user, loading: loadingUser, refresh: refreshUser } = useSWR<UserInfo>(
    'user-info', () => consumerRequest({ url: '/api/auth/me' }), 'session'
  )
  const { data: stats, refresh: refreshStats } = useSWR<OrderStats>(
    'order-stats', () => consumerRequest({ url: '/api/orders/stats' }), 'dynamic'
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

  const statusItems: Array<{ label: string; count: number; tab: string; color: string; icon: React.ReactNode }> = [
    { label: '待付款', count: stats?.pendingPayment || 0, tab: 'pending_payment', color: '#F59E0B', icon: <Wallet size={22} color="#F59E0B" /> },
    { label: '待审核', count: stats?.pendingReview || 0, tab: 'pending_review', color: '#3B82F6', icon: <ClipboardCheck size={22} color="#3B82F6" /> },
    { label: '进行中', count: stats?.active || 0, tab: 'active', color: '#10B981', icon: <Truck size={22} color="#10B981" /> },
    { label: '已完成', count: stats?.completed || 0, tab: 'completed', color: '#6B7280', icon: <CircleCheck size={22} color="#6B7280" /> },
  ]

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      {/* 用户信息 */}
      <View className="bg-white px-4 pt-6 pb-5">
        <View className="flex flex-row items-center gap-4" onClick={handleUserClick}>
          <View className="flex h-14 w-14 items-center justify-center rounded-full bg-primary bg-opacity-10">
            <CircleUser size={32} color="var(--primary)" />
          </View>
          <View className="flex-1">
            {loading ? (
              <Skeleton className="h-5 w-24 rounded" />
            ) : isLoggedIn ? (
              <>
                <Text className="block text-lg font-semibold">{user?.nickname || '用户'}</Text>
                <Text className="block text-sm text-gray-400 mt-1">点击查看详情</Text>
              </>
            ) : (
              <Text className="block text-lg font-semibold text-primary">微信快捷登录</Text>
            )}
          </View>
          <ChevronRight size={18} color="#9ca3af" />
        </View>
      </View>

      {/* 订单状态 */}
      <Card className="mx-4 mt-3 rounded-2xl">
        <CardContent className="p-4">
          <View className="flex flex-row items-center justify-between mb-3">
            <Text className="block text-base font-semibold">我的订单</Text>
            <View className="flex flex-row items-center" onClick={() => Taro.navigateTo({ url: '/pages/orders/index' })}>
              <Text className="block text-sm text-gray-400">全部</Text>
              <ChevronRight size={14} color="#9ca3af" />
            </View>
          </View>
          <View className="flex flex-row justify-around">
            {statusItems.map(item => (
              <View key={item.label} className="flex flex-col items-center" onClick={() => Taro.navigateTo({ url: `/pages/orders/index?tab=${item.tab}` })}>
                <View className="mb-2">
                  {item.icon}
                </View>
                <Text className="block text-xs text-slate-600 mb-1">{item.label}</Text>
                <Text className="block text-xs font-semibold text-slate-800">{item.count}</Text>
              </View>
            ))}
          </View>
        </CardContent>
      </Card>

      {/* 消费统计 */}
      <Card className="mx-4 mt-3 rounded-2xl">
        <CardContent className="p-5">
          <Text className="block text-sm text-gray-400 mb-1">累计消费</Text>
          <View className="flex flex-row items-baseline gap-1">
            <Text className="block text-sm text-gray-500">¥</Text>
            <Text className="block text-2xl font-bold text-gray-900">{((stats?.totalSpent || 0) / 100).toFixed(2)}</Text>
          </View>
        </CardContent>
      </Card>

      {/* 菜单 */}
      <Card className="mx-4 mt-3 rounded-2xl">
        <CardContent className="p-0">
          <View className="flex flex-row items-center justify-between px-5 py-4 border-b border-gray-100" onClick={() => Taro.navigateTo({ url: '/pages/address/list/index' })}>
            <View className="flex flex-row items-center gap-3">
              <MapPinHouse size={18} color="#6b7280" />
              <Text className="block text-sm">地址簿</Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
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
