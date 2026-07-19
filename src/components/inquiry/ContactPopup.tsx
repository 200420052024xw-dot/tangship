/**
 * 客服联系弹窗组件
 *
 * 在用户提交包月专线/租购服务咨询后，弹窗提示会有客服联系您，
 * 同时展示我们的联系方式（电话、微信、邮箱、工作时间）。
 */

import { View, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'
import type { FC } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CircleCheck, Phone, MessageCircle, Mail, Clock } from 'lucide-react-taro'
import { consumerRequest } from '@/services/consumer-api'
import { DEMO_CONTACT } from '@/data/demo'

interface ContactInfo {
  phone: string
  wechat: string
  email: string
  workTime: string
  extraText: string
}

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  showSuccessIcon?: boolean
}

export const ContactPopup: FC<Props> = ({
  open,
  onClose,
  title = '提交成功',
  description,
  showSuccessIcon = true,
}) => {
  // 首次渲染即提供完整内容，避免弹窗打开后因异步加载联系方式而突然增高。
  const [contact, setContact] = useState<ContactInfo>(DEMO_CONTACT)

  useEffect(() => {
    consumerRequest<Partial<ContactInfo>>({ url: '/api/content/contact' })
      .then(data => {
        console.log('[ContactPopup] contact settings:', data)
        if (data) setContact(current => ({ ...current, ...data }))
      })
      .catch(() => undefined)
  }, [])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <View className="p-4">
          {/* 标题 */}
          {showSuccessIcon && <View className="mb-3 flex justify-center"><CircleCheck size={44} color="#16A34A" strokeWidth={1.8} /></View>}
          <Text className="block text-lg font-semibold text-slate-800 text-center mb-2">
            {title}
          </Text>
          <Text className="block text-sm text-slate-600 text-center mb-4">
            {description || contact.extraText || '我们的客服将尽快与您联系，请保持电话畅通'}
          </Text>

          {/* 联系方式 */}
          <View className="bg-slate-50 rounded-lg p-3 mb-4">
            <Text className="block text-sm font-medium text-slate-700 mb-3">
              您也可以直接联系我们
            </Text>

            {contact.phone && (
              <View className="flex items-center gap-3 mb-2">
                <Phone size={16} color="#2088D8" />
                <Text className="block text-sm text-slate-700">电话：{contact.phone}</Text>
              </View>
            )}
            {contact.wechat && (
              <View className="flex items-center gap-3 mb-2">
                <MessageCircle size={16} color="#2088D8" />
                <Text className="block text-sm text-slate-700">微信：{contact.wechat}</Text>
              </View>
            )}
            {contact.email && (
              <View className="flex items-center gap-3 mb-2">
                <Mail size={16} color="#2088D8" />
                <Text className="block text-sm text-slate-700">邮箱：{contact.email}</Text>
              </View>
            )}
            {contact.workTime && (
              <View className="flex items-center gap-3">
                <Clock size={16} color="#2088D8" />
                <Text className="block text-sm text-slate-700">{contact.workTime}</Text>
              </View>
            )}
          </View>

          {/* 确认按钮 */}
          <Button className="h-11 w-full bg-primary text-white" onClick={onClose}>
            <Text className="block text-white text-base font-medium">我知道了</Text>
          </Button>
        </View>
      </DialogContent>
    </Dialog>
  )
}
