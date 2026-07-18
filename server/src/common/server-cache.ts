/**
 * 服务端内存缓存
 *
 * 用于缓存 Supabase 查询结果，减少远程数据库调用。
 * - 静态内容（车型目录/轮播图）：TTL 5 分钟
 * - 用户数据（订单/地址）：TTL 30 秒
 * - 手动失效：写操作后清除对应 key
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class ServerCache {
  private store = new Map<string, CacheEntry<unknown>>()

  /**
   * 获取缓存，若命中且未过期返回数据，否则返回 null
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.data
  }

  /**
   * 写入缓存
   * @param key 缓存键
   * @param data 数据
   * @param ttlMs 有效期（毫秒）
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs })
  }

  /**
   * 使指定 key 失效
   */
  invalidate(key: string): void {
    this.store.delete(key)
  }

  /**
   * 使匹配前缀的所有 key 失效
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key)
    }
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.store.clear()
  }
}

/** 全局单例 */
export const serverCache = new ServerCache()

/** 缓存 TTL 常量 */
export const CACHE_TTL = {
  STATIC: 5 * 60 * 1000,    // 5 分钟 - 车型目录、轮播图
  SESSION: 2 * 60 * 1000,   // 2 分钟 - 用户信息
  DYNAMIC: 30 * 1000,       // 30 秒  - 订单列表、地址簿
} as const

/** 缓存 key 前缀 */
export const CACHE_KEYS = {
  VEHICLE_CATALOG: 'content:vehicles',
  BANNERS: 'content:banners',
  PRICING_RULES: 'content:pricing',
  USER_PREFIX: 'user:',
  ORDERS_PREFIX: 'orders:',
  ADDRESSES_PREFIX: 'addresses:',
  ADMIN_DASHBOARD: 'admin:dashboard',
} as const
