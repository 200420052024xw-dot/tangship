import type { FC } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft } from 'lucide-react-taro'

interface PageHeaderProps {
  title: string
  onBack?: () => void
}

export const PageHeader: FC<PageHeaderProps> = ({ title, onBack }) => (
  <View style={{ position: 'sticky', top: 0, zIndex: 40 }} className="border-b border-slate-100 bg-white">
    <View style={{ height: 'env(safe-area-inset-top, 0px)' }} />
    <View className="relative flex h-12 items-center justify-center px-4">
      <View
        className="absolute left-4 flex h-10 w-10 items-center justify-start"
        onClick={onBack || (() => Taro.navigateBack())}
      >
        <ArrowLeft size={20} color="#172033" strokeWidth={1.8} />
      </View>
      <Text className="block text-base font-semibold text-slate-900">{title}</Text>
    </View>
  </View>
)
