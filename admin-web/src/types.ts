export type Role = 'super_admin' | 'operator'

export interface Admin {
  id: string
  username: string
  nickname?: string
  role: Role
  expiresAt?: string
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface OrderRow {
  id: string
  orderNo: string
  createdAt?: string
  created_at?: string
  vehicleId: string
  scheduledAt?: string
  status: string
  contactName: string
  phone: string
  senderDistrict: string
  receiverDistrict: string
  reviewer?: string
  reserved_vehicle_count?: number
}

export interface VehicleCapacity {
  id: string
  name: string
  totalCount: number
  reservedCount: number
  availableCount: number
}

export interface DashboardData {
  pendingReview: number
  pendingPayment: number
  paid: number
  dispatching: number
  delivering: number
  todayNew: number
  rejected: number
  pendingMonthly: number
  pendingRental: number
  unreadNotifications: number
  recentPending: OrderRow[]
  vehicleCapacity: VehicleCapacity[]
}

export interface OrderAddress {
  id: string
  role: 'sender' | 'receiver'
  contact_name: string
  phone: string
  province: string
  city: string
  district: string
  poi_name: string
  formatted_address: string
  detail_address: string
  longitude?: number | string | null
  latitude?: number | string | null
}

export interface OrderItem {
  id: string
  category: string
  name: string
  quantity: number
  estimated_weight_kg: number
  length_mm?: number
  width_mm?: number
  height_mm?: number
  fragile?: boolean | number
  oversized?: boolean | number
  need_carry?: boolean | number
  remark?: string
}

export interface OrderQuote {
  id: string
  total_cents: number
  base_fee_cents: number
  distance_fee_cents: number
  vehicle_fee_cents: number
  service_fee_cents: number
  discount_cents: number
  expires_at?: string
  created_by_name?: string
}

export interface TimelineRecord {
  id: string
  remark?: string
  action?: string
  to_status?: string
  operator_name?: string
  admin_username?: string
  operator_type?: string
  created_at: string
}

export interface OrderDetailData {
  id: string
  order_no: string
  status: string
  created_at: string
  vehicle_id: string
  scheduled_at?: string
  customer_remark?: string
  reviewer?: string
  reserved_vehicle_count?: number
  dispatch_note?: string
  dispatch_vehicle_count?: number
  vehicle_plate?: string
  completion_note?: string
  completion_proof_url?: string
  rejection_reason?: string
  addresses: OrderAddress[]
  items: OrderItem[]
  quotes: OrderQuote[]
  statusLogs: TimelineRecord[]
  auditLogs: TimelineRecord[]
}

export interface ReviewRecord {
  id: string
  action: string
  orderId: string
  orderNo: string
  reviewer: string
  created_at: string
  totalCents?: number
  rejectionReason?: string
}

export interface AdminNotification {
  id: string
  type: string
  title: string
  content: string
  targetPath?: string
  readAt?: string
  createdAt: string
}

export interface NotificationPage extends Page<AdminNotification> {
  unreadCount: number
}

// Existing operations editors consume schemaless JSON columns. Keep the unsafe
// boundary isolated here until those editors are migrated to dedicated DTOs.
export type AnyRecord = Record<string, any>
