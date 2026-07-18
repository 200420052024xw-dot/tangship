/**
 * 地址卡片 — 下单页中的寄件/收件地址展示
 *
 * - 空状态:显示"添加{角色}地址"
 * - 已填状态:显示脱敏手机号 + 省市区 + POI + 门牌
 * - 点击整卡回调
 */

import { View, Text } from '@tarojs/components'
import type { FC } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, ArrowRight, Pencil } from 'lucide-react-taro'
import type { Address } from '@/types/address'
import { toAddressDisplay } from '@/utils/address'

interface Props {
  role: 'sender' | 'receiver'
  address: Address | null
  onTap: () => void
  onEdit?: () => void
  /** 高亮当前正在编辑的角色(用于滚动定位) */
  highlight?: boolean
}

const ROLE_META: Record<Props['role'], { label: string; color: string; emptyHint: string }> = {
  sender: {
    label: '寄件地址',
    color: '#10B981',
    emptyHint: '添加寄件地址',
  },
  receiver: {
    label: '收件地址',
    color: '#EF4444',
    emptyHint: '添加收件地址',
  },
}

export const AddressCard: FC<Props> = ({ role, address, onTap, onEdit, highlight }) => {
  const meta = ROLE_META[role]
  return (
    <Card
      className={`mb-3 cursor-pointer transition-colors ${highlight ? 'ring-2 ring-blue-500' : ''}`}
      onClick={onTap}
    >
      <CardContent className="p-4">
        <View className="flex items-center justify-between mb-2">
          <View className="flex items-center gap-2">
            <MapPin size={14} color={meta.color} />
            <Text className="block text-xs text-slate-500">{meta.label}</Text>
          </View>
          {address && onEdit && (
            <View
              className="flex items-center gap-1"
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
            >
              <Pencil size={12} color="#94A3B8" />
              <Text className="block text-xs text-slate-400">编辑</Text>
            </View>
          )}
        </View>

        {address ? (
          <View>
            <View className="flex items-center gap-2 mb-1">
              <Text className="block text-sm text-slate-800 font-medium">
                {toAddressDisplay(address).contactName || '联系人未填'}
              </Text>
              <Text className="block text-sm text-slate-600">
                {toAddressDisplay(address).maskedMobile}
              </Text>
              {address.label && (
                <Badge className="text-xs px-2 py-0 border-0 bg-blue-50 text-blue-600">
                  {address.label}
                </Badge>
              )}
            </View>
            {toAddressDisplay(address).region && (
              <Text className="block text-xs text-slate-600">{toAddressDisplay(address).region}</Text>
            )}
            {toAddressDisplay(address).poiLine && (
              <Text className="block text-sm text-slate-700 mt-1">{toAddressDisplay(address).poiLine}</Text>
            )}
            {toAddressDisplay(address).detailLine && (
              <Text className="block text-xs text-slate-500 mt-1">
                {toAddressDisplay(address).detailLine}
              </Text>
            )}
          </View>
        ) : (
          <View className="flex items-center justify-between py-3 px-2">
            <Text className="block text-sm text-slate-400">{meta.emptyHint}</Text>
            <ArrowRight size={14} color="#94A3B8" />
          </View>
        )}
      </CardContent>
    </Card>
  )
}