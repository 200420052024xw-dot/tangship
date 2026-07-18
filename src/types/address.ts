/**
 * 地址类型 — 唯一权威定义
 *
 * 字段命名规范:
 * - 地图位置(POI)和详细门牌号分离存储
 * - 经纬度使用 number,缺失或 0 视为无效
 * - usageType 用于区分寄件/收件/通用
 */

export type AddressUsage = 'sender' | 'receiver' | 'both'

export type AddressLabel = '家' | '公司' | '仓库' | '其他'

/**
 * 地址模型 — 兼容老 AddressInfo(id/name/address/lat/lng)字段,
 * 但本阶段前端使用 Address 作为唯一权威类型。
 */
export interface Address {
  /** 唯一 id,本地 uuid 风格 */
  id: string
  /** 联系人 */
  contactName: string
  /** 手机号或固定电话 */
  mobile: string
  /** 省 */
  province?: string
  /** 市 */
  city?: string
  /** 区/县 */
  district?: string
  /** POI 名称(地图选点结果中的 name) */
  poiName?: string
  /** 地图选点返回的完整地址(省市区+道路) */
  formattedAddress?: string
  /** 用户手填的楼栋、楼层、房间号、装卸点 */
  detailAddress: string
  /** 经度,缺失或 0 视为无效 */
  longitude: number
  /** 纬度,缺失或 0 视为无效 */
  latitude: number
  /** 地址标签 */
  label?: AddressLabel
  /** 使用场景 */
  usageType: AddressUsage
  /** 是否默认 */
  isDefault?: boolean
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

/**
 * 地址展示组件需要的三段式结构
 */
export interface AddressDisplay {
  /** 联系人姓名(脱敏手机号后) */
  contactName: string
  /** 脱敏后的手机号(如 "138****8888") */
  maskedMobile: string
  /** 省市区(单行) */
  region: string
  /** POI/小区/园区(单行) */
  poiLine: string
  /** 楼栋/门牌/装卸点(单行) */
  detailLine: string
}