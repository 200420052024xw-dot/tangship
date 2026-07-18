/**
 * 轮播图数据配置
 * 
 * 重要说明：
 * 1. 所有图片使用纯色背景 View + Text 渲染，避免 Image 组件的 SVG data URL 加载错误
 * 2. 轮播图颜色使用冰川蓝科技风配色：#2088D8（主色）、#28a745（绿）、#17a2b8（青）、#6f42c1（紫）
 * 3. 后期替换为真实图片时，上传到 TOS 对象存储，使用返回的 URL
 * 
 * @updated 2026-07-13 21:25 - 移除 SVG data URL，改用纯色背景
 */

export interface BannerItem {
  id: string
  image: string
  title: string
  linkType: 'vehicle' | 'monthly' | 'service' | 'activity'
  linkTarget: string
  sort: number
  enabled: boolean
}

// 轮播图SVG占位符（直接硬编码，避免函数调用）
const BANNER_SVGS = {
  'banner-1': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"%3E%3Crect fill="%232088D8" width="800" height="400"/%3E%3Ctext x="400" y="200" text-anchor="middle" fill="%23fff" font-size="32" font-weight="bold"%3E九识智能无人配送车%3C/text%3E%3Ctext x="400" y="350" text-anchor="middle" fill="%23fff" font-size="16" opacity="0.7"%3E轮播图 1%3C/text%3E%3C/svg%3E',
  'banner-2': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"%3E%3Crect fill="%2328a745" width="800" height="400"/%3E%3Ctext x="400" y="200" text-anchor="middle" fill="%23fff" font-size="32" font-weight="bold"%3E包月专线合作%3C/text%3E%3Ctext x="400" y="350" text-anchor="middle" fill="%23fff" font-size="16" opacity="0.7"%3E轮播图 2%3C/text%3E%3C/svg%3E',
  'banner-3': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"%3E%3Crect fill="%2317a2b8" width="800" height="400"/%3E%3Ctext x="400" y="200" text-anchor="middle" fill="%23fff" font-size="28" font-weight="bold"%3EZ8%2B冷藏车%3C/text%3E%3Ctext x="400" y="240" text-anchor="middle" fill="%23fff" font-size="18"%3E-20℃~12℃超宽温控%3C/text%3E%3Ctext x="400" y="350" text-anchor="middle" fill="%23fff" font-size="16" opacity="0.7"%3E轮播图 3%3C/text%3E%3C/svg%3E',
  'banner-4': 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"%3E%3Crect fill="%236f42c1" width="800" height="400"/%3E%3Ctext x="400" y="200" text-anchor="middle" fill="%23fff" font-size="28" font-weight="bold"%3E租车购车服务%3C/text%3E%3Ctext x="400" y="240" text-anchor="middle" fill="%23fff" font-size="18"%3E九识全系车型%3C/text%3E%3Ctext x="400" y="350" text-anchor="middle" fill="%23fff" font-size="16" opacity="0.7"%3E轮播图 4%3C/text%3E%3C/svg%3E'
};

export const defaultBanners: BannerItem[] = [
  {
    id: 'banner-1',
    image: BANNER_SVGS['banner-1'],
    title: '九识智能无人配送车',
    linkType: 'vehicle',
    linkTarget: 'z5-2026',
    sort: 1,
    enabled: true
  },
  {
    id: 'banner-2',
    image: BANNER_SVGS['banner-2'],
    title: '包月专线合作 开启智能配送新时代',
    linkType: 'monthly',
    linkTarget: 'monthly-intro',
    sort: 2,
    enabled: true
  },
  {
    id: 'banner-3',
    image: BANNER_SVGS['banner-3'],
    title: 'Z8+冷藏车 - -20℃~12℃超宽温控',
    linkType: 'vehicle',
    linkTarget: 'z8-plus-cold',
    sort: 3,
    enabled: true
  },
  {
    id: 'banner-4',
    image: BANNER_SVGS['banner-4'],
    title: '租车购车服务 - 九识全系车型',
    linkType: 'service',
    linkTarget: 'rental',
    sort: 4,
    enabled: true
  }
];

export const getEnabledBanners = (bannerItems: BannerItem[]): BannerItem[] => {
  return bannerItems.filter(b => b.enabled).sort((a, b) => a.sort - b.sort);
};
