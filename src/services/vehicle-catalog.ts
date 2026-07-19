import { Network } from '@/network'
import type { Vehicle } from '@/types/vehicle'

const vehicleCache = new Map<string, Vehicle>()
const pendingRequests = new Map<string, Promise<Vehicle>>()

export function primeVehicleCache(vehicle: Vehicle): void {
  vehicleCache.set(vehicle.id, vehicle)
}

export function getVehicleSnapshot(id: string): Vehicle | null {
  return vehicleCache.get(id) || null
}

async function requestVehicle(id: string): Promise<Vehicle> {
  const existingRequest = pendingRequests.get(id)
  if (existingRequest) return existingRequest

  const request = (async () => {
    const response = await Network.request({ url: `/api/content/vehicles/${encodeURIComponent(id)}` })
    console.log('[vehicle-catalog] response:', response.data)
    const body = response.data as { code?: number; msg?: string; data?: Vehicle }
    if (response.statusCode === 200 && body.data) {
      primeVehicleCache(body.data)
      return body.data
    }
    throw new Error('车型加载失败')
  })()

  pendingRequests.set(id, request)
  request.finally(() => pendingRequests.delete(id)).catch(() => undefined)
  return request
}

export async function fetchVehicle(id: string): Promise<Vehicle> {
  const cachedVehicle = getVehicleSnapshot(id)
  return cachedVehicle || requestVehicle(id)
}

export async function refreshVehicle(id: string): Promise<Vehicle> {
  return requestVehicle(id)
}
