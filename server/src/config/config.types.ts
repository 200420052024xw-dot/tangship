/**
 * 计价配置结构
 */
export interface PricingConfig {
  baseDistance: number; // 起步里程（米）
  basePrice: number; // 起步基础单价（元）
  pricePerKm: number; // 每公里加价（元/公里）
  vehiclePriceMultiplier: Record<string, number>; // 车型加价系数
  coldChainFee: number; // 冷链附加费（元）
  overweightFee: number; // 超重费（元/公斤）
  overweightThreshold: number; // 超重基准重量（公斤）
  nightFee: number; // 夜间配送费（元）
  nightStartHour: number; // 夜间开始时段
  nightEndHour: number; // 夜间结束时段
  remoteAreaFee: number; // 偏远区县溢价（元）
  remoteAreas: string[]; // 偏远区县列表
}

/**
 * 客服联系方式配置
 */
export interface CustomerServiceConfig {
  phone: string; // 客服电话
  wechat: string; // 企业微信号
  workTime: string; // 工作时间描述
}