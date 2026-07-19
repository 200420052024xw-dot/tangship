/**
 * 地址簿列表
 *
 * 路由参数:
 * - usage: 'sender' | 'receiver' | 'both' — 当前使用场景(由下单页传入)
 * - select: '1' — 表示当前为"选择模式",选中后通过 EventChannel 回传
 *
 * 非"选择模式"时仍可管理地址(编辑、删除、设默认)
 */

import { View, Text } from '@tarojs/components'
import { useRef, useState } from 'react'
import type { FC } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { MapPin, Plus, Pencil, Trash2, MapPinHouse } from 'lucide-react-taro'
import type { Address, AddressUsage } from '@/types/address'
import { useAddressStore } from '@/stores/address'
import { toAddressDisplay } from '@/utils/address'
import { PageHeader } from '@/components/layout/page-header'

const USAGE_LABELS: Record<AddressUsage, string> = {
  sender: '寄件',
  receiver: '收件',
  both: '通用',
}

const TAG_COLOR: Record<string, string> = {
  '家': 'bg-blue-100 text-blue-600',
  '公司': 'bg-amber-100 text-amber-600',
  '仓库': 'bg-emerald-100 text-emerald-600',
  '其他': 'bg-slate-100 text-slate-600',
}

const AddressListPage: FC = () => {
  const router = Taro.getCurrentInstance().router
  const usage = (router?.params?.usage || 'both') as AddressUsage
  const selectMode = router?.params?.select === '1'

  const { addressList, removeAddress, loadAddresses, loading } = useAddressStore()
  const [deleteTargetId, setDeleteTargetId] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const selectionReturned = useRef(false)
  useDidShow(() => { loadAddresses().catch(error => Taro.showToast({ title: error instanceof Error ? error.message : '地址加载失败', icon: 'none' })) })

  // 按 usage 筛选
  const filteredList = addressList.filter(
    a => a.usageType === usage || a.usageType === 'both'
  )

  const handleBack = () => Taro.navigateBack()

  /** 选中并回传给上一页(EventChannel) */
  const handleSelect = (address: Address) => {
    if (!selectMode || selectionReturned.current) return
    selectionReturned.current = true
    const instance = Taro.getCurrentInstance()
    const channel = instance?.page?.getOpenerEventChannel?.()
    if (channel && typeof channel.emit === 'function') {
      channel.emit('addressSelected', address)
    }
    Taro.navigateBack()
  }

  const relaySelectedAddress = (address: Address) => {
    if (!selectMode || selectionReturned.current) return
    selectionReturned.current = true
    Taro.getCurrentInstance()?.page?.getOpenerEventChannel?.()?.emit('addressSelected', address)
  }

  const handleEdit = (id: string) => {
    const params = new URLSearchParams()
    if (id) params.set('id', id)
    params.set('usage', usage)
    if (selectMode) params.set('select', '1')
    if (selectMode) params.set('relay', '1')
    Taro.navigateTo({ url: `/pages/address/edit/index?${params.toString()}`, events: { addressSelected: relaySelectedAddress } })
  }

  const handleAdd = () => {
    const params = new URLSearchParams()
    params.set('usage', usage)
    if (selectMode) params.set('select', '1')
    if (selectMode) params.set('relay', '1')
    Taro.navigateTo({ url: `/pages/address/edit/index?${params.toString()}`, events: { addressSelected: relaySelectedAddress } })
  }

  const handleDeleteConfirm = async () => {
    if (deleteTargetId) {
      try { await removeAddress(deleteTargetId) } catch (error) { Taro.showToast({ title: error instanceof Error ? error.message : '删除失败', icon: 'none' }); return }
      setDeleteTargetId('')
    }
    setShowDeleteDialog(false)
  }

  return (
    <View className="min-h-screen bg-background">
      {/* 顶部标题栏 */}
      <PageHeader title={selectMode ? `选择${USAGE_LABELS[usage]}地址` : '地址簿'} onBack={handleBack} />

      {/* 新增按钮 */}
      <View className="p-4">
        {loading && <Text className="block text-center text-sm text-slate-400 mb-3">正在加载地址…</Text>}
        <Button
          className="h-11 w-full border-primary bg-white text-primary"
          variant="outline"
          onClick={handleAdd}
        >
          <View className="flex items-center gap-2">
            <Plus size={16} color="#2088D8" />
            <Text className="block text-sm font-medium">新增地址</Text>
          </View>
        </Button>
      </View>

      {/* 列表 */}
      {filteredList.length === 0 ? (
        <View className="flex flex-col items-center justify-center py-20 px-4">
          <MapPin size={48} color="#94A3B8" />
          <Text className="block text-base text-slate-400 mt-4">
            暂无{USAGE_LABELS[usage]}地址
          </Text>
          <Text className="block text-sm text-slate-300 mt-1">点击上方按钮添加常用地址</Text>
        </View>
      ) : (
        <View className="px-4 space-y-3 pb-8">
          {filteredList.map(address => {
            const display = toAddressDisplay(address)
            return (
              <Card
                key={address.id}
                className="cursor-pointer transition-colors active:bg-slate-50"
                onClick={() => handleSelect(address)}
              >
                <CardContent className="p-4">
                  <View className="flex items-center justify-between mb-2">
                    <View className="flex items-center gap-2">
                      <Text className="block text-base font-semibold text-slate-800">
                        {display.contactName || '未填写姓名'} {display.maskedMobile}
                      </Text>
                      {address.label && (
                        <Badge
                          className={`text-xs px-2 py-0 border-0 ${TAG_COLOR[address.label] || TAG_COLOR.其他}`}
                        >
                          {address.label}
                        </Badge>
                      )}
                      {address.isDefault && (
                        <Badge className="text-xs px-2 py-0 bg-blue-600 text-white border-0">
                          默认
                        </Badge>
                      )}
                    </View>
                  </View>

                  <View className="flex items-start gap-1 mb-3">
                    <MapPinHouse size={14} color="#94A3B8" className="mt-1 shrink-0" />
                    <View>
                      {display.region && (
                        <Text className="block text-sm text-slate-700">{display.region}</Text>
                      )}
                      {display.poiLine && (
                        <Text className="block text-sm text-slate-600">{display.poiLine}</Text>
                      )}
                      {display.detailLine && (
                        <Text className="block text-xs text-slate-500 mt-1">{display.detailLine}</Text>
                      )}
                    </View>
                  </View>

                  <View className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(address.id)
                      }}
                    >
                      <View className="flex items-center gap-1">
                        <Pencil size={14} color="#94A3B8" />
                        <Text className="block text-xs">编辑</Text>
                      </View>
                    </Button>

                    <AlertDialog
                      open={showDeleteDialog && deleteTargetId === address.id}
                      onOpenChange={(open) => {
                        if (!open) setDeleteTargetId('')
                        setShowDeleteDialog(open)
                      }}
                    >
                      <AlertDialogTrigger>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTargetId(address.id)
                            setShowDeleteDialog(true)
                          }}
                        >
                          <View className="flex items-center gap-1">
                            <Trash2 size={14} color="#EF4444" />
                            <Text className="block text-xs">删除</Text>
                          </View>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            <Text className="block">确认删除</Text>
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            <Text className="block">删除后无法恢复,确定要删除该地址吗?</Text>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            <Text className="block">取消</Text>
                          </AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteConfirm}>
                            <Text className="block">删除</Text>
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </View>
                </CardContent>
              </Card>
            )
          })}
        </View>
      )}
    </View>
  )
}

export default AddressListPage
