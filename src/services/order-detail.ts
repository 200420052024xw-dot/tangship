import { consumerRequest } from '@/services/consumer-api'

export type OrderDetail = Record<string, any>

const orderCache = new Map<string, OrderDetail>()
const pendingRequests = new Map<string, Promise<OrderDetail>>()

export function primeOrderDetail(order: OrderDetail): void {
  if (order?.id) orderCache.set(order.id, order)
}

export function getOrderSnapshot(id: string): OrderDetail | null {
  return orderCache.get(id) || null
}

export function removeOrderSnapshots(ids: string[]): void {
  ids.forEach(id => orderCache.delete(id))
}

export async function refreshOrderDetail(id: string): Promise<OrderDetail> {
  const existingRequest = pendingRequests.get(id)
  if (existingRequest) return existingRequest

  const request = consumerRequest<OrderDetail>({ url: `/api/orders/${encodeURIComponent(id)}` })
    .then(order => {
      primeOrderDetail(order)
      return order
    })
  pendingRequests.set(id, request)
  request.finally(() => pendingRequests.delete(id)).catch(() => undefined)
  return request
}
