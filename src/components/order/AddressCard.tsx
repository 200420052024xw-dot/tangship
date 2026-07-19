/**
 * 地址卡片 — 下单页中的寄件/收件地址展示
 *
 * - 空状态:显示"添加{角色}地址"
 * - 已填状态:显示联系人 + 脱敏手机号 + 地址
 * - 点击整卡回调
 */

import { View, Text } from '@tarojs/components'
import type { FC } from 'react'
import { ArrowRight, Pencil } from 'lucide-react-taro'
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

const ROLE_META: Record<Props['role'], { label: string; color: string; bgColor: string; emptyHint: string }> = {
  sender: {
    label: '寄件',
    color: '#10B981',
    bgColor: '#ECFDF5',
    emptyHint: '选择寄件地址',
  },
  receiver: {
    label: '收件',
    color: '#EF4444',
    bgColor: '#FEF2F2',
    emptyHint: '选择收件地址',
  },
}

export const AddressCard: FC<Props> = ({ role, address, onTap, onEdit, highlight }) => {
  const meta = ROLE_META[role]
  return (
    <View
      className={`bg-white rounded-xl px-4 py-3 ${highlight ? 'ring-2 ring-blue-500' : ''}`}
      onClick={onTap}
    >
      {/* 顶部：角色标签 + 编辑 */}
      <View className="flex items-center justify-between mb-2">
        <View className="flex items-center gap-1">
          <View style={{ width: 4, height: 14, borderRadius: 2, backgroundColor: meta.color }} />
          <Text className="block text-xs font-medium" style={{ color: meta.color }}>{meta.label}</Text>
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

      {/* 内容 */}
      {address ? (
        <View>
          <View className="flex items-center gap-2 mb-1">
            <Text className="block text-sm text-slate-800 font-semibold">
              {toAddressDisplay(address).contactName || '联系人未填'}
            </Text>
            <Text className="block text-xs text-slate-500">
              {toAddressDisplay(address).maskedMobile}
            </Text>
          </View>
          <Text className="block text-xs text-slate-600 leading-relaxed">
            {toAddressDisplay(address).region}
            {toAddressDisplay(address).poiLine ? ` ${toAddressDisplay(address).poiLine}` : ''}
            {toAddressDisplay(address).detailLine ? ` ${toAddressDisplay(address).detailLine}` : ''}
          </Text>
        </View>
      ) : (
        <View className="flex items-center justify-between py-2">
          <Text className="block text-sm text-slate-400">{meta.emptyHint}</Text>
          <ArrowRight size={14} color="#94A3B8" />
        </View>
      )}
    </View>
  )
}
