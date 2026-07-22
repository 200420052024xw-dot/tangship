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
import { ContactPopup } from '@/components/inquiry/ContactPopup'
import { consumerRequest } from '@/services/consumer-api'
import { PageHeader } from '@/components/layout/page-header'
import { FixedActionBar } from '@/components/layout/fixed-action-bar'

const RentalInquiryPage: FC = () => {
  const router = Taro.getCurrentInstance().router
  const preselectedVehicleId = router?.params?.vehicleId || ''

  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [consultContent, setConsultContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showContact, setShowContact] = useState(false)

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
      Taro.showToast({ title: '提交失败，请稍后重试', icon: 'none' })
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
    <View className="min-h-screen bg-background pb-28">
      {/* 自定义导航栏 — 与车型详情页一致 */}
      <PageHeader title="租购服务" />

      <View className="p-4">
        <Card className="mb-3 border-blue-100 bg-blue-50">
          <CardContent className="p-4">
            <Text className="block text-base font-semibold text-slate-800 mb-2">租购服务说明</Text>
            <Text className="block text-sm leading-6 text-slate-600">
              提供灵活的租赁与购买方案，满足企业不同阶段的运力需求，我们将在一个工作日内联系您提供租购方案
            </Text>
          </CardContent>
        </Card>

        {/* 联系信息 */}
        <Card className="mb-3">
          <CardContent className="p-4">
            <Text className="block text-base font-semibold text-slate-800 mb-3">联系信息</Text>
            <View className="mb-3">
              <Text className="block text-sm font-medium text-slate-700 mb-1">姓名 *</Text>
              <Input placeholder="请输入联系人姓名" value={contactName} onInput={e => setContactName(e.detail.value)} />
            </View>
            <View className="mb-3">
              <Text className="block text-sm font-medium text-slate-700 mb-1">电话 *</Text>
              <Input type="number" placeholder="请输入联系电话" value={phone} onInput={e => setPhone(e.detail.value)} />
            </View>
            <View className="mb-3">
              <Text className="block text-sm font-medium text-slate-700 mb-1">公司名称（选填）</Text>
              <Input placeholder="请输入公司名称" value={companyName} onInput={e => setCompanyName(e.detail.value)} />
            </View>
          </CardContent>
        </Card>

        {/* 咨询内容 */}
        <Card className="mb-3">
          <CardContent className="p-4">
            <Text className="block text-base font-semibold text-slate-800 mb-2">咨询内容（选填）</Text>
            <Textarea
              className="h-28"
              placeholder="请描述您想咨询的内容，如车型偏好、使用场景等"
              value={consultContent}
              onInput={e => setConsultContent(e.detail.value)}
              maxlength={500}
              style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
            />
          </CardContent>
        </Card>
      </View>

      {/* 底部操作栏 */}
      <FixedActionBar>
        <Button
          className={`h-12 w-full ${isFormValid ? 'bg-primary text-white' : 'bg-slate-200 text-slate-400'}`}
          disabled={!isFormValid || submitting}
          onClick={handleSubmitAndSelectVehicle}
        >
          <Text className="block text-base">
            {preselectedVehicleId ? (submitting ? '提交中...' : '提交咨询') : '下一步：选择车型'}
          </Text>
        </Button>
      </FixedActionBar>

      <ContactPopup
        open={showContact}
        onClose={() => {
          setShowContact(false)
          Taro.switchTab({ url: '/pages/index/index' })
        }}
      />
    </View>
  )
}

export default RentalInquiryPage
