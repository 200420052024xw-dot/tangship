/**
 * 地址工具 — 格式化、脱敏、区域识别
 *
 * 注意:
 * - 禁止在 console 中打印完整手机号/详细地址/经纬度
 * - 展示使用脱敏后的字段
 */

import type { Address, AddressDisplay } from '@/types/address'

/** 脱敏手机号,中间 4 位变 * */
export function maskMobile(mobile: string): string {
  if (!mobile) return ''
  const trimmed = mobile.trim()
  if (trimmed.length < 7) return trimmed
  if (MOBILE_REGEX.test(trimmed)) {
    return trimmed.slice(0, 3) + '****' + trimmed.slice(-4)
  }
  // 固定电话脱敏:仅保留前 3 与后 2
  if (trimmed.length >= 5) {
    return trimmed.slice(0, 3) + '****' + trimmed.slice(-2)
  }
  return trimmed
}

const MOBILE_REGEX = /^1[3-9]\d{9}$/

/** 把省/市/区拼成单行 */
export function formatRegion(a: Pick<Address, 'province' | 'city' | 'district'>): string {
  return [a.province, a.city, a.district].filter(Boolean).join(' ')
}

/** 把 Address 拆成 UI 展示所需的三段式 */
export function toAddressDisplay(a: Address): AddressDisplay {
  return {
    contactName: a.contactName?.trim() || '',
    maskedMobile: maskMobile(a.mobile || ''),
    region: formatRegion(a),
    poiLine: a.poiName?.trim() || a.formattedAddress?.trim() || '',
    detailLine: a.detailAddress?.trim() || '',
  }
}

/** 完整地址:省市区 + POI + 门牌 */
export function formatFullAddressText(a: Address): string {
  const parts: string[] = []
  const region = formatRegion(a)
  if (region) parts.push(region)
  if (a.poiName?.trim()) parts.push(a.poiName.trim())
  if (a.detailAddress?.trim()) parts.push(a.detailAddress.trim())
  return parts.join(' · ')
}

/** 判断地址坐标是否有效 */
export function hasValidCoords(a: Address | null | undefined): boolean {
  if (!a) return false
  return Number.isFinite(a.longitude) && Number.isFinite(a.latitude)
    && !(a.longitude === 0 && a.latitude === 0)
    && a.longitude >= -180 && a.longitude <= 180
    && a.latitude >= -90 && a.latitude <= 90
}

/** 安全的 console:不打印敏感字段 */
export function debugAddress(_label: string, _a: Address | null): void {
  // 故意保留空实现以提醒开发者不要在此处添加 console.log(...)
  // 如需调试请使用脱敏后的 toAddressDisplay
}