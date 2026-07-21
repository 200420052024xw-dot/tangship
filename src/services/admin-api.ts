import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { consumerToken } from './consumer-api'

const ADMIN_TOKEN_KEY = 'admin_session_token'
const ADMIN_INFO_KEY = 'admin_session_info'
interface Envelope<T> { code: number; msg: string; message?: string; data: T }
export type AdminInfo = { id: string; username: string; role: 'super_admin' | 'operator' | 'finance' }
export function getAdminInfo() { return Taro.getStorageSync(ADMIN_INFO_KEY) as AdminInfo | undefined }
export async function exchangeAdminSession() {
  const response = await Network.request({ url: '/api/admin/auth/wechat-session', method: 'POST', header: { Authorization: `Bearer ${consumerToken()}` } })
  const body = response.data as Envelope<{ token: string; admin: AdminInfo }>
  if (response.statusCode !== 200 || !body?.data?.token) throw new Error(body?.msg || body?.message || '管理员身份验证失败')
  Taro.setStorageSync(ADMIN_TOKEN_KEY, body.data.token); Taro.setStorageSync(ADMIN_INFO_KEY, body.data.admin)
  return body.data.admin
}
export async function adminRequest<T>(options: Parameters<typeof Network.request>[0]): Promise<T> {
  const token = String(Taro.getStorageSync(ADMIN_TOKEN_KEY) || '')
  if (!token) throw new Error('管理员未登录')
  const response = await Network.request({ ...options, header: { ...(options.header || {}), Authorization: `Bearer ${token}` } })
  const body = response.data as Envelope<T>
  if (response.statusCode === 401 || response.statusCode === 403) { clearAdminSession(); throw new Error(body?.msg || body?.message || '管理员会话已失效') }
  if (response.statusCode < 200 || response.statusCode >= 300 || body?.code !== 200) { const error = new Error(body?.msg || body?.message || `请求失败（${response.statusCode}）`) as Error & { statusCode?: number }; error.statusCode = response.statusCode; throw error }
  return body.data
}
/** 管理员上传文件（携带 Bearer token） */
export async function adminUploadFile(options: { url: string; filePath: string; name?: string; formData?: Record<string, string> }): Promise<{ url: string; objectKey: string }> {
  const token = String(Taro.getStorageSync(ADMIN_TOKEN_KEY) || '')
  if (!token) throw new Error('管理员未登录')
  const response = await Network.uploadFile({
    url: options.url,
    filePath: options.filePath,
    name: options.name || 'file',
    formData: options.formData,
    header: { Authorization: `Bearer ${token}` },
  })
  const body = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
  if (response.statusCode === 401 || response.statusCode === 403) { clearAdminSession(); throw new Error('管理员会话已失效') }
  if (response.statusCode < 200 || response.statusCode >= 300 || body?.code !== 200) throw new Error(body?.msg || body?.message || `上传失败（${response.statusCode}）`)
  return body.data as { url: string; objectKey: string }
}

export function clearAdminSession() { Taro.removeStorageSync(ADMIN_TOKEN_KEY); Taro.removeStorageSync(ADMIN_INFO_KEY) }
export async function logoutAdmin() { try { await adminRequest({ url: '/api/admin/auth/logout', method: 'POST' }) } finally { clearAdminSession() } }
