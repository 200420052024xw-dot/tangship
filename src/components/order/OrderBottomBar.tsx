/**
 * 订单底部固定操作栏
 *
 * - 内联 style 处理 position:fixed + safe-area 兼容 H5 端
 * - 单一按钮,根据 ready 状态切换文案与禁用样式
 * - 留出 children 插槽以便"费用预估"叠加在按钮上方(如核对页)
 */

import { View, Text } from '@tarojs/components'
import type { FC, ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  /** 按钮文案 */
  label: string
  /** 禁用样式(未填写完整时) */
  disabledLabel?: string
  /** 是否就绪 */
  ready: boolean
  /** 点击回调 */
  onClick: () => void
  /** 按钮上方额外区域,例如提示/费用说明 */
  children?: ReactNode
}

export const OrderBottomBar: FC<Props> = ({
  label,
  disabledLabel = label,
  ready,
  onClick,
  children,
}) => {
  return (
    <View
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        backgroundColor: '#fff',
        borderTop: '1px solid #e5e5e5',
        zIndex: 100,
      }}
    >
      {children}
      <Button
        className={`w-full h-12 font-medium rounded-lg text-white ${
          ready ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300'
        }`}
        disabled={!ready}
        onClick={onClick}
      >
        <Text className="block text-base">{ready ? label : disabledLabel}</Text>
      </Button>
    </View>
  )
}
