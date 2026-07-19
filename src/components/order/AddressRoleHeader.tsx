/**
 * 地址交换按钮 — 寄件/收件之间，虚线水平穿过按钮正中间
 *
 * - 水平虚线贯穿整行，圆形交换按钮居中悬浮在线上
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
    <View
      className="relative flex items-center justify-center"
      style={{ height: 0, zIndex: 10 }}
    >
      {/* 虚线 - 贯穿整行 */}
      <View
        className="absolute left-0 right-0"
        style={{
          height: 1,
          borderTopWidth: 1,
          borderTopColor: '#CBD5E1',
          borderTopStyle: 'dashed',
        }}
      />
      {/* 圆形按钮 - 居中悬浮，白色底遮住虚线 */}
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#CBD5E1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 2,
        }}
        className="active:bg-slate-100"
        onClick={onSwap}
      >
        <ArrowUpDown size={10} color="#94A3B8" />
      </View>
    </View>
  )
}
