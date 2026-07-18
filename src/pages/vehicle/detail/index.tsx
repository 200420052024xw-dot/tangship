/**
 * 车型详情页
 *
 * 路由参数(只用于查找本地常量,不可作为价格/参数来源):
 * - vehicleId: 必填
 * - mode: 'single' | 'monthly' | 'rental' | 'purchase'
 *
 * ⚠️ URL 中传入的 vehicleId 只用于查表,不信任任何其他字段
 */

import { Image, View, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'
import type { FC } from 'react'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, Battery, Gauge, Grid3x3, Weight, Truck,
  Snowflake, CircleCheck, TriangleAlert, Clock, ChevronRight,
} from 'lucide-react-taro'
import { fetchVehicle } from '@/services/vehicle-catalog'
import { useOrderDraftStore } from '@/stores/orderDraft'
import type { Vehicle, VehicleMode } from '@/types/vehicle'

const MODE_BUTTON_LABEL: Record<VehicleMode, string> = {
  single: '选用该车型',
  monthly: '申请包月方案',
  rental: '咨询租赁',
  purchase: '咨询购买',
}

const VehicleDetailPage: FC = () => {
  const router = Taro.getCurrentInstance().router
  const vehicleId = router?.params?.vehicleId || ''
  const modeParam = (router?.params?.mode || 'single') as VehicleMode

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
    fetchVehicle(vehicleId)
      .then(setVehicle)
      .catch(() => setVehicle(null))
      .finally(() => setLoaded(true))
  }, [vehicleId])

  const handleBack = () => Taro.navigateBack()

  /** 路由 fallback:无效车型或参数错误 */
  if (!vehicle) {
    return (
      <View className="min-h-screen bg-slate-50 flex flex-col">
        <View className="sticky top-0 z-10 bg-white border-b border-slate-100">
          <View className="flex items-center px-4 h-12">
            <View className="flex items-center gap-2" onClick={handleBack}>
              <ArrowLeft size={18} color="#1E293B" />
              <Text className="block text-base font-medium text-slate-800">车型详情</Text>
            </View>
          </View>
        </View>
        <View className="flex-1 flex flex-col items-center justify-center px-6">
          <TriangleAlert size={48} color="#94A3B8" />
          <Text className="block text-base text-slate-700 mt-4 font-medium">{loaded ? '未找到该车型' : '正在加载车型…'}</Text>
          <Text className="block text-sm text-slate-400 mt-2 text-center">
            {loaded ? '车型已下线或链接失效,请返回首页重新选择' : '正在读取后台车型配置'}
          </Text>
          <Button
            className="mt-6 w-full max-w-sm h-11 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleBack}
          >
            <Text className="block">返回上一页</Text>
          </Button>
        </View>
      </View>
    )
  }

  const modeSupported = vehicle.supportedModes.includes(modeParam)
  const activeMode: VehicleMode = modeParam

  const handlePrimaryAction = () => {
    if (!modeSupported) {
      Taro.showToast({ title: '该车型不支持当前业务模式，请返回重新选择', icon: 'none' })
      return
    }
    if (activeMode === 'single') {
      // 按趟结算: 创建草稿,进入下单流程
      const store = useOrderDraftStore.getState()
      store.initDraft('single', vehicle.id)
      Taro.navigateTo({ url: '/pages/order/create/index?mode=single' })
    } else if (activeMode === 'monthly') {
      // 包月专线: 先填信息再选车,这里已选车,进入包月信息填写页
      Taro.navigateTo({ url: `/pages/inquiry/monthly/index?vehicleId=${vehicle.id}` })
    } else {
      // 租购服务: 先填信息再选车,这里已选车,进入租购信息填写页
      Taro.navigateTo({ url: `/pages/inquiry/rental/index?vehicleId=${vehicle.id}` })
    }
  }

  const primaryLabel = modeSupported ? MODE_BUTTON_LABEL[activeMode] : '重新选择业务模式'
  const startFrom = vehicle.pricingDescription.startFrom

  return (
    <View className="min-h-screen bg-slate-50 pb-24">
      {/* 顶部标题 */}
      <View className="sticky top-0 z-10 bg-white border-b border-slate-100">
        <View className="flex items-center px-4 h-12">
          <View className="flex items-center gap-2" onClick={handleBack}>
            <ArrowLeft size={18} color="#1E293B" />
            <Text className="block text-base font-medium text-slate-800">车型详情</Text>
          </View>
        </View>
      </View>

      {/* 主图(占位) */}
      <View className="w-full h-48 relative overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#2088D8' }}>
        {vehicle.images?.[0] ? <Image className="w-full h-full" mode="aspectFill" src={vehicle.images[0]} /> : <Text className="block text-white text-2xl font-bold">{vehicle.name}</Text>}
        {vehicle.specs.temperatureRange && (
          <View className="absolute top-3 right-3">
            <Badge className="bg-cyan-500 text-white border-0">
              冷藏 {vehicle.specs.temperatureRange}
            </Badge>
          </View>
        )}
      </View>

      <View className="px-4 py-3">
        {/* 名称 + 副标题 + 标签 */}
        <View className="mb-4">
          <Text className="block text-xl font-semibold text-slate-800">{vehicle.fullName}</Text>
          <Text className="block text-sm text-slate-500 mt-1">{vehicle.subtitle}</Text>
          {vehicle.tags.length > 0 && (
            <View className="flex flex-wrap gap-2 mt-3">
              {vehicle.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">
                  {tag}
                </Badge>
              ))}
            </View>
          )}
        </View>

        {/* 核心参数 */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <Text className="block text-base font-semibold text-slate-800 mb-3">核心参数</Text>
            <View className="grid grid-cols-2 gap-3">
              <View className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-3">
                <View className="flex items-center gap-2 mb-1">
                  <Weight size={14} color="#2088D8" />
                  <Text className="block text-xs text-slate-500">额定载重</Text>
                </View>
                <Text className="block text-base font-semibold text-slate-800">
                  {vehicle.specs.maxLoadKg > 0 ? `${vehicle.specs.maxLoadKg} kg` : '以实际车型为准'}
                </Text>
              </View>
              <View className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-3">
                <View className="flex items-center gap-2 mb-1">
                  <Grid3x3 size={14} color="#2088D8" />
                  <Text className="block text-xs text-slate-500">货厢容积</Text>
                </View>
                <Text className="block text-base font-semibold text-slate-800">
                  {vehicle.specs.cargoVolume}
                </Text>
              </View>
              <View className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-3">
                <View className="flex items-center gap-2 mb-1">
                  <Battery size={14} color="#2088D8" />
                  <Text className="block text-xs text-slate-500">最大续航</Text>
                </View>
                <Text className="block text-base font-semibold text-slate-800">
                  {vehicle.specs.maxRangeKm > 0 ? `${vehicle.specs.maxRangeKm} km` : '以实际车型为准'}
                </Text>
              </View>
              <View className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-3">
                <View className="flex items-center gap-2 mb-1">
                  <Gauge size={14} color="#2088D8" />
                  <Text className="block text-xs text-slate-500">运行时速</Text>
                </View>
                <Text className="block text-base font-semibold text-slate-800">
                  {vehicle.specs.speedKmh} km/h
                </Text>
              </View>
              <View className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-3 col-span-2">
                <View className="flex items-center gap-2 mb-1">
                  <Clock size={14} color="#2088D8" />
                  <Text className="block text-xs text-slate-500">充电时长</Text>
                </View>
                <Text className="block text-base font-semibold text-slate-800">
                  {vehicle.specs.chargeTime}
                </Text>
              </View>
            </View>

            {vehicle.specs.cargoDimensionsMm && (
              <View className="mt-3 bg-slate-50 rounded-lg p-3">
                <Text className="block text-xs text-slate-500 mb-1">货箱尺寸(参考)</Text>
                <Text className="block text-sm text-slate-700">
                  {vehicle.specs.cargoDimensionsMm.length} × {vehicle.specs.cargoDimensionsMm.width} × {vehicle.specs.cargoDimensionsMm.height} mm
                </Text>
              </View>
            )}
          </CardContent>
        </Card>

        {/* 简介 */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <Text className="block text-base font-semibold text-slate-800 mb-2">车型简介</Text>
            <Text className="block text-sm text-slate-600 leading-relaxed">{vehicle.description}</Text>
          </CardContent>
        </Card>

        {/* 适用场景 */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <Text className="block text-base font-semibold text-slate-800 mb-3">适合运输场景</Text>
            <View className="flex flex-wrap gap-2">
              {vehicle.applicableScenes.map(scene => (
                <Badge key={scene} variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-100">
                  <CircleCheck size={12} color="#2088D8" />
                  {scene}
                </Badge>
              ))}
            </View>
          </CardContent>
        </Card>

        {/* 使用限制 / 禁运提示 */}
        <Card className="mb-4 border-amber-100">
          <CardContent className="p-4">
            <View className="flex items-center gap-2 mb-3">
              <TriangleAlert size={16} color="#F59E0B" />
              <Text className="block text-base font-semibold text-slate-800">使用限制 / 禁运提示</Text>
            </View>
            <View className="space-y-2">
              {vehicle.restrictions.map((r, idx) => (
                <View key={idx} className="flex items-start gap-2">
                  <Text className="block text-sm text-slate-500">·</Text>
                  <Text className="block text-sm text-slate-700 flex-1">{r}</Text>
                </View>
              ))}
            </View>
            {vehicle.requiresApproval && (
              <View className="mt-3 bg-amber-50 rounded-lg p-3">
                <Text className="block text-xs text-amber-700">
                  该车型需提前预约冷链资质,具体请联系客服
                </Text>
              </View>
            )}
          </CardContent>
        </Card>

        {/* 服务说明 */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <View className="flex items-center gap-2 mb-3">
              <Truck size={16} color="#2088D8" />
              <Text className="block text-base font-semibold text-slate-800">服务说明</Text>
            </View>
            <View className="space-y-2">
              <View className="flex items-start gap-2">
                <Text className="block text-sm text-slate-500">·</Text>
                <Text className="block text-sm text-slate-700 flex-1">
                  服务范围:支持城区与园区内的货物配送
                </Text>
              </View>
              <View className="flex items-start gap-2">
                <Text className="block text-sm text-slate-500">·</Text>
                <Text className="block text-sm text-slate-700 flex-1">
                  计费方式:按服务模式与实际路线核验后报价
                </Text>
              </View>
              <View className="flex items-start gap-2">
                <Text className="block text-sm text-slate-500">·</Text>
                <Text className="block text-sm text-slate-700 flex-1">
                  装卸要求:装卸点需具备车辆可达的物理条件
                </Text>
              </View>
              {vehicle.specs.temperatureRange && (
                <View className="flex items-start gap-2">
                  <Snowflake size={14} color="#06B6D4" className="mt-1" />
                  <Text className="block text-sm text-slate-700 flex-1">
                    温控区间:{vehicle.specs.temperatureRange}
                  </Text>
                </View>
              )}
            </View>
          </CardContent>
        </Card>

        {/* 价格说明(非最终成交价) */}
        <Card className="mb-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-100">
          <CardContent className="p-4">
            <Text className="block text-base font-semibold text-slate-800 mb-2">价格说明</Text>
            <Text className="block text-sm text-slate-700 mb-3">
              {vehicle.pricingDescription.description}
            </Text>
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
              <View className="mt-3 flex items-center justify-between">
                <Text className="block text-sm text-slate-500">起步参考价</Text>
                <Text className="block text-lg font-bold text-blue-600">¥{startFrom}</Text>
              </View>
            )}
            <Text className="block text-xs text-amber-700 mt-3">
              ⚠️ 此为起步参考价,最终费用由服务端根据实际路线核验后给出
            </Text>
          </CardContent>
        </Card>

        {/* 常见问题 */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <Text className="block text-base font-semibold text-slate-800 mb-3">常见问题</Text>
            <View className="space-y-3">
              <View>
                <Text className="block text-sm font-medium text-slate-700 mb-1">Q:可以跨城配送吗?</Text>
                <Text className="block text-xs text-slate-500">A:支持城区与园区内的货物配送,跨城需求请联系客服。</Text>
              </View>
              <View>
                <Text className="block text-sm font-medium text-slate-700 mb-1">Q:如何确认可用时间?</Text>
                <Text className="block text-xs text-slate-500">A:最终可用时间由服务端结合运力核验后确认。</Text>
              </View>
              <View>
                <Text className="block text-sm font-medium text-slate-700 mb-1">Q:可以指定路线吗?</Text>
                <Text className="block text-xs text-slate-500">A:可以,需在备注中说明,实际通行以服务端评估为准。</Text>
              </View>
            </View>
          </CardContent>
        </Card>
      </View>

      {/* 底部固定操作栏 */}
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
        <View className="flex items-center gap-3">
          <View className="flex-1">
            {startFrom !== undefined && (
              <Text className="block text-xs text-slate-500">
                起步 ¥{startFrom}
              </Text>
            )}
            <Text className="block text-sm font-medium text-slate-800">
              {activeMode === 'single' ? '按趟结算' : activeMode === 'monthly' ? '包月专线' : '租购咨询'}
            </Text>
          </View>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg h-11 px-6"
            onClick={handlePrimaryAction}
          >
            <View className="flex items-center gap-2">
              <Text className="block text-base">{primaryLabel}</Text>
              <ChevronRight size={16} color="#fff" />
            </View>
          </Button>
        </View>
      </View>
    </View>
  )
}

export default VehicleDetailPage
