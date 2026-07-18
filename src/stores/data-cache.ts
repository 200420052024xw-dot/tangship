/**
 * 数据缓存层 - Stale-While-Revalidate 策略
 *
 * 核心思想:
 * 1. 有缓存 → 立即返回缓存数据（页面秒开）
 * 2. 缓存过期 → 后台刷新，不阻塞渲染
 * 3. 无缓存 → 显示 loading，等待网络请求
 *
 * 分类:
 * - static: 车型目录/轮播图，5 分钟有效，几乎不变
 * - session: 用户信息，2 分钟有效
 * - dynamic: 订单/地址，1 分钟有效，每次进页面后台刷新
 */

import { create } from 'zustand'
import Taro from '@tarojs/taro'

/** 缓存条目 */
interface CacheEntry<T> {
  data: T
  updatedAt: number // ms timestamp
}

/** 缓存配置 */
const CACHE_CONFIGS = {
  static:  { staleTime: 5 * 60 * 1000 },   // 5 min
  session: { staleTime: 2 * 60 * 1000 },   // 2 min
  dynamic: { staleTime: 1 * 60 * 1000 },   // 1 min
} as const

export type CacheCategory = keyof typeof CACHE_CONFIGS

interface DataCacheStore {
  /** 内存缓存 */
  entries: Record<string, CacheEntry<unknown>>
  /** 正在进行的请求（去重） */
  pending: Record<string, Promise<unknown>>

  /** 获取缓存数据 */
  get: <T>(key: string) => T | null
  /** 设置缓存数据 */
  set: <T>(key: string, data: T, persistKey?: string) => void
  /** 判断缓存是否过期 */
  isStale: (key: string, category: CacheCategory) => boolean
  /** 获取或去重 Promise */
  getPending: <T>(key: string) => Promise<T> | null
  /** 设置正在进行的请求 */
  setPending: <T>(key: string, promise: Promise<T>) => void
  /** 清除正在进行的请求 */
  clearPending: (key: string) => void
  /** 使指定 key 失效 */
  invalidate: (key: string) => void
  /** 使匹配前缀的所有 key 失效 */
  invalidatePrefix: (prefix: string) => void
}

export const useDataCache = create<DataCacheStore>((set, get) => ({
  entries: {},
  pending: {},

  get: <T,>(key: string): T | null => {
    const entry = get().entries[key] as CacheEntry<T> | undefined
    if (entry) return entry.data
    // 尝试从 localStorage 恢复
    try {
      const raw = Taro.getStorageSync(`dc_${key}`)
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEntry<T>
        set(s => ({ entries: { ...s.entries, [key]: parsed } }))
        return parsed.data
      }
    } catch { /* ignore */ }
    return null
  },

  set: <T,>(key: string, data: T, persistKey?: string) => {
    const entry: CacheEntry<T> = { data, updatedAt: Date.now() }
    set(s => ({ entries: { ...s.entries, [key]: entry } }))
    if (persistKey) {
      try { Taro.setStorageSync(`dc_${key}`, JSON.stringify(entry)) } catch { /* ignore */ }
    }
  },

  isStale: (key: string, category: CacheCategory) => {
    const entry = get().entries[key]
    if (!entry) return true
    return Date.now() - entry.updatedAt > CACHE_CONFIGS[category].staleTime
  },

  getPending: <T,>(key: string): Promise<T> | null => {
    return (get().pending[key] as Promise<T> | undefined) || null
  },

  setPending: <T,>(key: string, promise: Promise<T>) => {
    set(s => ({ pending: { ...s.pending, [key]: promise } }))
  },

  clearPending: (key: string) => {
    set(s => {
      const { [key]: _, ...rest } = s.pending
      return { pending: rest }
    })
  },

  invalidate: (key: string) => {
    set(s => {
      const { [key]: _, ...rest } = s.entries
      return { entries: rest }
    })
    try { Taro.removeStorageSync(`dc_${key}`) } catch { /* ignore */ }
  },

  invalidatePrefix: (prefix: string) => {
    const entries = get().entries
    const toRemove = Object.keys(entries).filter(k => k.startsWith(prefix))
    if (toRemove.length === 0) return
    set(s => {
      const newEntries = { ...s.entries }
      toRemove.forEach(k => { delete newEntries[k]; try { Taro.removeStorageSync(`dc_${k}`) } catch { /* ignore */ } })
      return { entries: newEntries }
    })
  },
}))

/**
 * SWR 核心 hook — 页面侧使用
 *
 * @param key 缓存 key
 * @param fetcher 数据获取函数
 * @param category 缓存分类
 * @returns { data, loading, refresh }
 *
 * 用法:
 * const { data: vehicles, loading } = useSWR('vehicles', () => consumerRequest<Vehicle[]>({ url: '/api/content/vehicles' }), 'static')
 */
export function useSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  category: CacheCategory = 'dynamic',
) {
  const { get, set, isStale, getPending, setPending, clearPending } = useDataCache()

  const cached = get<T>(key)
  const stale = isStale(key, category)

  // 需要刷新的情况: 无缓存 or 缓存过期
  const needRefresh = !cached || stale

  if (needRefresh) {
    // 去重: 避免多个组件同时触发同一请求
    const existing = getPending<T>(key)
    if (!existing) {
      const promise = fetcher()
        .then(data => {
          set(key, data, category === 'static' ? key : undefined)
          clearPending(key)
          return data
        })
        .catch(err => {
          clearPending(key)
          throw err
        })
      setPending(key, promise)
    }
  }

  return {
    /** 缓存数据（有则立即可用） */
    data: cached,
    /** 是否正在首次加载（无缓存且正在请求） */
    loading: !cached && !!getPending(key),
    /** 手动触发刷新 */
    refresh: () => {
      const existing = getPending<T>(key)
      if (existing) return existing
      const promise = fetcher()
        .then(data => { set(key, data, category === 'static' ? key : undefined); clearPending(key); return data })
        .catch(err => { clearPending(key); throw err })
      setPending(key, promise)
      return promise
    },
  }
}

/** 手动使缓存失效（用于写操作后刷新） */
export const invalidateCache = (key: string) => useDataCache.getState().invalidate(key)
export const invalidateCachePrefix = (prefix: string) => useDataCache.getState().invalidatePrefix(prefix)
