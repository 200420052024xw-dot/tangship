/**
 * 表单校验工具
 *
 * 规则:
 * - 数值必须为有限正数
 * - 不允许 NaN/Infinity/异常大数(>1e6)
 * - 字符串不允许前后空白
 * - 校验失败返回错误信息,不要抛异常
 */

export const MOBILE_REGEX = /^1[3-9]\d{9}$/
/**
 * 固定电话格式(允许带分机):
 * - 区号(3-4 位) + 主号(7-8 位) + 可选分机(1-5 位)
 * 例:021-12345678、010-12345678-1234、0755-1234567
 */
export const FIXED_PHONE_REGEX = /^(0\d{2,3}-)?\d{7,8}(-\d{1,5})?$/

/** 通用电话校验:手机号或固定电话 */
export function isValidPhone(phone: string): boolean {
  const trimmed = (phone || '').trim()
  if (!trimmed) return false
  return MOBILE_REGEX.test(trimmed) || FIXED_PHONE_REGEX.test(trimmed)
}

/** 手机号严格校验(只允许中国大陆 11 位) */
export function isValidMobile(phone: string): boolean {
  return MOBILE_REGEX.test((phone || '').trim())
}

export interface NumberRange {
  min: number
  max: number
}

/** 校验正数(>= 0),用于可选字段 */
export function isValidNonNegativeNumber(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0
}

/** 校验正整数(>= 1) */
export function isValidPositiveInteger(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(n) && n >= 1
}

/** 校验有限正数(> 0) */
export function isValidPositiveNumber(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 && n < 1e6
}

/** 校验经纬度有效性(非 0/NaN/Infinity,经度 [-180,180],纬度 [-90,90]) */
export function isValidCoordinate(longitude: unknown, latitude: unknown): boolean {
  const lng = typeof longitude === 'number' ? longitude : Number(longitude)
  const lat = typeof latitude === 'number' ? latitude : Number(latitude)
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false
  if (lng === 0 && lat === 0) return false
  if (lng < -180 || lng > 180) return false
  if (lat < -90 || lat > 90) return false
  return true
}

/** 校验字符串非空(去除首尾空白后长度 > 0) */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/** 字符串长度限制(去除首尾空白后) */
export function isWithinLength(value: string, max: number): boolean {
  return value.trim().length <= max
}

/** 时间字符串 HH:mm */
export function isValidHHmm(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value)
}

/** 日期字符串 YYYY-MM-DD */
export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(value)
  return !Number.isNaN(d.getTime())
}

/** 解析数字(失败返回 null) */
export function parseNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}