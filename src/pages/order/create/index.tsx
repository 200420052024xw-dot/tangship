/**
 * 顺丰式按趟下单页
 *
 * 流程:已选车型 → 寄件人 → 收件人 → 物品 → 用车时间 → 费用 → 协议 → 提交
 *
 * 数据源:
 * - 草稿:src/stores/orderDraft.ts
 * - 车型:src/constants/vehicles.ts
 * - 地址选择回传:Taro EventChannel(避免全局 eventCenter)
 *
 * 校验:
 * - 校验通过进入"核对下单信息"页(pages/order/confirm)
 * - 校验失败定位到第一个错误区域
 */

import { View, Text } from '@tarojs/components'
import { useState, useEffect, useMemo } from 'react'
import type { FC } from 'react'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, CircleAlert } from 'lucide-react-taro'
import { useOrderDraftStore } from '@/stores/orderDraft'
import { fetchVehicle } from '@/services/vehicle-catalog'
import type { Vehicle } from '@/types/vehicle'
import type { Address } from '@/types/address'
import type { GoodsInfo, OrderDraftErrors } from '@/types/order'
import { VehicleSummary } from '@/components/order/VehicleSummary'
import { AddressCard } from '@/components/order/AddressCard'
import { AddressRoleHeader } from '@/components/order/AddressRoleHeader'
import { GoodsForm } from '@/components/order/GoodsForm'
import { PickupTimeSelector } from '@/components/order/PickupTimeSelector'
import { FeePreview } from '@/components/order/FeePreview'
import { AgreementSection } from '@/components/order/AgreementSection'
import { OrderBottomBar } from '@/components/order/OrderBottomBar'
import {
  isValidHHmm,
  isValidISODate,
  isValidPositiveInteger,
  isValidPositiveNumber,
  isNonEmptyString,
} from '@/utils/validators'

const SECTION_IDS = {
  vehicle: 'section-vehicle',
  sender: 'section-sender',
  receiver: 'section-receiver',
  goods: 'section-goods',
  pickup: 'section-pickup',
  agreement: 'section-agreement',
} as const

