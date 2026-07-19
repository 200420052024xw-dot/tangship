/**
 * 地址交换按钮 — 寄件/收件之间，实线水平穿过按钮正中间
 *
 * - 正常文档流，实线始终贯穿
 * - 方形按钮居中悬浮在线上（enabled=false 时灰掉不可点）
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
  return (
    <View
      className="relative flex items-center justify-center"
      style={{ height: 16, zIndex: 1 }}
    >
      {/* 实线 - 始终贯穿整行 */}
      <View
        className="absolute left-4 right-4"
        style={{
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          borderTopStyle: 'solid',
        }}
      />
      {/* 方形按钮 - 居中悬浮，白色底遮住线 */}
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 4,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: enabled ? '#CBD5E1' : '#E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 2,
          opacity: enabled ? 1 : 0.4,
        }}
        onClick={enabled ? onSwap : undefined}
      >
        <ArrowUpDown size={10} color={enabled ? '#94A3B8' : '#CBD5E1'} />
      </View>
    </View>
  )
}
