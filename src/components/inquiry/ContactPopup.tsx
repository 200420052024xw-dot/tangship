/**
 * 客服联系弹窗组件
 *
 * 在用户提交包月专线/租购服务咨询后,或从"我的-联系客服"进入时,
 * 展示管理员在后台配置的联系方式(电话、微信、邮箱、工作时间)。
 */

import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import type { FC } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CircleCheck, Phone, MessageCircle, Mail, Clock } from 'lucide-react-taro'
import { Network } from '@/network'

interface ContactInfo {
  phone: string
  wechat: string
  email: string
  workTime: string
  extraText: string
}

const EMPTY_CONTACT: ContactInfo = { phone: '', wechat: '', email: '', workTime: '', extraText: '' }

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  showSuccessIcon?: boolean
}

const ContactRow = ({ icon, label, value, onTap }: { icon: React.ReactNode; label: string; value: string; onTap?: () => void }) => {
  const filled = !!value
  return (
    <View
      className="flex items-center gap-3 py-2"
      onClick={onTap}
      hoverClass={onTap ? 'opacity-70' : undefined}
    >
      {icon}
      <Text className="block text-sm">
        <Text className="text-slate-500">{label}：</Text>
        <Text className={filled ? 'text-slate-800' : 'text-slate-400'}>{filled ? value : '暂未填写'}</Text>
      </Text>
    </View>
  )
}

export const ContactPopup: FC<Props> = ({
  open,
  onClose,
  title = '提交成功',
  description,
  showSuccessIcon = true,
}) => {
  const [contact, setContact] = useState<ContactInfo>(EMPTY_CONTACT)
  const [loaded, setLoaded] = useState(false)

  // 每次弹窗打开时重新拉取最新联系方式(后台改完配置后再次打开即可生效)
  // 注意:这是公开接口,不要走 consumerRequest(否则会被未登录拦截)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    Network.request({
      url: '/api/content/contact',
      method: 'GET',
      header: { 'Content-Type': 'application/json' },
    })
      .then(res => {
        if (cancelled) return
        const body = res.data as { code: number; data?: Partial<ContactInfo> }
        if (res.statusCode === 200 && body?.data) {
          setContact(current => ({ ...current, ...body.data }))
        }
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [open])

  const callPhone = () => {
    if (!contact.phone) return
    Taro.makePhoneCall({ phoneNumber: contact.phone, fail: () => undefined })
  }

  const copyWechat = () => {
    if (!contact.wechat) return
    Taro.setClipboardData({ data: contact.wechat, success: () => Taro.showToast({ title: '微信号已复制', icon: 'success' }) })
  }

  const hasAny = !!(contact.phone || contact.wechat || contact.email || contact.workTime)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <View className="p-4">
          {showSuccessIcon && <View className="mb-3 flex justify-center"><CircleCheck size={44} color="#16A34A" strokeWidth={1.8} /></View>}
          <Text className="block text-lg font-semibold text-slate-800 text-center mb-2">
            {title}
          </Text>
          <Text className="block text-sm text-slate-600 text-center mb-4">
            {description || contact.extraText || '订单咨询、调度和取消申请,请通过以下方式联系我们'}
          </Text>

          <View className="bg-slate-50 rounded-lg p-3 mb-4">
            <Text className="block text-sm font-medium text-slate-700 mb-2">
              您也可以直接联系我们
            </Text>

            <ContactRow
              icon={<Phone size={16} color="#2088D8" />}
              label="客服电话"
              value={contact.phone}
              onTap={contact.phone ? callPhone : undefined}
            />
            <ContactRow
              icon={<MessageCircle size={16} color="#2088D8" />}
              label="微信号"
              value={contact.wechat}
              onTap={contact.wechat ? copyWechat : undefined}
            />
            <ContactRow
              icon={<Mail size={16} color="#2088D8" />}
              label="邮箱"
              value={contact.email}
            />
            <ContactRow
              icon={<Clock size={16} color="#2088D8" />}
              label="工作时间"
              value={contact.workTime}
            />

            {loaded && !hasAny && (
              <View className="mt-2 border-t border-slate-200 pt-2">
                <Text className="block text-xs text-slate-400 text-center">
                  暂未配置联系方式,请联系运营人员
                </Text>
              </View>
            )}
          </View>

          <Button className="h-11 w-full bg-primary text-white" onClick={onClose}>
            <Text className="block text-white text-base font-medium">我知道了</Text>
          </Button>
        </View>
      </DialogContent>
    </Dialog>
  )
}