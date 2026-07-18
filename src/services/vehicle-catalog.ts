import { Network } from '@/network'
import type { Vehicle } from '@/types/vehicle'

export async function fetchVehicle(id: string): Promise<Vehicle> {
  const response = await Network.request({ url: `/api/content/vehicles/${encodeURIComponent(id)}` })
  const body = response.data as { code?: number; msg?: string; data?: Vehicle }
  if (response.statusCode !== 200 || !body.data) throw new Error(body.msg || '车型加载失败')
  return body.data
}
