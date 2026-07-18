/**
 * 消费者 API 层 - 优化版
 *
 * 优化点:
 * 1. Token 缓存: localStorage 存储 + 内存快取，避免每次读 storage
 * 2. 登录去重: 单例 Promise，多组件并发请求只触发一次
 * 3. Token 预检: 已有 token 时直接使用，401 才重新登录
 * 4. 响应解包: 统一解包 envelope { code, msg, data }
 */

import Taro from '@tarojs/taro'
import { Network } from '@/network'

const TOKEN_KEY = 'consumer_session_token'
const TOKEN_EXPIRY_KEY = 'consumer_token_expiry'

interface Envelope<T> { code: number; msg: string; message?: string; data: T }
export interface LoginResult {
  token: string
  expiresAt: string
  adminAccess: boolean
  user: { id: string; nickname: string; openid: string }
}

// ── Token 管理 ──
let _memoryToken: string | null = null
let _tokenExpiry: number = 0

/** 获取缓存的 token（内存优先 → localStorage） */
export function consumerToken(): string {
  if (_memoryToken && Date.now() < _tokenExpiry) return _memoryToken
  const stored = String(Taro.getStorageSync(TOKEN_KEY) || '')
  const expiry = Number(Taro.getStorageSync(TOKEN_EXPIRY_KEY) || 0)
  if (stored && Date.now() < expiry) {
    _memoryToken = stored
    _tokenExpiry = expiry
    return stored
  }
  return ''
}

/** 保存 token（内存 + localStorage） */
function saveToken(token: string, expiresAt?: string) {
  _memoryToken = token
  // 默认 24 小时有效
  const expiry = expiresAt ? new Date(expiresAt).getTime() : Date.now() + 24 * 60 * 60 * 1000
  _tokenExpiry = expiry
  Taro.setStorageSync(TOKEN_KEY, token)
  Taro.setStorageSync(TOKEN_EXPIRY_KEY, String(expiry))
}

/** 清除 token */
function clearToken() {
  _memoryToken = null
  _tokenExpiry = 0
  Taro.removeStorageSync(TOKEN_KEY)
  Taro.removeStorageSync(TOKEN_EXPIRY_KEY)
}

// ── 登录流程（去重） ──
let _loginPromise: Promise<LoginResult> | null = null

async function requestLogin(path: string, data?: object): Promise<LoginResult> {
  const response = await Network.request({ url: path, method: 'POST', data })
  const body = response.data as Envelope<LoginResult>
  if (response.statusCode !== 200 || !body?.data?.token) {
    throw new Error(body?.msg || body?.message || '登录失败')
  }
  saveToken(body.data.token, body.data.expiresAt)
  return body.data
}

async function login(): Promise<LoginResult> {
  if (!_loginPromise) {
    _loginPromise = (async () => {
      // 微信小程序优先走 wx.login
      if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
        try {
          const result = await Taro.login()
          if (result.code) return await requestLogin('/api/auth/wechat-login', { code: result.code })
        } catch { /* fallback to dev-login */ }
      }
      return requestLogin('/api/auth/dev-login')
    })().finally(() => { _loginPromise = null })
  }
  return _loginPromise
}

/** 确保 session 可用（有 token 就不登录） */
export async function ensureConsumerSession(): Promise<string> {
  const existing = consumerToken()
  if (existing) return existing
  const result = await login()
  return result.token
}

/** 启动时身份检查（验证已有 token 是否有效） */
export async function bootstrapIdentity() {
  const existing = consumerToken()
  if (existing) {
    try {
      return await consumerRequest<LoginResult['user'] & { adminAccess: boolean }>({ url: '/api/auth/me' }, false)
    } catch {
      clearToken()
    }
  }
  return login()
}

// ── 核心请求函数 ──
export async function consumerRequest<T>(
  options: Parameters<typeof Network.request>[0],
  retry = true,
): Promise<T> {
  const sessionToken = await ensureConsumerSession()
  console.log(`[API] ${options.method || 'GET'} ${options.url}`)
  const response = await Network.request({
    ...options,
    header: { ...(options.header || {}), Authorization: `Bearer ${sessionToken}` },
  })
  const body = response.data as Envelope<T>

  // 401 → 清 token 重试一次
  if (response.statusCode === 401 && retry) {
    clearToken()
    await login()
    return consumerRequest<T>(options, false)
  }

  if (response.statusCode < 200 || response.statusCode >= 300 || body?.code !== 200) {
    throw new Error(body?.msg || body?.message || `请求失败（${response.statusCode}）`)
  }
  return body.data
}

/** 登出 */
export async function logoutConsumer() {
  try { await consumerRequest({ url: '/api/auth/logout', method: 'POST' }) } finally { clearToken() }
}
