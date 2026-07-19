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
 * - 模拟创建订单
 */

import { Image, View, Text, Swiper, SwiperItem } from '@tarojs/components'
import { useState } from 'react'
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
import './index.css'

const IndexPage: FC = () => {
  const [activeTab, setActiveTab] = useState<ServiceMode>('single')
  const [currentBanner, setCurrentBanner] = useState(0)
  const { data: catalog, loading: loadingCatalog } = useSWR<Vehicle[]>(
    `vehicles-${activeTab}`, () => consumerRequest({ url: `/api/content/vehicles?mode=${activeTab}` }), 'static'
  )
  const { data: banners } = useSWR<BannerItem[]>(
    'banners', () => consumerRequest({ url: '/api/content/banners' }), 'static'
  )

  const vehicles = catalog || []

  /** 轮播图背景颜色 */
  const getBannerColor = (bannerId: string): string => {
    const colors: Record<string, string> = {
      'banner-1': '#2088D8',
      'banner-2': '#28a745',
      'banner-3': '#17a2b8',
      'banner-4': '#6f42c1',
    }
    return colors[bannerId] || '#2088D8'
  }

  /** 点击车型卡片 → 统一进入车型详情页 */
  const handleVehicleClick = (vehicle: Vehicle) => {
    Taro.navigateTo({
      url: `/pages/vehicle/detail/index?vehicleId=${encodeURIComponent(vehicle.id)}&mode=${activeTab}`,
    }).catch(() => Taro.showToast({ title: '车型详情打开失败', icon: 'none' }))
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
    <View className="min-h-screen bg-slate-50">
      {/* 轮播图 */}
      {(banners || []).length > 0 && (
        <View className="w-full relative overflow-hidden">
          <Swiper
            className="w-full h-48"
            indicatorDots={(banners || []).length > 1}
            autoplay={(banners || []).length > 1}
            interval={3000}
            duration={500}
            circular={(banners || []).length > 1}
            current={currentBanner}
            onChange={(e) => setCurrentBanner(e.detail.current)}
          >
            {(banners || []).map(banner => (
              <SwiperItem key={banner.id} onClick={() => handleBannerClick(banner)}>
                <View
                  className="w-full h-48 relative flex items-center justify-center"
                  style={{ backgroundColor: getBannerColor(banner.id) }}
                >
                  {banner.image && <Image className="absolute inset-0 w-full h-full" mode="aspectFill" src={banner.image} />}
                  <Text className="block relative z-10 text-white text-xl font-bold text-center">
                    {banner.title}
                  </Text>
                </View>
              </SwiperItem>
            ))}
          </Swiper>
        </View>
      )}

      {/* 服务模式切换 — 吸顶无间距 */}
      <View style={{ position: 'sticky', top: 0, zIndex: 50 }} className="bg-white">
        <ServiceModeSwitcher value={activeTab} onChange={setActiveTab} />
      </View>

      {/* 车型列表 */}
      <View className="p-4 pb-16">
        <View className="mb-4">
          <Text className="block text-lg font-semibold text-slate-800">
            {activeTab === 'single'
              ? '选择无人配送车型'
              : activeTab === 'monthly'
                ? '包月专线车型'
                : '无人车辆租购服务'}
          </Text>
          <Text className="block text-sm text-slate-400 mt-1">
            {activeTab === 'single'
              ? '九识智能全系车型,精准匹配您的配送需求'
              : activeTab === 'monthly'
                ? '包月专线享专属优惠,按月统一对账结算'
                : '九识全系车型租赁与整车采购咨询'}
          </Text>
        </View>

        {loadingCatalog ? <View className="grid grid-cols-2 gap-3"><Skeleton className="h-48" /><Skeleton className="h-48" /></View> : vehicles.length === 0 ? <Text className="block py-10 text-center text-sm text-slate-500">暂无可用车型</Text> : <View className="grid grid-cols-2 gap-3">
          {vehicles.map((vehicle, index) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              index={index}
              onSelect={handleVehicleClick}
            />
          ))}
        </View>}
      </View>
    </View>
  )
}

export default IndexPage
