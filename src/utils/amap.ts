/**
 * 地图服务工具类
 * 当前阶段仅做客户端地址选择；路线/报价等服务端化
 */
import Taro from '@tarojs/taro'

/**
 * 地址标签类型
 */
export type AddressTag = '家' | '公司' | '仓库' | '其他'

/**
 * 地址角色：取件/送件/两者皆可
 */
export type AddressRole = 'pickup' | 'delivery' | 'both'

/**
 * 地址信息结构（扩展版，兼容旧数据）
 */
export interface AddressInfo {
  id?: string // 地址唯一标识
  name: string // 地址名称（POI名）
  address: string // 详细地址（省市区+道路）
  latitude: number // 纬度
  longitude: number // 经度
  province?: string // 省份
  city?: string // 城市
  district?: string // 区县
  houseNumber?: string // 门牌号/楼层/房间
  contactName?: string // 联系人
  contactPhone?: string // 联系电话
  tag?: AddressTag // 地址标签
  isDefault?: boolean // 是否默认地址
  role?: AddressRole // 取件/送件/两者
}

/** 手机号校验 */
export function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone)
}

/** 格式化完整地址：address + houseNumber */
export function formatFullAddress(a: AddressInfo): string {
  const base = a.address || a.name || ''
  if (a.houseNumber) {
    return base + ' ' + a.houseNumber
  }
  return base
}

/** 格式化地址标题：联系人 + 电话尾4位 */
export function formatAddressTitle(a: AddressInfo): string {
  const name = a.contactName || a.name || '未知'
  if (a.contactPhone && a.contactPhone.length >= 4) {
    return name + ' ' + a.contactPhone.slice(-4)
  }
  return name
}

/**
 * 地址选择
 * 小程序端：使用 Taro.chooseLocation API 呼起地图选择
 * H5 端：降级为手动输入地址
 */
export async function chooseLocation(): Promise<AddressInfo | null> {
  // H5 端 chooseLocation 不可用，直接走手动输入
  if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP && Taro.getEnv() !== Taro.ENV_TYPE.TT) {
    return null
  }

  try {
    const res = await Taro.chooseLocation({})

    if (res && res.name) {
      return {
        name: res.name,
        address: res.address,
        latitude: res.latitude,
        longitude: res.longitude,
      }
    }
    return null
  } catch (error) {
    console.error('地址选择失败:', error)
    // 用户取消选择
    if (error?.errMsg?.includes('cancel')) {
      return null
    }
    throw new Error('地址选择失败，请稍后重试')
  }
}

/**
 * 格式化距离显示
 * @param distance 距离（米）
 */
export function formatDistance(distance: number): string {
  if (distance < 1000) {
    return `${distance}米`
  }
  return `${(distance / 1000).toFixed(1)}公里`
}