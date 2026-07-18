import Taro from '@tarojs/taro'
import { Network } from '@/network'

const TOKEN_KEY = 'consumer_session_token'
interface Envelope<T> { code: number; msg: string; message?: string; data: T }
export interface LoginResult { token: string; expiresAt: string; adminAccess: boolean; user: { id: string; nickname: string; openid: string } }
let loginPromise: Promise<LoginResult> | null = null

export function consumerToken() { return String(Taro.getStorageSync(TOKEN_KEY) || '') }
async function requestLogin(path: string, data?: object) {
  const response = await Network.request({ url: path, method: 'POST', data })
  const body = response.data as Envelope<LoginResult>
  if (response.statusCode !== 200 || !body?.data?.token) throw new Error(body?.msg || body?.message || '登录失败')
  Taro.setStorageSync(TOKEN_KEY, body.data.token)
  return body.data
}
async function login() {
  if (!loginPromise) loginPromise = (async () => {
    if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
      try { const result = await Taro.login(); if (result.code) return await requestLogin('/api/auth/wechat-login', { code: result.code }) } catch { /* development fallback below */ }
    }
    return requestLogin('/api/auth/dev-login')
  })().finally(() => { loginPromise = null })
  return loginPromise
}
export async function ensureConsumerSession() { return consumerToken() || (await login()).token }
export async function bootstrapIdentity() {
  const existing = consumerToken()
  if (existing) {
    try { return await consumerRequest<LoginResult['user'] & { adminAccess: boolean }>({ url: '/api/auth/me' }, false) } catch { Taro.removeStorageSync(TOKEN_KEY) }
  }
  return login()
}
export async function consumerRequest<T>(options: Parameters<typeof Network.request>[0], retry = true): Promise<T> {
  const sessionToken = await ensureConsumerSession()
  const response = await Network.request({ ...options, header: { ...(options.header || {}), Authorization: `Bearer ${sessionToken}` } })
  const body = response.data as Envelope<T>
  if (response.statusCode === 401 && retry) { Taro.removeStorageSync(TOKEN_KEY); await login(); return consumerRequest<T>(options, false) }
  if (response.statusCode < 200 || response.statusCode >= 300 || body?.code !== 200) throw new Error(body?.msg || body?.message || `请求失败（${response.statusCode}）`)
  return body.data
}
export async function logoutConsumer() { try { await consumerRequest({ url: '/api/auth/logout', method: 'POST' }) } finally { Taro.removeStorageSync(TOKEN_KEY) } }
