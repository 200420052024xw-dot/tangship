/**
 * 协议确认区块
 *
 * - 简单协议文案,后续接入正式协议页面时使用 Taro.navigateTo 跳转到独立页面
 */

import { View, Text } from '@tarojs/components'
import type { FC } from 'react'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { FileText } from 'lucide-react-taro'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
}

export const AgreementSection: FC<Props> = ({ checked, onChange }) => {
  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <View className="flex items-start gap-2">
          <View
            className="mt-1"
            onClick={() => onChange(!checked)}
          >
            <Checkbox checked={checked} onCheckedChange={onChange} />
          </View>
          <View className="flex-1">
            <View className="flex items-center gap-1 flex-wrap">
              <Text className="block text-sm text-slate-700">
                我已阅读并同意
              </Text>
              <Text
                className="block text-sm text-blue-600 underline"
                onClick={(e) => {
                  e.stopPropagation()
                  // 预留协议详情页跳转
                  Taro.showToast({ title: '协议详情页将在下一阶段接入', icon: 'none' })
                }}
              >
                《无人配送服务协议》
              </Text>
              <Text className="block text-sm text-slate-700">与</Text>
              <Text
                className="block text-sm text-blue-600 underline"
                onClick={(e) => {
                  e.stopPropagation()
                  Taro.showToast({ title: '禁运品说明页将在下一阶段接入', icon: 'none' })
                }}
              >
                《禁运品说明》
              </Text>
            </View>
            <View className="flex items-center gap-1 mt-2 text-xs text-slate-400">
              <FileText size={12} color="#94A3B8" />
              <Text className="block">协议详情页将在下一阶段提供,此处仅做勾选</Text>
            </View>
          </View>
        </View>
      </CardContent>
    </Card>
  )
}