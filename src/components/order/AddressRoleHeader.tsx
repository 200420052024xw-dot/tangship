/**
 * 地址角色切换条 — 寄件/收件之间的"交换"提示行
 *
 * - 仅展示分隔提示 + 交换按钮
 * - 点击交换会整体交换寄件/收件地址(联系人、电话、坐标、详细地址)
 * - 当任一地址未填时不展示该按钮(避免无意义交换)
 */

import { View, Text } from '@tarojs/components'
import type { FC } from 'react'
import { ArrowLeftRight } from 'lucide-react-taro'

interface Props {
  /** 是否允许交换(双方都已选) */
  enabled: boolean
  onSwap: () => void
}

export const AddressRoleHeader: FC<Props> = ({ enabled, onSwap }) => {
  return (
    <View className="flex items-center justify-center -my-2">
      <View
        className={`flex items-center gap-1 px-3 py-1 bg-white rounded-full border border-slate-200 ${
          enabled ? 'active:bg-slate-50 cursor-pointer' : 'opacity-50'
        }`}
        onClick={() => {
          if (!enabled) return
          onSwap()
        }}
      >
        <ArrowLeftRight size={12} color="#94A3B8" />
        <Text className="block text-xs text-slate-500">交换寄件/收件</Text>
      </View>
    </View>
  )
}