const HALF_HOUR_MS = 30 * 60 * 1000

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function formatOrderTimeRange(startValue: string | Date, endValue?: string | Date) {
  const start = startValue instanceof Date ? startValue : new Date(startValue)
  if (Number.isNaN(start.getTime())) return '—'
  const end = endValue
    ? endValue instanceof Date ? endValue : new Date(endValue)
    : new Date(start.getTime() + HALF_HOUR_MS)
  if (Number.isNaN(end.getTime())) return '—'
  return `${start.getFullYear()}年${pad(start.getMonth() + 1)}月${pad(start.getDate())}日 ${pad(start.getHours())}:${pad(start.getMinutes())}-${pad(end.getHours())}:${pad(end.getMinutes())}`
}

export function formatOrderUseTime(order: {
  pickupType?: string
  pickup_type?: string
  createdAt?: string
  created_at?: string
  scheduledAt?: string
  scheduled_at?: string
  scheduledEndAt?: string
  scheduled_end_at?: string
}) {
  const pickupType = order.pickupType || order.pickup_type
  const scheduledAt = order.scheduledAt || order.scheduled_at
  const immediate = pickupType === 'immediate' || !scheduledAt
  const start = immediate ? order.createdAt || order.created_at : scheduledAt
  if (!start) return '—'
  const end = immediate ? undefined : order.scheduledEndAt || order.scheduled_end_at
  return formatOrderTimeRange(start, end)
}
