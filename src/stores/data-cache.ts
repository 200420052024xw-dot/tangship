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
import { useState, useEffect, useCallback, useRef } from 'react'

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
  entries: Record<string, CacheEntry<unknown>>
  get: <T>(key: string) => T | null
  hydrate: (key: string) => void
  set: <T>(key: string, data: T, persist?: boolean) => void
  isStale: (key: string, category: CacheCategory) => boolean
  invalidate: (key: string) => void
  invalidatePrefix: (prefix: string) => void
}

export const useDataCache = create<DataCacheStore>((set, get) => ({
  entries: {},

  get: <T,>(key: string): T | null => {
    const entry = get().entries[key] as CacheEntry<T> | undefined
    if (entry) return entry.data
    return null
  },

  /** 从 localStorage 恢复缓存（仅在外部调用，不在 render 中调用） */
  hydrate: (key: string) => {
    const entry = get().entries[key]
    if (entry) return // 已有内存缓存
    try {
      const raw = Taro.getStorageSync(`dc_${key}`)
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEntry<unknown>
        // 空数组不恢复，强制重新请求
        if (Array.isArray(parsed.data) && parsed.data.length === 0) {
          Taro.removeStorageSync(`dc_${key}`)
          return
        }
        set(s => ({ entries: { ...s.entries, [key]: parsed } }))
      }
    } catch { /* ignore */ }
  },

  set: <T,>(key: string, data: T, persist?: boolean) => {
    const entry: CacheEntry<T> = { data, updatedAt: Date.now() }
    set(s => ({ entries: { ...s.entries, [key]: entry } }))
    if (persist) {
      try { Taro.setStorageSync(`dc_${key}`, JSON.stringify(entry)) } catch { /* ignore */ }
    }
  },

  isStale: (key: string, category: CacheCategory) => {
    const entry = get().entries[key]
    if (!entry) return true
    return Date.now() - entry.updatedAt > CACHE_CONFIGS[category].staleTime
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
 * SWR hook — React 安全，无 render 副作用
 *
 * @param key    缓存 key（null = 禁用）
 * @param fetcher 数据获取函数
 * @param category 缓存分类
 * @returns { data, loading, error, refresh }
 */
export function useSWR<T>(
  key: string | null,
  fetcher: (() => Promise<T>) | null,
  category: CacheCategory = 'dynamic',
) {
  // 所有 useState 初始化器都是纯值，无副作用
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const doFetch = useCallback(async (fetchKey: string) => {
    const fn = fetcherRef.current
    if (!fn) return
    // SWR 后台刷新不应遮住已有数据；只有真正无缓存时才展示骨架屏。
    const hasCachedData = useDataCache.getState().get(fetchKey) !== null
    if (mountedRef.current) setLoading(!hasCachedData)
    if (mountedRef.current) setError(null)
    try {
      const result = await fn()
      // static 类别（车型/轮播图）空数组不缓存，避免空结果长期占位导致页面空白
      const isEmptyArray = Array.isArray(result) && result.length === 0
      const shouldPersist = category === 'static' && !isEmptyArray
      useDataCache.getState().set(fetchKey, result, shouldPersist)
      if (mountedRef.current) {
        setData(result)
        setError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)))
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [category])

  useEffect(() => {
    if (!key || !fetcherRef.current) {
      setLoading(false)
      return
    }

    // 从 localStorage 恢复（static 类型）
    if (category === 'static') {
      useDataCache.getState().hydrate(key)
    }

    // 从内存缓存读
    const cached = useDataCache.getState().get<T>(key)
    if (cached !== null) {
      setData(cached)
      setLoading(false)
    }

    // 缓存过期 or 无缓存 → 请求
    const stale = useDataCache.getState().isStale(key, category)
    if (cached === null || stale) {
      setLoading(true)
      doFetch(key)
    }
  }, [key, category, doFetch])

  const refresh = useCallback(() => {
    if (key) doFetch(key)
  }, [key, doFetch])

  return { data, loading, error, refresh }
}

/** 手动使缓存失效 */
export const invalidateCache = (key: string) => useDataCache.getState().invalidate(key)
export const invalidateCachePrefix = (prefix: string) => useDataCache.getState().invalidatePrefix(prefix)
