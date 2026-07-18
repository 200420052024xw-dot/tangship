/**
 * 车型类型 — 唯一权威定义
 *
 * 字段命名规范:
 * - 所有数值都使用 number,UI 上展示"以实际车型为准"时也保留 number(NaN)
 * - 经纬度、距离使用 number
 * - 不在类型中放最终成交价,以避免前端价格被当成权威数据
 */

export type VehicleMode = 'single' | 'monthly' | 'rental' | 'purchase'

export interface VehiclePriceHint {
  /**
   * 价格构成/起步说明,仅用于在 UI 中展示"起步价"或"费用构成",
   * 不作为最终成交价。最终价格由服务端根据路线、车型、货物、时间核验后给出。
   */
  description: string
  /**
   * 用于 UI 起步价提示的参考价(元)。
   * ⚠️ 不是最终成交价 — 仅供用户在下单前对费用量级形成预期。
   * 服务端将基于实际路线与运力重新计算。
   */
  startFrom?: number
  /**
   * 价格构成明细(单位:元)。前端展示费用说明时使用,不参与计算。
   */
  breakdown?: Array<{ label: string; amount: number | string }>
}

export interface VehicleSpec {
  /** 货厢容积,UI 展示用字符串(例如 "3.0m³"),不参与重量/尺寸计算 */
  cargoVolume: string
  /** 额定载重 kg,number 字段用于前端判断超载提示 */
  maxLoadKg: number
  /** 货箱长宽高 mm */
  cargoDimensionsMm?: {
    length: number
    width: number
    height: number
  }
  /** 最大续航 km */
  maxRangeKm: number
  /** 运行时速范围,如 "20-30" */
  speedKmh: string
  /** 充电时长,展示用字符串 */
  chargeTime: string
  /** 温控区间(仅冷藏车),如 "-18°C ~ +8°C" */
  temperatureRange?: string
}

export interface Vehicle {
  /** 唯一 id,前端常量,不可由 URL 任意注入 */
  id: string
  /** 简称,用于卡片标题 */
  name: string
  /** 副标题,一句话介绍 */
  subtitle: string
  /** 完整名称 */
  fullName: string
  /** 详细描述,详情页展示 */
  description: string
  /** 车型主图,优先 TOS 远程图,无图时使用 placeholder */
  images: string[]
  /** 核心参数 */
  specs: VehicleSpec
  /** 适用场景标签 */
  applicableScenes: string[]
  /** 使用限制/禁运说明 */
  restrictions: string[]
  /** 该车型支持的服务模式,用于详情页按钮分支 */
  supportedModes: VehicleMode[]
  /** 价格说明(非最终成交价) */
  pricingDescription: VehiclePriceHint
  /** 标签,如 ["冷藏", "可上牌"] */
  tags: string[]
  /** 是否在前端展示 */
  enabled: boolean
  /**
   * 是否需要在服务端报价前先做资质校验(如冷链车需冷链资质)。
   * 仅前端提示用,不替代服务端校验。
   */
  requiresApproval?: boolean
}