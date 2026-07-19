/**
 * 包月专线信息填写页
 *
 * 流程: 先填写业务信息(收发货地址、联系人、货物类型、配送周期、月配送次数)
 *       → 选择车型 → 弹窗提示客服联系
 *
 * 地址选择: 复用 AddressCard + 地址簿/API 选址（与按趟下单一致）
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
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Package, Calendar, Repeat } from 'lucide-react-taro'
import { AddressCard } from '@/components/order/AddressCard'
import { AddressRoleHeader } from '@/components/order/AddressRoleHeader'
import { ContactPopup } from '@/components/inquiry/ContactPopup'
import { consumerRequest } from '@/services/consumer-api'
import type { Address } from '@/types/address'

/** 将 Address 对象序列化为可读字符串（用于提交给后端） */
const addressToString = (addr: Address): string => {
  const parts = [addr.formattedAddress, addr.detailAddress].filter(Boolean)
  if (parts.length === 0) {
    parts.push(`${addr.contactName} ${addr.mobile}`)
  }
  return parts.join(' ')
}

const MonthlyInquiryPage: FC = () => {
  const router = Taro.getCurrentInstance().router
  const preselectedVehicleId = router?.params?.vehicleId || ''

  // 地址：复用 Address 类型 + AddressCard 组件
  const [senderAddress, setSenderAddress] = useState<Address | null>(null)
  const [receiverAddress, setReceiverAddress] = useState<Address | null>(null)
  // 其他表单字段
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [cargoType, setCargoType] = useState('')
  const [deliveryCycle, setDeliveryCycle] = useState('')
  const [monthlyTrips, setMonthlyTrips] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showContact, setShowContact] = useState(false)

  const isFormValid = senderAddress && receiverAddress
    && contactName.trim() && phone.trim() && cargoType.trim()
    && deliveryCycle.trim() && monthlyTrips.trim()

  /** 选择地址 — 跳转地址簿列表页，通过 EventChannel 回传 */
  const chooseAddress = (role: 'sender' | 'receiver') => {
    Taro.navigateTo({
      url: `/pages/address/list/index?usage=${role}&select=1`,
      events: {
        addressSelected: (addr: Address) => {
          if (role === 'sender') {
            setSenderAddress(addr)
          } else {
            setReceiverAddress(addr)
          }
        },
      },
    })
  }

  /** 编辑已有地址 */
  const editAddress = (role: 'sender' | 'receiver', address: Address | null) => {
    if (!address) {
      chooseAddress(role)
      return
    }
    Taro.navigateTo({
      url: `/pages/address/edit/index?id=${address.id}&usage=${role}&select=1`,
      events: {
        addressSelected: (updated: Address) => {
          if (role === 'sender') {
            setSenderAddress(updated)
          } else {
            setReceiverAddress(updated)
          }
        },
      },
    })
  }

  /** 交换收发货地址 */
  const swapAddresses = () => {
    setSenderAddress(receiverAddress)
    setReceiverAddress(senderAddress)
  }

  const handleSubmit = async () => {
    if (!isFormValid || submitting) return
    setSubmitting(true)
    try {
      const payload = {
        type: 'monthly',
        senderAddress: addressToString(senderAddress!),
        receiverAddress: addressToString(receiverAddress!),
        contactName: contactName.trim(),
        phone: phone.trim(),
        companyName: companyName.trim() || undefined,
        cargoType: cargoType.trim(),
        deliveryCycle: deliveryCycle.trim(),
        monthlyTrips: Number(monthlyTrips) || undefined,
        vehicleId: preselectedVehicleId || undefined,
      }
      console.log('[MonthlyInquiry] submit:', payload)
      const res = await consumerRequest({
        url: '/api/content/inquiries',
        method: 'POST',
        data: payload,
      })
      console.log('[MonthlyInquiry] response:', res)
      setShowContact(true)
    } catch (err) {
      console.error('[MonthlyInquiry] error:', err)
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  /** 如果没有预选车型，提交后跳转到选车页；否则直接弹窗 */
  const handleSubmitAndSelectVehicle = () => {
    if (!isFormValid) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    if (preselectedVehicleId) {
      handleSubmit()
    } else {
      // 将表单数据通过路由参数传给选车页
      const params = [
        `senderAddr=${encodeURIComponent(addressToString(senderAddress!))}`,
        `receiverAddr=${encodeURIComponent(addressToString(receiverAddress!))}`,
        `contactName=${encodeURIComponent(contactName)}`,
        `phone=${encodeURIComponent(phone)}`,
        `companyName=${encodeURIComponent(companyName)}`,
        `cargoType=${encodeURIComponent(cargoType)}`,
        `deliveryCycle=${encodeURIComponent(deliveryCycle)}`,
        `monthlyTrips=${encodeURIComponent(monthlyTrips)}`,
      ].join('&')
      Taro.navigateTo({ url: `/pages/inquiry/select-vehicle/index?mode=monthly&${params}` })
    }
  }

  return (
    <View className="min-h-screen bg-slate-50 pb-28">
      {/* 自定义导航栏 — 与车型详情页一致 */}
      <View style={{ position: 'sticky', top: 0, zIndex: 10 }} className="bg-white border-b border-slate-100">
        <View style={{ height: 'env(safe-area-inset-top, 0px)' }} />
        <View className="flex items-center px-4 h-12">
          <View className="flex items-center gap-2" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={18} color="#1E293B" />
            <Text className="block text-base font-medium text-slate-800">包月专线</Text>
          </View>
        </View>
      </View>

      <View className="p-4">
        <Text className="block text-sm text-slate-500 mb-4">
          请填写以下信息，我们将在1个工作日内联系您提供包月专线方案
        </Text>

        {/* 收发货地址 — 统一卡片 */}
        <View className="bg-white rounded-xl border border-slate-200 mb-3">
          <View className="px-4 pt-3 pb-2">
            <Text className="block text-base font-semibold text-slate-800">配送地址</Text>
          </View>
          <AddressCard
            role="sender"
            address={senderAddress}
            onTap={() => chooseAddress('sender')}
            onEdit={() => editAddress('sender', senderAddress)}
          />
          <AddressRoleHeader
            enabled={!!senderAddress && !!receiverAddress}
            onSwap={swapAddresses}
          />
          <AddressCard
            role="receiver"
            address={receiverAddress}
            onTap={() => chooseAddress('receiver')}
            onEdit={() => editAddress('receiver', receiverAddress)}
          />
        </View>

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
            <View>
              <Text className="block text-sm font-medium text-slate-700 mb-1">公司名称（选填）</Text>
              <Input placeholder="请输入公司名称" value={companyName} onInput={e => setCompanyName(e.detail.value)} />
            </View>
          </CardContent>
        </Card>

        {/* 配送信息 */}
        <Card className="mb-3">
          <CardContent className="p-4">
            <Text className="block text-base font-semibold text-slate-800 mb-3">配送信息</Text>
            <View className="mb-3">
              <View className="flex items-center gap-2 mb-1">
                <Package size={14} color="#2088D8" />
                <Text className="block text-sm font-medium text-slate-700">货物类型 *</Text>
              </View>
              <Input placeholder="如：生鲜食品、快递包裹、日用百货" value={cargoType} onInput={e => setCargoType(e.detail.value)} />
            </View>
            <View className="mb-3">
              <View className="flex items-center gap-2 mb-1">
                <Calendar size={14} color="#2088D8" />
                <Text className="block text-sm font-medium text-slate-700">配送周期 *</Text>
              </View>
              <Input placeholder="如：每周5天、每日" value={deliveryCycle} onInput={e => setDeliveryCycle(e.detail.value)} />
            </View>
            <View>
              <View className="flex items-center gap-2 mb-1">
                <Repeat size={14} color="#2088D8" />
                <Text className="block text-sm font-medium text-slate-700">每月预计配送次数 *</Text>
              </View>
              <Input type="number" placeholder="请输入月配送次数" value={monthlyTrips} onInput={e => setMonthlyTrips(e.detail.value)} />
            </View>
          </CardContent>
        </Card>
      </View>

      {/* 底部操作栏 */}
      <View
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
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

export default MonthlyInquiryPage
