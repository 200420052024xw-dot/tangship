import { VEHICLES } from '@/constants/vehicles'
import type { BannerItem } from '@/data/banners'
import type { Address } from '@/types/address'
import type { Vehicle, VehicleMode } from '@/types/vehicle'

export const DEMO_BANNERS: BannerItem[] = [
  { id: 'demo-banner-main', image: '', title: 'Z5(2026) 厢式货车 — 按趟即刻出发', linkType: 'vehicle', linkTarget: 'z5-2026', sort: 1, enabled: true },
  { id: 'demo-banner-monthly', image: '', title: 'Z8Max 冷藏配送 — 全程温控保障', linkType: 'vehicle', linkTarget: 'z8-max-c', sort: 2, enabled: true },
  { id: 'demo-banner-multi', image: '', title: 'Z5 多格货柜 — 企业包月专线', linkType: 'monthly', linkTarget: '', sort: 3, enabled: true },
]

export function getDemoVehicles(mode: VehicleMode): Vehicle[] {
  const normalizedMode = mode === 'purchase' ? 'rental' : mode
  return VEHICLES
    .filter(vehicle => vehicle.enabled && vehicle.supportedModes.includes(mode))
    .slice(0, 4)
    .map(vehicle => ({ ...vehicle, serviceMode: normalizedMode as Vehicle['serviceMode'] }))
}

export function getDemoVehicle(id: string): Vehicle | null {
  return VEHICLES.find(vehicle => vehicle.id === id && vehicle.enabled) || null
}

const createdAt = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()

export const DEMO_ORDERS = [
  {
    id: 'demo-order-review', order_no: 'DD202607190001', vehicle_id: 'z5-2026', vehicle_name: 'Z5 无人配送车',
    mode: 'single', status: 'pending_review', pickup_type: 'immediate', created_at: createdAt(1),
    addresses: [
      { role: 'sender', contact_name: '唐小识', phone: '138 0013 8000', formatted_address: '深圳市南山区科技园科苑路', detail_address: '长虹科技大厦 15 楼' },
      { role: 'receiver', contact_name: '李先生', phone: '139 0013 9000', formatted_address: '深圳市福田区深南大道', detail_address: '财富大厦 20 楼' },
    ],
    items: [{ category: 'documents', name: '文件资料', quantity: 1, estimated_weight_kg: 2 }], quote: null,
  },
  {
    id: 'demo-order-payment', order_no: 'DD202607190002', vehicle_id: 'z2', vehicle_name: 'Z2 无人配送车',
    mode: 'single', status: 'pending_payment', pickup_type: 'scheduled', created_at: createdAt(3), scheduled_at: createdAt(-2),
    addresses: [
      { role: 'sender', contact_name: '王先生', phone: '137 0013 7000', formatted_address: '深圳市宝安区宝源路', detail_address: '1001 号' },
      { role: 'receiver', contact_name: '赵先生', phone: '136 0013 6000', formatted_address: '深圳市南山区科技园', detail_address: '科发路 1 号' },
    ],
    items: [{ category: 'digital', name: '电子元器件', quantity: 2, estimated_weight_kg: 5 }],
    quote: {
      base_fee_cents: 3000, distance_fee_cents: 7200, vehicle_fee_cents: 4000, service_fee_cents: 2000,
      discount_cents: 1000, total_fee_cents: 15200, total_cents: 15200, distance_meters: 12600,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    },
  },
  {
    id: 'demo-order-delivering', order_no: 'DD202607180008', vehicle_id: 'z5-2026', vehicle_name: 'Z5 无人配送车',
    mode: 'single', status: 'delivering', pickup_type: 'immediate', created_at: createdAt(20),
    addresses: [
      { role: 'sender', contact_name: '陈女士', phone: '135 0013 5000', formatted_address: '深圳市龙岗区坂田街道', detail_address: '雪岗路 2008 号' },
      { role: 'receiver', contact_name: '刘先生', phone: '134 0013 4000', formatted_address: '深圳市罗湖区宝安南路', detail_address: '1036 号' },
    ],
    items: [{ category: 'commercial', name: '医疗用品', quantity: 3, estimated_weight_kg: 8 }],
    quote: { total_fee_cents: 24600, total_cents: 24600 },
  },
  {
    id: 'demo-order-rejected', order_no: 'DD202607170006', vehicle_id: 'z5-2026', vehicle_name: 'Z5 无人配送车',
    mode: 'single', status: 'rejected', pickup_type: 'immediate', created_at: createdAt(48), rejection_reason: '收件地址暂不在服务范围内',
    addresses: [
      { role: 'sender', contact_name: '唐小识', phone: '138 0013 8000', formatted_address: '深圳市南山区科技园', detail_address: '高新南一道 10 号' },
      { role: 'receiver', contact_name: '客户', phone: '139 0013 9000', formatted_address: '深圳市宝安区福海街道', detail_address: '凤凰社区 88 号' },
    ],
    items: [{ category: 'daily', name: '日用物资', quantity: 4, estimated_weight_kg: 12 }], quote: null,
  },
]

export const DEMO_USER = { nickname: '唐小识', openid: 'demo-openid' }
export const DEMO_ORDER_STATS = { pendingPayment: 1, pendingReview: 1, active: 1, completed: 5, totalSpent: 128600 }
export const DEMO_CONTACT = { phone: '400-800-9000', wechat: 'TangXiaoshiService', email: 'service@jiushi.com', workTime: '工作日 09:00–18:00', extraText: '咨询已提交，客服将尽快与您联系' }

const now = Date.now()
export const DEMO_ADDRESSES: Address[] = [
  { id: 'demo-address-company', contactName: '唐小识', mobile: '13800138000', province: '广东省', city: '深圳市', district: '南山区', poiName: '长虹科技大厦', formattedAddress: '广东省深圳市南山区科苑路', detailAddress: '15 楼', longitude: 113.946, latitude: 22.540, label: '公司', usageType: 'both', isDefault: true, createdAt: now, updatedAt: now },
  { id: 'demo-address-warehouse', contactName: '唐小识仓储中心', mobile: '13800139000', province: '广东省', city: '深圳市', district: '宝安区', poiName: '深国际物流园', formattedAddress: '广东省深圳市宝安区航城街道', detailAddress: 'A 栋 3 号仓', longitude: 113.843, latitude: 22.632, label: '仓库', usageType: 'both', createdAt: now, updatedAt: now },
  { id: 'demo-address-home', contactName: '唐小识科技有限公司', mobile: '13700137000', province: '广东省', city: '深圳市', district: '龙岗区', poiName: '岗头社区', formattedAddress: '广东省深圳市龙岗区坂田街道', detailAddress: '网关大道 50 号', longitude: 114.064, latitude: 22.655, label: '家', usageType: 'receiver', createdAt: now, updatedAt: now },
]

export function findDemoOrder(id: string) {
  return DEMO_ORDERS.find(order => order.id === id) || null
}
