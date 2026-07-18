/**
 * 订单草稿 Store
 *
 * 设计要点:
 * - 仅缓存非敏感草稿字段(无最终价格)
 * - 不写入 React/组件对象
 * - 提供 resetOrderDraft 留给后续真实订单创建成功后调用
 * - 处理老版本本地缓存不兼容问题
 */

import { create } from 'zustand'
import Taro from '@tarojs/taro'
import type { OrderDraft } from '@/types/order'
import type { VehicleMode } from '@/types/vehicle'

const STORAGE_KEY = 'order_draft_v1'
const DRAFT_VERSION = 1

interface StoredDraft {
  version: number
  draft: OrderDraft
}

interface OrderDraftStore {
  draft: OrderDraft
  /** 整体替换草稿(用于初始化) */
  setDraft: (draft: OrderDraft) => void
  /** 设置服务模式 */
  setMode: (mode: VehicleMode) => void
  /** 设置车型 id */
  setVehicleId: (vehicleId: string) => void
  /** 设置寄件地址 */
  setSenderAddress: (address: OrderDraft['senderAddress']) => void
  /** 设置收件地址 */
  setReceiverAddress: (address: OrderDraft['receiverAddress']) => void
  /** 交换寄件/收件 */
  swapAddresses: () => void
  /** 设置物品信息 */
  setGoods: (goods: OrderDraft['goods']) => void
  /** 设置用车时间类型 */
  setPickupType: (type: OrderDraft['pickupType']) => void
  /** 设置预约时段 */
  setScheduledSlot: (slot: OrderDraft['scheduledSlot']) => void
  /** 设置协议接受 */
  setAgreementAccepted: (accepted: boolean) => void
  /** 创建全新草稿(进入下单页时) */
  initDraft: (mode: VehicleMode, vehicleId: string) => OrderDraft
  /** 重置草稿(订单创建成功后调用) */
  resetOrderDraft: () => void
}

function makeEmptyDraft(mode: VehicleMode = 'single', vehicleId = ''): OrderDraft {
  return {
    draftId: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    mode,
    vehicleId,
    senderAddress: null,
    receiverAddress: null,
    goods: null,
    pickupType: 'immediate',
    scheduledSlot: null,
    agreementAccepted: false,
    updatedAt: Date.now(),
  }
}

function isValidDraft(v: unknown): v is OrderDraft {
  if (!v || typeof v !== 'object') return false
  const d = v as Record<string, unknown>
  if (typeof d.draftId !== 'string') return false
  if (typeof d.vehicleId !== 'string') return false
  if (!['single', 'monthly', 'rental', 'purchase'].includes(d.mode as string)) return false
  if (!['immediate', 'scheduled'].includes(d.pickupType as string)) return false
  if (typeof d.agreementAccepted !== 'boolean') return false
  if (typeof d.updatedAt !== 'number') return false
  return true
}

function loadFromStorage(): OrderDraft {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw as string) as StoredDraft
      if (parsed && parsed.version === DRAFT_VERSION && isValidDraft(parsed.draft)) {
        return parsed.draft
      }
    }
  } catch {
    // 解析失败
  }
  return makeEmptyDraft()
}

function saveToStorage(draft: OrderDraft) {
  try {
    const payload: StoredDraft = { version: DRAFT_VERSION, draft }
    Taro.setStorageSync(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

export const useOrderDraftStore = create<OrderDraftStore>((set, get) => ({
  draft: loadFromStorage(),

  setDraft: (draft) => {
    set({ draft })
    saveToStorage(draft)
  },

  setMode: (mode) => {
    const draft: OrderDraft = { ...get().draft, mode, updatedAt: Date.now() }
    set({ draft })
    saveToStorage(draft)
  },

  setVehicleId: (vehicleId) => {
    const draft: OrderDraft = { ...get().draft, vehicleId, updatedAt: Date.now() }
    set({ draft })
    saveToStorage(draft)
  },

  setSenderAddress: (address) => {
    const draft: OrderDraft = { ...get().draft, senderAddress: address, updatedAt: Date.now() }
    set({ draft })
    saveToStorage(draft)
  },

  setReceiverAddress: (address) => {
    const draft: OrderDraft = { ...get().draft, receiverAddress: address, updatedAt: Date.now() }
    set({ draft })
    saveToStorage(draft)
  },

  swapAddresses: () => {
    const { senderAddress, receiverAddress } = get().draft
    const draft: OrderDraft = {
      ...get().draft,
      senderAddress: receiverAddress,
      receiverAddress: senderAddress,
      updatedAt: Date.now(),
    }
    set({ draft })
    saveToStorage(draft)
  },

  setGoods: (goods) => {
    const draft: OrderDraft = { ...get().draft, goods, updatedAt: Date.now() }
    set({ draft })
    saveToStorage(draft)
  },

  setPickupType: (type) => {
    const draft: OrderDraft = { ...get().draft, pickupType: type, updatedAt: Date.now() }
    set({ draft })
    saveToStorage(draft)
  },

  setScheduledSlot: (slot) => {
    const draft: OrderDraft = { ...get().draft, scheduledSlot: slot, updatedAt: Date.now() }
    set({ draft })
    saveToStorage(draft)
  },

  setAgreementAccepted: (accepted) => {
    const draft: OrderDraft = { ...get().draft, agreementAccepted: accepted, updatedAt: Date.now() }
    set({ draft })
    saveToStorage(draft)
  },

  initDraft: (mode, vehicleId) => {
    const draft = makeEmptyDraft(mode, vehicleId)
    set({ draft })
    saveToStorage(draft)
    return draft
  },

  resetOrderDraft: () => {
    const empty = makeEmptyDraft()
    set({ draft: empty })
    saveToStorage(empty)
  },
}))