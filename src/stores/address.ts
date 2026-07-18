import { create } from 'zustand'
import Taro from '@tarojs/taro'
import type { Address, AddressLabel, AddressUsage } from '@/types/address'
import { consumerRequest } from '@/services/consumer-api'

const LEGACY_KEY = 'address_list_v2'
const MIGRATED_KEY = 'address_sqlite_migrated_v1'

interface AddressStore {
  addressList: Address[]
  loading: boolean
  loadAddresses: () => Promise<void>
  saveAddress: (address: Address) => Promise<Address>
  removeAddress: (id: string) => Promise<void>
  getById: (id: string) => Address | undefined
}

const fromApi = (row: any): Address => ({ id: row.id, contactName: row.contact_name ?? row.contactName, mobile: row.phone ?? row.mobile, province: row.province, city: row.city, district: row.district, poiName: row.poi_name ?? row.poiName, formattedAddress: row.formatted_address ?? row.formattedAddress, detailAddress: row.detail_address ?? row.detailAddress, longitude: Number(row.longitude), latitude: Number(row.latitude), usageType: row.usage_type ?? row.usageType, isDefault: Boolean(row.is_default_sender ?? row.isDefaultSender ?? row.is_default_receiver ?? row.isDefaultReceiver), label: '其他', createdAt: Date.parse(row.created_at ?? row.createdAt) || Date.now(), updatedAt: Date.parse(row.updated_at ?? row.updatedAt) || Date.now() })
const toApi = (address: Address, migrationKey?: string) => ({ contactName: address.contactName, phone: address.mobile, province: address.province ?? '', city: address.city ?? '', district: address.district ?? '', poiName: address.poiName ?? '', formattedAddress: address.formattedAddress || address.poiName || '', detailAddress: address.detailAddress, longitude: address.longitude, latitude: address.latitude, usageType: address.usageType, isDefaultSender: address.isDefault && address.usageType !== 'receiver', isDefaultReceiver: address.isDefault && address.usageType !== 'sender', ...(migrationKey ? { migrationKey } : {}) })

async function migrateLegacy() {
  if (Taro.getStorageSync(MIGRATED_KEY)) return
  const raw = Taro.getStorageSync(LEGACY_KEY)
  if (!raw) { Taro.setStorageSync(MIGRATED_KEY, '1'); return }
  const rows = JSON.parse(String(raw)) as Address[]
  if (!Array.isArray(rows)) throw new Error('旧地址数据格式无效')
  for (const row of rows) await consumerRequest({ url: '/api/addresses', method: 'POST', data: toApi(row, `legacy:${row.id}`) })
  Taro.setStorageSync(MIGRATED_KEY, '1')
  Taro.removeStorageSync(LEGACY_KEY)
}

export const useAddressStore = create<AddressStore>((set, get) => ({
  addressList: [], loading: false,
  loadAddresses: async () => { set({ loading: true }); try { try { await migrateLegacy() } catch { /* 保留旧数据，下一次加载安全重试 */ } const rows = await consumerRequest<any[]>({ url: '/api/addresses' }); set({ addressList: rows.map(fromApi) }) } finally { set({ loading: false }) } },
  saveAddress: async address => { const saved = fromApi(await consumerRequest<any>({ url: address.id.startsWith('addr_') ? '/api/addresses' : `/api/addresses/${address.id}`, method: address.id.startsWith('addr_') ? 'POST' : 'PUT', data: toApi(address) })); await get().loadAddresses(); return saved },
  removeAddress: async id => { await consumerRequest({ url: `/api/addresses/${id}`, method: 'DELETE' }); await get().loadAddresses() },
  getById: id => get().addressList.find(row => row.id === id),
}))

export function createEmptyAddress(usageType: AddressUsage = 'both'): Address {
  const now = Date.now()
  return { id: `addr_${now}`, contactName: '', mobile: '', province: '', city: '', district: '', poiName: '', formattedAddress: '', detailAddress: '', longitude: 0, latitude: 0, label: '其他' as AddressLabel, usageType, isDefault: false, createdAt: now, updatedAt: now }
}
