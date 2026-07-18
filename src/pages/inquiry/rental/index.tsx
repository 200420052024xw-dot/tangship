/**
 * 租购服务信息填写页
 *
 * 流程: 先填写联系信息(姓名、电话、公司名称选填、咨询内容选填)
 *       → 选择车型 → 弹窗提示客服联系
 *
 * 路由参数:
 * - vehicleId: 可选，若从车型详情页进入则已选车型
 */

import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import type { FC } from 'react'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, User, Phone, Building2, MessageSquare } from 'lucide-react-taro'
import { ContactPopup } from '@/components/inquiry/ContactPopup'
import { consumerRequest } from '@/services/consumer-api'

const RentalInquiryPage: FC = () => {
  const router = Taro.getCurrentInstance().router
  const preselectedVehicleId = router?.params?.vehicleId || ''

  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [consultContent, setConsultContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showContact, setShowContact] = useState(false)

  const handleBack = () => Taro.navigateBack()

  const isFormValid = contactName.trim() && phone.trim()

  const handleSubmit = async () => {
    if (!isFormValid || submitting) return
    setSubmitting(true)
    try {
      const payload = {
        type: 'rental',
        contactName: contactName.trim(),
        phone: phone.trim(),
        companyName: companyName.trim() || undefined,
        consultContent: consultContent.trim() || undefined,
        vehicleId: preselectedVehicleId || undefined,
      }
      console.log('[RentalInquiry] submit:', payload)
      const res = await consumerRequest({
        url: '/api/content/inquiries',
        method: 'POST',
        data: payload,
      })
      console.log('[RentalInquiry] response:', res)
      setShowContact(true)
    } catch (err) {
      console.error('[RentalInquiry] error:', err)
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitAndSelectVehicle = () => {
    if (!isFormValid) {
      Taro.showToast({ title: '请填写姓名和电话', icon: 'none' })
      return
    }
    if (preselectedVehicleId) {
      handleSubmit()
    } else {
      const params = [
        `contactName=${encodeURIComponent(contactName)}`,
        `phone=${encodeURIComponent(phone)}`,
        `companyName=${encodeURIComponent(companyName)}`,
        `consultContent=${encodeURIComponent(consultContent)}`,
      ].join('&')
      Taro.navigateTo({ url: `/pages/inquiry/select-vehicle/index?mode=rental&${params}` })
    }
  }

  return (
    <View className="min-h-screen bg-slate-50 pb-28">
      {/* 顶部标题栏 */}
      <View className="sticky top-0 z-10 bg-white border-b border-slate-100">
        <View className="flex items-center px-4 h-12">
          <View className="flex items-center gap-2" onClick={handleBack}>
            <ArrowLeft size={18} color="#1E293B" />
            <Text className="block text-base font-medium text-slate-800">租购服务咨询</Text>
          </View>
        </View>
      </View>

      <View className="p-4">
        <Text className="block text-sm text-slate-500 mb-4">
          请填写以下信息，我们将在1个工作日内联系您提供租购方案
        </Text>

        <Card className="mb-3">
          <CardContent className="p-4">
            <Text className="block text-base font-semibold text-slate-800 mb-3">联系信息</Text>
            <View className="mb-3">
              <View className="flex items-center gap-2 mb-1">
                <User size={14} color="#2088D8" />
                <Text className="block text-sm font-medium text-slate-700">姓名 *</Text>
              </View>
              <Input placeholder="请输入联系人姓名" value={contactName} onInput={e => setContactName(e.detail.value)} />
            </View>
            <View className="mb-3">
              <View className="flex items-center gap-2 mb-1">
                <Phone size={14} color="#2088D8" />
                <Text className="block text-sm font-medium text-slate-700">电话 *</Text>
              </View>
              <Input type="number" placeholder="请输入联系电话" value={phone} onInput={e => setPhone(e.detail.value)} />
            </View>
            <View className="mb-3">
              <View className="flex items-center gap-2 mb-1">
                <Building2 size={14} color="#94A3B8" />
                <Text className="block text-sm font-medium text-slate-700">公司名称（选填）</Text>
              </View>
              <Input placeholder="请输入公司名称" value={companyName} onInput={e => setCompanyName(e.detail.value)} />
            </View>
            <View>
              <View className="flex items-center gap-2 mb-1">
                <MessageSquare size={14} color="#94A3B8" />
                <Text className="block text-sm font-medium text-slate-700">咨询内容（选填）</Text>
              </View>
              <Textarea
                style={{ width: '100%', minHeight: '80px' }}
                placeholder="请描述您想咨询的内容..."
                value={consultContent}
                onInput={e => setConsultContent(e.detail.value)}
                maxlength={500}
              />
            </View>
          </CardContent>
        </Card>
      </View>

      {/* 底部操作栏 */}
      <View
        style={{
          position: 'fixed', bottom: 50, left: 0, right: 0,
          padding: '12px 16px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          backgroundColor: '#fff', borderTop: '1px solid #e5e5e5', zIndex: 100,
        }}
      >
        <Button
          className={`w-full h-11 font-medium rounded-lg ${isFormValid ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}
          disabled={!isFormValid || submitting}
          onClick={handleSubmitAndSelectVehicle}
        >
          <Text className="block text-base">
            {preselectedVehicleId ? (submitting ? '提交中...' : '提交咨询') : '下一步：选择车型'}
          </Text>
        </Button>
      </View>

      <ContactPopup open={showContact} onClose={() => { setShowContact(false); Taro.navigateBack() }} />
    </View>
  )
}

export default RentalInquiryPage
