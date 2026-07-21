import type { FC, ReactNode } from 'react'
import { View } from '@tarojs/components'

interface FixedActionBarProps {
  children: ReactNode
  fixed?: boolean
  bottom?: number
  safeArea?: boolean
}

export const FixedActionBar: FC<FixedActionBarProps> = ({ children, fixed = true, bottom = 0, safeArea = true }) => (
  <View
    style={fixed ? {
        position: 'fixed',
        bottom,
        left: 0,
        right: 0,
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: safeArea ? 'calc(12px + env(safe-area-inset-bottom, 0px))' : 12,
        zIndex: 100,
      } : {
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        paddingBottom: safeArea ? 'calc(12px + env(safe-area-inset-bottom, 0px))' : 12,
      }}
    className="border-t border-slate-100 bg-white px-4 pt-3"
  >
    {children}
  </View>
)
