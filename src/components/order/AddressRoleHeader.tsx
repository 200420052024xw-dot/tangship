/**
 * 地址交换按钮 — 寄件/收件之间的圆形交换按钮
 *
 * - 居中悬浮在两个地址卡片之间
 * - 点击交换寄件/收件地址
 * - 当任一地址未填时不展示
 */

import { View } from '@tarojs/components'
import type { FC } from 'react'
import { ArrowUpDown } from 'lucide-react-taro'

interface Props {
  /** 是否允许交换(双方都已选) */
  enabled: boolean
  onSwap: () => void
}

export const AddressRoleHeader: FC<Props> = ({ enabled, onSwap }) => {
  if (!enabled) return null

  return (
    <View className="flex items-center justify-center -my-3 relative z-10">
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: '#F1F5F9',
          borderWidth: 1,
          borderColor: '#E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        className="active:bg-slate-200"
        onClick={onSwap}
      >
        <ArrowUpDown size={14} color="#64748B" />
      </View>
    </View>
  )
}
