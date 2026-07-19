/**
 * 轮播图数据配置
 *
 * 轮播图使用车型真实 TOS 图片，底部叠加标题文字
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

export const defaultBanners: BannerItem[] = [
  {
    id: 'banner-1',
    image: '',
    title: 'Z5(2026) 厢式货车 — 按趟即刻出发',
    linkType: 'vehicle',
    linkTarget: 'z5-2026',
    sort: 1,
    enabled: true
  },
  {
    id: 'banner-2',
    image: '',
    title: 'Z8Max 冷藏配送 — 全程温控保障',
    linkType: 'vehicle',
    linkTarget: 'z8-max-c',
    sort: 2,
    enabled: true
  },
  {
    id: 'banner-3',
    image: '',
    title: 'Z5 多格货柜 — 企业包月专线',
    linkType: 'monthly',
    linkTarget: '',
    sort: 3,
    enabled: true
  }
];

export const getEnabledBanners = (bannerItems: BannerItem[]): BannerItem[] => {
  return bannerItems.filter(b => b.enabled).sort((a, b) => a.sort - b.sort);
};
