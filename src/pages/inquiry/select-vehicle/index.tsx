/**
 * 咨询选车页
 *
 * 在用户填写完包月/租购信息后，选择心仪的车型。
 * 选择完成后自动提交咨询并弹出客服联系弹窗。
 *
 * 路由参数:
 * - mode: 'monthly' | 'rental' (必填)
 * - plus all form fields from the previous page
 */

import { View, Text, Image } from '@tarojs/components'
import { useState, useEffect } from 'react'
import type { FC } from 'react'
import Taro from '@tarojs/taro'
import { ArrowLeft, CircleCheck } from 'lucide-react-taro'
import { Skeleton } from '@/components/ui/skeleton'
import { ContactPopup } from '@/components/inquiry/ContactPopup'
import { consumerRequest } from '@/services/consumer-api'
import type { Vehicle } from '@/types/vehicle'

const SelectVehiclePage: FC = () => {
  const router = Taro.getCurrentInstance().router
  const params = router?.params || {}
  const mode = (params.mode || 'monthly') as 'monthly' | 'rental'

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showContact, setShowContact] = useState(false)

  useEffect(() => {
    consumerRequest({ url: `/api/content/vehicles?mode=${mode}` })
      .then((data: any) => {
        console.log('[SelectVehicle] vehicles:', data?.length)
        setVehicles(data || [])
      })
      .catch(() => setVehicles([]))
      .finally(() => setLoading(false))
  }, [mode])

  const handleBack = () => Taro.navigateBack()

  const handleSubmit = async () => {
    if (!selectedId || submitting) return
    setSubmitting(true)
    try {
      const payload: any = {
        type: mode,
        vehicleId: selectedId,
      }
      // Transfer form data from URL params
      if (mode === 'monthly') {
        payload.senderAddress = decodeURIComponent(params.senderAddress || '')
        payload.receiverAddress = decodeURIComponent(params.receiverAddress || '')
        payload.contactName = decodeURIComponent(params.contactName || '')
        payload.phone = decodeURIComponent(params.phone || '')
        payload.companyName = decodeURIComponent(params.companyName || '') || undefined
        payload.cargoType = decodeURIComponent(params.cargoType || '')
        payload.deliveryCycle = decodeURIComponent(params.deliveryCycle || '')
        payload.monthlyTrips = Number(params.monthlyTrips) || undefined
      } else {
        payload.contactName = decodeURIComponent(params.contactName || '')
        payload.phone = decodeURIComponent(params.phone || '')
        payload.companyName = decodeURIComponent(params.companyName || '') || undefined
        payload.consultContent = decodeURIComponent(params.consultContent || '') || undefined
      }
      console.log('[SelectVehicle] submit:', payload)
      const res = await consumerRequest({
        url: '/api/content/inquiries',
        method: 'POST',
        data: payload,
      })
      console.log('[SelectVehicle] response:', res)
      setShowContact(true)
    } catch (err) {
      console.error('[SelectVehicle] error:', err)
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="min-h-screen bg-slate-50 pb-28">
      {/* 顶部标题栏 */}
      <View style={{ position: 'sticky', top: 0, zIndex: 10 }} className="bg-white border-b border-slate-100">
        <View className="flex items-center px-4 h-12">
          <View className="flex items-center gap-2" onClick={handleBack}>
            <ArrowLeft size={18} color="#1E293B" />
            <Text className="block text-base font-medium text-slate-800">
              {mode === 'monthly' ? '选择包月车型' : '选择租购车型'}
            </Text>
          </View>
        </View>
      </View>

      <View className="p-4">
        <Text className="block text-sm text-slate-500 mb-4">
          请选择您感兴趣的车型，提交后客服将联系您提供详细方案
        </Text>

        {loading ? (
          <View className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </View>
        ) : vehicles.length === 0 ? (
          <Text className="block py-10 text-center text-sm text-slate-500">暂无可用车型</Text>
        ) : (
          <View className="space-y-3">
            {vehicles.map(vehicle => {
              const isSelected = selectedId === vehicle.id
              return (
                <View
                  key={vehicle.id}
                  className={`rounded-xl border-2 p-3 flex gap-3 ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white'}`}
                  onClick={() => setSelectedId(vehicle.id)}
                >
                  {/* 车型图片 */}
                  <View className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 flex items-center justify-center">
                    {vehicle.images?.[0] ? (
                      <Image className="w-full h-full" mode="aspectFill" src={vehicle.images[0]} />
                    ) : (
                      <Text className="block text-xs text-slate-400">{vehicle.name}</Text>
                    )}
                  </View>
                  {/* 车型信息 */}
                  <View className="flex-1 min-w-0">
                    <Text className="block text-base font-semibold text-slate-800">{vehicle.fullName}</Text>
                    <Text className="block text-xs text-slate-500 mt-1 line-clamp-2">{vehicle.subtitle}</Text>
                    {vehicle.pricingDescription?.startFrom !== undefined && (
                      <Text className="block text-sm font-bold text-blue-600 mt-2">
                        ¥{vehicle.pricingDescription.startFrom}/月
                      </Text>
                    )}
                  </View>
                  {/* 选中标记 */}
                  {isSelected && (
                    <View className="flex-shrink-0 mt-1">
                      <CircleCheck size={20} color="#2088D8" />
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}
      </View>

      {/* 底部操作栏 */}
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
        <View
          className={`w-full h-11 rounded-lg flex items-center justify-center ${selectedId ? 'bg-blue-600' : 'bg-slate-200'}`}
          onClick={selectedId ? handleSubmit : undefined}
        >
          <Text className={`block text-base font-medium ${selectedId ? 'text-white' : 'text-slate-400'}`}>
            {submitting ? '提交中...' : selectedId ? '提交咨询' : '请选择车型'}
          </Text>
        </View>
      </View>

      {/* 客服联系弹窗 */}
      <ContactPopup open={showContact} onClose={() => { setShowContact(false); Taro.navigateBack({ delta: 2 }) }} />
    </View>
  )
}

export default SelectVehiclePage