const OrderCreatePage: FC = () => {
  const router = Taro.getCurrentInstance().router
  const modeParam = (router?.params?.mode || 'single') as 'single' | 'monthly' | 'rental' | 'purchase'

  const {
    draft,
    setMode,
    setSenderAddress,
    setReceiverAddress,
    swapAddresses,
    setGoods,
    setPickupType,
    setScheduledSlot,
    setAgreementAccepted,
  } = useOrderDraftStore()

  const [errors, setErrors] = useState<OrderDraftErrors>({})
  const [activeSection, setActiveSection] = useState<string>(SECTION_IDS.vehicle)
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const modeSupported = vehicle ? vehicle.supportedModes.includes(modeParam) : true

  // 进入页面:同步模式;若无车型则尝试从 URL 注入(仅在刚下单时)
  useEffect(() => {
    if (!modeSupported) {
      Taro.showToast({ title: '该车型不支持当前业务模式，请重新选择', icon: 'none' })
      return
    }
    if (modeParam !== draft.mode) {
      setMode(modeParam)
    }
  }, [modeParam, draft.mode, modeSupported, setMode])

  useEffect(() => {
    if (!draft.vehicleId) { setVehicle(null); return }
    fetchVehicle(draft.vehicleId).then(setVehicle).catch(() => { setVehicle(null); Taro.showToast({ title: '车型已下架，请重新选择', icon: 'none' }) })
  }, [draft.vehicleId])

  /** 选择寄件地址 */
  const chooseAddress = (role: 'sender' | 'receiver') => {
    Taro.navigateTo({
      url: `/pages/address/list/index?usage=${role}&select=1`,
      events: {
        addressSelected: (addr: Address) => {
          applySelectedAddress(role, addr)
        },
      },
    })
  }

  const applySelectedAddress = (role: 'sender' | 'receiver', addr: Address) => {
    if (role === 'sender') {
      setSenderAddress(addr)
      setErrors(prev => ({ ...prev, senderAddress: undefined }))
    } else {
      setReceiverAddress(addr)
      setErrors(prev => ({ ...prev, receiverAddress: undefined }))
    }
  }

  /** 编辑地址(已选) */
  const editAddress = (role: 'sender' | 'receiver', address: Address | null) => {
    if (!address) {
      chooseAddress(role)
      return
    }
    Taro.navigateTo({
      url: `/pages/address/edit/index?id=${address.id}&usage=${role}&select=1`,
      events: {
        addressSelected: (updated: Address) => {
          applySelectedAddress(role, updated)
        },
      },
    })
  }

  /** 更换车型 */
  const handleChangeVehicle = () => {
    // 保留草稿其他字段,只清空车型
    Taro.navigateBack({ delta: 1 })
  }

  /** 校验整个下单表单 */
  const validate = (): OrderDraftErrors => {
    const next: OrderDraftErrors = {}
    if (!vehicle) next.vehicleId = '请选择车型'
    else if (!modeSupported || !vehicle.supportedModes.includes(modeParam)) next.vehicleId = '该车型不支持当前业务模式，请重新选择'
    if (!draft.senderAddress) next.senderAddress = '请选择寄件地址'
    if (!draft.receiverAddress) next.receiverAddress = '请选择收件地址'
    if (draft.senderAddress && draft.receiverAddress && addressesEqual(draft.senderAddress, draft.receiverAddress)) {
      next.receiverAddress = '寄件地址与收件地址不能相同'
    }
    if (!draft.goods) next.goods = '请填写物品信息'
    if (draft.goods) {
      const g: GoodsInfo = draft.goods
      if (!isNonEmptyString(g.name)) next.goods = '请填写物品名称'
      else if (!isValidPositiveInteger(g.quantity)) next.goods = '数量必须为正整数'
      else if (!isValidPositiveNumber(g.estimatedWeightKg)) next.goods = '物品重量必须大于 0'
      else if (vehicle?.specs.maxLoadKg && g.estimatedWeightKg * g.quantity > vehicle.specs.maxLoadKg) next.goods = `物品总重量不能超过车型最大载重 ${vehicle.specs.maxLoadKg}kg`
    }
    if (draft.pickupType === 'scheduled') {
      if (!draft.scheduledSlot) next.scheduledSlot = '请选择预约时段'
      else {
        const { date, startTime, endTime } = draft.scheduledSlot
        if (!isValidISODate(date)) next.scheduledSlot = '日期格式应为 YYYY-MM-DD'
        else if (!isValidHHmm(startTime) || !isValidHHmm(endTime)) next.scheduledSlot = '时间格式应为 HH:mm'
        else {
          const start = new Date(`${date}T${startTime}:00`), end = new Date(`${date}T${endTime}:00`)
          if (start.getTime() < Date.now() + 60 * 60_000) next.scheduledSlot = '预约开始时间必须至少晚于当前时间 60 分钟'
          else if (end <= start) next.scheduledSlot = '预约结束时间必须晚于开始时间'
        }
      }
    }
    if (!draft.agreementAccepted) next.agreementAccepted = '请阅读并同意服务协议'
    return next
  }

  /** 滚动到第一个错误区域 */
  const scrollToFirstError = (errs: OrderDraftErrors) => {
    const order = [
      SECTION_IDS.vehicle,
      SECTION_IDS.sender,
      SECTION_IDS.receiver,
      SECTION_IDS.goods,
      SECTION_IDS.pickup,
      SECTION_IDS.agreement,
    ]
    for (const id of order) {
      if (id === SECTION_IDS.vehicle && errs.vehicleId) return scrollTo(id)
      if (id === SECTION_IDS.sender && errs.senderAddress) return scrollTo(id)
      if (id === SECTION_IDS.receiver && errs.receiverAddress) return scrollTo(id)
      if (id === SECTION_IDS.goods && errs.goods) return scrollTo(id)
      if (id === SECTION_IDS.pickup && errs.scheduledSlot) return scrollTo(id)
      if (id === SECTION_IDS.agreement && errs.agreementAccepted) return scrollTo(id)
    }
  }

  const scrollTo = (id: string) => {
    setActiveSection(id)
    Taro.pageScrollTo({ selector: `#${id}`, duration: 300 }).catch(() => {})
  }

  /** 提交 */
  const handleSubmit = () => {
    const errs = validate()
    setErrors(errs)
    const errorKeys = Object.keys(errs)
    if (errorKeys.length > 0) {
      const firstError = errs[errorKeys[0] as keyof OrderDraftErrors]
      Taro.showToast({ title: firstError || '请完善下单信息', icon: 'none' })
      scrollToFirstError(errs)
      return
    }

    // 校验通过:跳转核对页
    Taro.navigateTo({ url: '/pages/order/confirm/index' })
  }

  const allFilled = useMemo(() => {
    return Boolean(
      vehicle &&
      draft.senderAddress &&
      draft.receiverAddress &&
      draft.goods &&
      isNonEmptyString(draft.goods.name) &&
      isValidPositiveInteger(draft.goods.quantity) &&
      isValidPositiveNumber(draft.goods.estimatedWeightKg) &&
      (!vehicle.specs.maxLoadKg || draft.goods.estimatedWeightKg * draft.goods.quantity <= vehicle.specs.maxLoadKg) &&
      (draft.pickupType === 'immediate' || draft.scheduledSlot) &&
      draft.agreementAccepted
    )
  }, [vehicle, draft])

  /** 超载提示 */
  const overloadHint = useMemo(() => {
    if (!vehicle || !draft.goods) return null
    const totalWeight = draft.goods.estimatedWeightKg * draft.goods.quantity
    if (vehicle.specs.maxLoadKg > 0 && totalWeight > vehicle.specs.maxLoadKg) {
      return `物品总重量 ${totalWeight}kg 超过该车型载重 ${vehicle.specs.maxLoadKg}kg,请更换车型`
    }
    return null
  }, [vehicle, draft.goods])

  return (
    <View className="min-h-screen bg-slate-50 pb-32">
      {/* 顶部标题 */}
      <View className="sticky top-0 z-10 bg-white border-b border-slate-100">
        <View className="flex items-center px-4 h-12">
          <View className="flex items-center gap-2" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={18} color="#1E293B" />
            <Text className="block text-base font-medium text-slate-800">下单</Text>
          </View>
        </View>
      </View>

      {/* 主体 */}
      <View className="p-4 space-y-3">
        {/* 车型 */}
        <View id={SECTION_IDS.vehicle}>
          {vehicle ? (
            <VehicleSummary vehicle={vehicle} onChange={handleChangeVehicle} />
          ) : (
            <Card className="mb-4 border-dashed border-blue-300">
              <CardContent className="p-4 flex items-center justify-between">
                <Text className="block text-sm text-slate-500">尚未选择车型</Text>
                <Button
                  size="sm"
                  className="bg-blue-600 text-white"
                  onClick={() => Taro.navigateBack()}
                >
                  去选车型
                </Button>
              </CardContent>
            </Card>
          )}
          {errors.vehicleId && (
            <View className="flex items-center gap-1 mb-2">
              <CircleAlert size={12} color="#EF4444" />
              <Text className="block text-xs text-red-500">{errors.vehicleId}</Text>
            </View>
          )}
        </View>

        {/* 寄件 / 收件 — 统一卡片 */}
        <View className="bg-white rounded-xl border border-slate-200">
          <View id={SECTION_IDS.sender}>
            <AddressCard
              role="sender"
              address={draft.senderAddress}
              onTap={() => chooseAddress('sender')}
              onEdit={() => editAddress('sender', draft.senderAddress)}
              highlight={activeSection === SECTION_IDS.sender && !!errors.senderAddress}
            />
          </View>

          {/* 交换按钮 — 居中于两个地址之间 */}
          <View className="py-2">
            <AddressRoleHeader
              enabled={Boolean(draft.senderAddress && draft.receiverAddress)}
              onSwap={() => {
                swapAddresses()
                Taro.showToast({ title: '已交换', icon: 'none' })
              }}
            />
          </View>

          <View id={SECTION_IDS.receiver}>
            <AddressCard
              role="receiver"
              address={draft.receiverAddress}
              onTap={() => chooseAddress('receiver')}
              onEdit={() => editAddress('receiver', draft.receiverAddress)}
              highlight={activeSection === SECTION_IDS.receiver && !!errors.receiverAddress}
            />
          </View>
        </View>
        {errors.senderAddress && (
          <Text className="block text-xs text-red-500 mt-1">{errors.senderAddress}</Text>
        )}
        {errors.receiverAddress && (
          <Text className="block text-xs text-red-500 mt-1">{errors.receiverAddress}</Text>
        )}

        {/* 物品 */}
        <View id={SECTION_IDS.goods}>
          <GoodsForm
            value={draft.goods}
            onChange={(g) => {
              setGoods(g)
              setErrors(prev => ({ ...prev, goods: undefined }))
            }}
            overloadHint={overloadHint}
          />
          {errors.goods && (
            <Text className="block text-xs text-red-500 mb-2">{errors.goods}</Text>
          )}
        </View>

        {/* 用车时间 */}
        <View id={SECTION_IDS.pickup}>
          <PickupTimeSelector
            pickupType={draft.pickupType}
            scheduledSlot={draft.scheduledSlot}
            onPickupTypeChange={(t) => {
              setPickupType(t)
              setErrors(prev => ({ ...prev, scheduledSlot: undefined }))
            }}
            onScheduledSlotChange={(slot) => {
              setScheduledSlot(slot)
              setErrors(prev => ({ ...prev, scheduledSlot: undefined }))
            }}
          />
          {errors.scheduledSlot && (
            <Text className="block text-xs text-red-500 mb-2">{errors.scheduledSlot}</Text>
          )}
        </View>

        {/* 费用 */}
        <FeePreview vehicle={vehicle} />

        {/* 协议 */}
        <View id={SECTION_IDS.agreement}>
          <AgreementSection
            checked={draft.agreementAccepted}
            onChange={(c) => {
              setAgreementAccepted(c)
              setErrors(prev => ({ ...prev, agreementAccepted: undefined }))
            }}
          />
          {errors.agreementAccepted && (
            <Text className="block text-xs text-red-500 mb-2">{errors.agreementAccepted}</Text>
          )}
        </View>
      </View>

      {/* 底部固定操作栏 */}
      <OrderBottomBar
        ready={allFilled}
        label="核对下单信息"
        disabledLabel="请完善下单信息"
        onClick={handleSubmit}
      />
    </View>
  )
}

export default OrderCreatePage

function addressesEqual(left: Address, right: Address) {
  const normalize = (address: Address) => [address.contactName, address.mobile, address.formattedAddress, address.detailAddress, address.longitude, address.latitude].map(value => String(value ?? '').trim().toLowerCase()).join('|')
  return normalize(left) === normalize(right)
}
