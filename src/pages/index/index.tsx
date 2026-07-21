/**
 * 唐小识无人运力配送小程序 - 首页
 *
 * 职责:
 * - 服务入口与车型展示
 * - 按服务模式(single / monthly / rental)展示车型列表
 * - 点击车型卡片 → 跳转车型详情页
 *
 * 不再做:
 * - 完整下单流程(交给 pages/order/create)
 * - 弹窗式车型选择(交给 pages/vehicle/detail)
 */

import { Image, View, Text, Swiper, SwiperItem } from '@tarojs/components'
import { useRef, useState } from 'react'
import type { FC } from 'react'
import Taro from '@tarojs/taro'
import {
  VehicleCard,
} from '@/components/vehicle/VehicleCard'
import {
  ServiceModeSwitcher,
  type ServiceMode,
} from '@/components/vehicle/ServiceModeSwitcher'
import type { BannerItem } from '@/data/banners'
import type { Vehicle } from '@/types/vehicle'
import { useSWR } from '@/stores/data-cache'
import { consumerRequest } from '@/services/consumer-api'
import { Skeleton } from '@/components/ui/skeleton'
import { primeVehicleCache } from '@/services/vehicle-catalog'
import './index.css'

const IndexPage: FC = () => {
  const [activeTab, setActiveTab] = useState<ServiceMode>('single')
  const [currentBanner, setCurrentBanner] = useState(0)
  const [openingVehicleId, setOpeningVehicleId] = useState<string | null>(null)
  const navigatingRef = useRef(false)
  const { data: catalog, loading: loadingCatalog } = useSWR<Vehicle[]>(
    `vehicles-v2-${activeTab}`, async () => {
      const result = await consumerRequest<Vehicle[]>({ url: `/api/content/vehicles?mode=${activeTab}` })
      return result || []
    }, 'static'
  )
  const { data: banners } = useSWR<BannerItem[]>(
    'banners-v2', async () => {
      const result = await consumerRequest<BannerItem[]>({ url: '/api/content/banners' })
      return result || []
    }, 'static'
  )

  const vehicles = catalog || []
  const visibleBanners = banners || []

  /** 点击车型卡片 → 统一进入车型详情页 */
  const handleVehicleClick = async (vehicle: Vehicle) => {
    if (navigatingRef.current) return

    navigatingRef.current = true
    setOpeningVehicleId(vehicle.id)
    primeVehicleCache(vehicle)
    try {
      await Taro.navigateTo({
        url: `/pages/vehicle/detail/index?vehicleId=${encodeURIComponent(vehicle.id)}&mode=${activeTab}`,
      })
    } catch {
      Taro.showToast({ title: '车型详情打开失败', icon: 'none' })
    } finally {
      navigatingRef.current = false
      setOpeningVehicleId(null)
    }
  }

  /** 轮播图点击 */
  const handleBannerClick = (banner: BannerItem) => {
    switch (banner.linkType) {
      case 'vehicle': {
        const target = (catalog || []).find(v => v.id === banner.linkTarget)
        if (target) {
          handleVehicleClick(target)
        } else {
          Taro.showToast({ title: '活动详情页开发中', icon: 'none' })
        }
        break
      }
      case 'monthly':
        setActiveTab('monthly')
        break
      case 'service':
        setActiveTab('rental')
        break
      case 'activity':
      default:
        Taro.showToast({ title: '活动详情页开发中', icon: 'none' })
        break
    }
  }

  return (
    <View className="min-h-screen bg-background pb-6">
      {/* 轮播图 */}
      {visibleBanners.length > 0 && (
        <View className="px-4 pt-3">
          <View className="relative w-full overflow-hidden rounded-xl bg-slate-100">
          <Swiper
            className="h-44 w-full"
            indicatorDots={false}
            autoplay={visibleBanners.length > 1}
            interval={3000}
            duration={500}
            circular={visibleBanners.length > 1}
            current={currentBanner}
            onChange={(e) => setCurrentBanner(e.detail.current)}
          >
            {visibleBanners.map(banner => (
              <SwiperItem key={banner.id} onClick={() => handleBannerClick(banner)}>
                <View className="relative h-44 w-full overflow-hidden">
                  {banner.image ? (
                    <>
                      <Image className="h-full w-full" mode="aspectFill" src={banner.image} />
                      <View className="absolute bottom-0 left-0 right-0 px-4 py-3" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }}>
                        <Text className="block text-sm font-semibold text-white">{banner.title}</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View className="flex h-full w-full items-center bg-blue-50">
                        <View className="max-w-xs px-5">
                          <Text className="block whitespace-pre-line text-xl font-bold leading-relaxed text-slate-900">{banner.title}</Text>
                          <Text className="mt-2 block text-xs text-primary">安全可靠 · 准时送达</Text>
                        </View>
                      </View>
                      <View className="absolute -bottom-8 -right-8 h-36 w-36 rounded-full bg-blue-100" />
                    </>
                  )}
                </View>
              </SwiperItem>
            ))}
          </Swiper>
          {visibleBanners.length > 1 && (
            <View className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
              {visibleBanners.map((banner, index) => (
                <View key={banner.id} className={`h-1 rounded-full ${index === currentBanner ? 'w-5 bg-primary' : 'w-2 bg-white'}`} />
              ))}
            </View>
          )}
          </View>
        </View>
      )}

      {/* 服务模式切换 */}
      <View className="px-4 pt-3">
        <ServiceModeSwitcher value={activeTab} onChange={setActiveTab} />
      </View>

      {/* 车型列表 */}
      <View className="px-4 pb-16 pt-5">
        <View className="mb-3">
          <Text className="block text-base font-semibold text-slate-900">
            {activeTab === 'single'
              ? '选择无人配送车型'
              : activeTab === 'monthly'
                ? '包月专线车型'
                : '无人车辆租购服务'}
          </Text>
          <Text className="mt-1 block text-xs leading-relaxed text-slate-500">
            {activeTab === 'single'
              ? '九识智能全系车型,精准匹配您的配送需求'
              : activeTab === 'monthly'
                ? '包月专线享专属优惠,按月统一对账结算'
                : '九识全系车型租赁与整车采购咨询'}
          </Text>
        </View>

        {loadingCatalog ? <View className="space-y-3"><Skeleton className="h-36 rounded-xl" /><Skeleton className="h-36 rounded-xl" /></View> : vehicles.length === 0 ? <Text className="block py-10 text-center text-sm text-slate-500">暂无可用车型</Text> : <View className="space-y-3">
          {vehicles.map((vehicle, index) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              index={index}
              onSelect={handleVehicleClick}
              disabled={openingVehicleId !== null}
            />
          ))}
        </View>}
      </View>
    </View>
  )
}

export default IndexPage
