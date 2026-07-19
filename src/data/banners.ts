/** 轮播图数据类型 - 数据来自数据库 API */

export interface BannerItem {
  id: string
  image: string
  title: string
  linkType: 'vehicle' | 'monthly' | 'service' | 'activity'
  linkTarget: string
  sort: number
  enabled: boolean
}
