/**
 * 车型详情页
 *
 * 路由参数:
 * - vehicleId: 必填
 * - mode: 'single' | 'monthly' | 'rental' | 'purchase'
 */

import { Image, View, Text, Swiper, SwiperItem } from '@tarojs/components'
import { useState, useEffect } from 'react'
import type { FC } from 'react'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, Battery, Gauge, Grid3x3, Weight, Ruler,
  ChevronRight, X, Truck,
} from 'lucide-react-taro'
import { getVehicleSnapshot, refreshVehicle } from '@/services/vehicle-catalog'
import { useOrderDraftStore } from '@/stores/orderDraft'
import type { Vehicle, VehicleMode } from '@/types/vehicle'
import { PageHeader } from '@/components/layout/page-header'
import { FixedActionBar } from '@/components/layout/fixed-action-bar'
import { ScrollArea } from '@/components/ui/scroll-area'

const MODE_BUTTON_LABEL: Record<VehicleMode, string> = {
  single: '选购该车型',
  monthly: '选购该车型',
  rental: '选购该车型',
  purchase: '选购该车型',
}

const VehicleDetailPage: FC = () => {
  const router = Taro.getCurrentInstance().router
  const vehicleId = router?.params?.vehicleId || ''
  const modeParam = (router?.params?.mode || 'single') as VehicleMode

  const initialVehicle = getVehicleSnapshot(vehicleId)
  const [vehicle, setVehicle] = useState<Vehicle | null>(initialVehicle)
  const [loaded, setLoaded] = useState(Boolean(initialVehicle))
  const [currentImg, setCurrentImg] = useState(0)
  const [previewIdx, setPreviewIdx] = useState(-1) // -1 = 未预览

  useEffect(() => {
    let active = true
    const snapshot = getVehicleSnapshot(vehicleId)
    setVehicle(snapshot)
    setLoaded(Boolean(snapshot))
    refreshVehicle(vehicleId)
      .then(result => { if (active) setVehicle(result) })
      .catch(() => { if (active && !snapshot) setVehicle(null) })
      .finally(() => { if (active) setLoaded(true) })
    return () => { active = false }
  }, [vehicleId])

  const handleBack = () => Taro.navigateBack()

  if (!vehicle) {
    return (
      <View className="flex h-screen flex-col bg-slate-50">
        <PageHeader title="车型详情" onBack={handleBack} />
        <View className="flex-1 flex flex-col items-center justify-center px-6">
          <Text className="block text-base text-slate-700 mt-4 font-medium">{loaded ? '未找到该车型' : '正在加载…'}</Text>
          <Button className="mt-6 w-full max-w-sm h-11 bg-blue-600 text-white" onClick={handleBack}>
            <Text className="block">返回</Text>
          </Button>
        </View>
      </View>
    )
  }

  const modeSupported = vehicle.supportedModes.includes(modeParam)
  const activeMode: VehicleMode = modeParam

  const handlePrimaryAction = () => {
    if (!modeSupported) {
      Taro.showToast({ title: '该车型不支持当前业务模式', icon: 'none' })
      return
    }

    let targetUrl = ''
    if (activeMode === 'single') {
      const store = useOrderDraftStore.getState()
      store.initDraft('single', vehicle.id)
      targetUrl = '/pages/order/create/index?mode=single'
    } else if (activeMode === 'monthly') {
      targetUrl = `/pages/inquiry/monthly/index?vehicleId=${vehicle.id}`
    } else {
      targetUrl = `/pages/inquiry/rental/index?vehicleId=${vehicle.id}`
    }

    Taro.navigateTo({ url: targetUrl }).catch(() => {
      Taro.showToast({ title: '页面打开失败，请重试', icon: 'none' })
    })
  }

  const primaryLabel = modeSupported ? MODE_BUTTON_LABEL[activeMode] : '重新选择业务模式'
  const startFrom = vehicle.pricingDescription.startFrom
  const images = vehicle.images?.length ? vehicle.images : []
  const includedKm = (vehicle.pricingDescription as any).includedKm

  return (
    <View className="flex h-screen flex-col overflow-hidden bg-background">
      {/* 顶部标题 */}
      <PageHeader title="车型详情" onBack={handleBack} />

      <ScrollArea className="min-h-0 w-full flex-1">
      {/* 图片轮播 */}
      {images.length > 0 ? (
        <View className="relative w-full bg-white">
          <Swiper
            className="h-60 w-full"
            indicatorDots={images.length > 1}
            indicatorColor="rgba(255,255,255,0.4)"
            indicatorActiveColor="#fff"
            autoplay={false}
            circular={images.length > 1}
            onChange={(e) => setCurrentImg(e.detail.current)}
          >
            {images.map((src, idx) => (
              <SwiperItem key={idx}>
                <View className="h-full w-full" onClick={() => setPreviewIdx(idx)}>
                  <Image className="h-full w-full" mode="aspectFit" src={src} />
                </View>
              </SwiperItem>
            ))}
          </Swiper>
          {/* 指示器（自定义） */}
          {images.length > 1 && (
            <View className="absolute bottom-2 right-3 bg-black rounded-full px-2 py-1" style={{ opacity: 0.6 }}>
              <Text className="block text-xs text-white">{currentImg + 1}/{images.length}</Text>
            </View>
          )}
          {vehicle.specs.temperatureRange && (
            <View className="absolute top-3 right-3">
              <Badge className="bg-cyan-500 text-white border-0">
                冷藏 {vehicle.specs.temperatureRange}
              </Badge>
            </View>
          )}
        </View>
      ) : (
        <View className="flex h-60 w-full items-center justify-center bg-slate-100">
          <View className="flex flex-col items-center gap-3"><Truck size={72} color="#2088D8" strokeWidth={1.2} /><Text className="block text-xl font-semibold text-slate-500">{vehicle.name}</Text></View>
          {vehicle.specs.temperatureRange && (
            <View className="absolute top-3 right-3">
              <Badge className="bg-cyan-500 text-white border-0">冷藏 {vehicle.specs.temperatureRange}</Badge>
            </View>
          )}
        </View>
      )}

      <View className="px-4 py-5">
        {/* 名称 + 简介 */}
        <View className="mb-4">
          <Text className="block text-2xl font-semibold text-slate-900">{vehicle.fullName}</Text>
          <Text className="block text-sm text-slate-500 mt-2 leading-relaxed">{vehicle.subtitle || vehicle.description}</Text>
        </View>

        {/* 核心参数 */}
        <Card className="mb-3">
          <CardContent className="p-4">
            <View className="grid grid-cols-2 gap-3">
              <View className="rounded-lg bg-slate-50 p-3">
                <View className="flex items-center gap-2 mb-1">
                  <Weight size={14} color="#2088D8" />
                  <Text className="block text-xs text-slate-500">额定载重</Text>
                </View>
                <Text className="block text-sm font-semibold text-slate-800">
                  {vehicle.specs.maxLoadKg > 0 ? `${vehicle.specs.maxLoadKg} kg` : '以实际车型为准'}
                </Text>
              </View>
              <View className="rounded-lg bg-slate-50 p-3">
                <View className="flex items-center gap-2 mb-1">
                  <Grid3x3 size={14} color="#2088D8" />
                  <Text className="block text-xs text-slate-500">货厢容积</Text>
                </View>
                <Text className="block text-sm font-semibold text-slate-800">{vehicle.specs.cargoVolume}</Text>
              </View>
              <View className="rounded-lg bg-slate-50 p-3">
                <View className="flex items-center gap-2 mb-1">
                  <Battery size={14} color="#2088D8" />
                  <Text className="block text-xs text-slate-500">最大续航</Text>
                </View>
                <Text className="block text-sm font-semibold text-slate-800">
                  {vehicle.specs.maxRangeKm > 0 ? `${vehicle.specs.maxRangeKm} km` : '以实际车型为准'}
                </Text>
              </View>
              <View className="rounded-lg bg-slate-50 p-3">
                <View className="flex items-center gap-2 mb-1">
                  <Gauge size={14} color="#2088D8" />
                  <Text className="block text-xs text-slate-500">运行时速</Text>
                </View>
                <Text className="block text-sm font-semibold text-slate-800">{vehicle.specs.speedKmh}km/h</Text>
              </View>
              {vehicle.specs.cargoDimensionsMm && (
                <View className="col-span-2 rounded-lg bg-slate-50 p-3">
                  <View className="flex items-center gap-2 mb-1">
                    <Ruler size={14} color="#2088D8" />
                    <Text className="block text-xs text-slate-500">货箱尺寸(参考)</Text>
                  </View>
                  <Text className="block text-base font-semibold text-slate-800">
                    {vehicle.specs.cargoDimensionsMm.length} × {vehicle.specs.cargoDimensionsMm.width} × {vehicle.specs.cargoDimensionsMm.height} mm
                  </Text>
                </View>
              )}
            </View>
          </CardContent>
        </Card>

        {/* 适用场景 */}
        <View className="mb-3">
          <Text className="mb-2 block text-base font-semibold text-slate-900">适用场景</Text>
          <View className="flex flex-wrap gap-2">
            {vehicle.applicableScenes.map(scene => (
              <Badge key={scene} className="border-0 bg-slate-100 text-xs font-normal text-slate-600">{scene}</Badge>
            ))}
          </View>
        </View>

        <Card className="mb-4 border-blue-100">
          <CardContent className="p-4">
            <Text className="block text-base font-semibold text-slate-800 mb-2">{activeMode === 'monthly' ? '包月专线' : activeMode === 'single' ? '按趟配送' : '租购服务'}</Text>
            <Text className="block text-sm text-slate-700 mb-3">{vehicle.pricingDescription.description}</Text>
            {vehicle.pricingDescription.breakdown && (
              <View className="bg-white rounded-lg p-3">
                {vehicle.pricingDescription.breakdown.map((b, idx) => (
                  <View key={idx}>
                    <View className="flex items-center justify-between py-2">
                      <Text className="block text-sm text-slate-600">{b.label}</Text>
                      <Text className="block text-sm font-medium text-slate-800">
                        {typeof b.amount === 'number' ? `¥${b.amount}` : b.amount}
                      </Text>
                    </View>
                    {idx < (vehicle.pricingDescription.breakdown?.length || 0) - 1 && <Separator />}
                  </View>
                ))}
              </View>
            )}
            {startFrom !== undefined && (
              <View className="mt-3 flex items-end justify-between">
                <Text className="block text-xs text-slate-400">参考价格，最终以后台核价为准</Text>
                <Text className="block text-2xl font-bold text-primary">¥{startFrom}</Text>
              </View>
            )}
            {includedKm !== undefined && includedKm > 0 && (
              <View className="mt-2 flex items-center justify-between">
                <Text className="block text-sm text-slate-500">包含公里数</Text>
                <Text className="block text-base font-medium text-slate-800">{includedKm} km</Text>
              </View>
            )}
            <Text className="block text-xs text-amber-700 mt-3">
              ⚠️ 此为起步参考价，最终费用由服务端根据实际路线核验后给出
            </Text>
          </CardContent>
        </Card>
      </View>
      </ScrollArea>

      {/* 图片预览弹窗 */}
      {previewIdx >= 0 && (
        <View
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
          onClick={() => setPreviewIdx(-1)}
        >
          <View className="absolute top-4 right-4 z-10" onClick={(e) => { e.stopPropagation(); setPreviewIdx(-1) }}>
            <X size={24} color="#fff" />
          </View>
          {images[previewIdx] && (
            <Image
              className="w-full max-h-full"
              mode="aspectFit"
              src={images[previewIdx]}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <View className="absolute bottom-8 flex items-center gap-4">
            {previewIdx > 0 && (
              <View className="bg-white rounded-full p-2" style={{ opacity: 0.2 }} onClick={(e) => { e.stopPropagation(); setPreviewIdx(previewIdx - 1) }}>
                <ArrowLeft size={20} color="#fff" />
              </View>
            )}
            <Text className="block text-sm text-white">{previewIdx + 1} / {images.length}</Text>
            {previewIdx < images.length - 1 && (
              <View className="bg-white rounded-full p-2" style={{ opacity: 0.2 }} onClick={(e) => { e.stopPropagation(); setPreviewIdx(previewIdx + 1) }}>
                <ChevronRight size={20} color="#fff" />
              </View>
            )}
          </View>
        </View>
      )}

      {/* 页面内操作栏：参与详情页转场，避免 fixed 层提前叠到首页。 */}
      <FixedActionBar fixed={false}>
        <View className="flex items-center gap-3">
          <View className="flex-1">
            {startFrom !== undefined && (
              <Text className="block text-xs text-slate-500">起步 ¥{startFrom}</Text>
            )}
            <Text className="block text-sm font-medium text-slate-800">
              {activeMode === 'single' ? '按趟结算' : activeMode === 'monthly' ? '包月专线' : '租购咨询'}
            </Text>
          </View>
          <Button
            className="h-11 bg-primary px-6 text-white"
            onClick={handlePrimaryAction}
          >
            <View className="flex items-center gap-2">
              <Text className="block text-base">{primaryLabel}</Text>
              <ChevronRight size={16} color="#fff" />
            </View>
          </Button>
        </View>
      </FixedActionBar>
    </View>
  )
}

export default VehicleDetailPage
