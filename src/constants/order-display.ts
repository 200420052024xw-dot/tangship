export const ORDER_STATUS_DISPLAY: Record<string, { label: string; textClass: string; bgClass: string; color: string }> = {
  pending_review: { label: '待确认', textClass: 'text-amber-600', bgClass: 'bg-amber-50', color: '#D97706' },
  pending_payment: { label: '待支付', textClass: 'text-primary', bgClass: 'bg-blue-50', color: '#2088D8' },
  paid: { label: '已支付', textClass: 'text-emerald-600', bgClass: 'bg-emerald-50', color: '#059669' },
  rejected: { label: '已拒绝', textClass: 'text-red-500', bgClass: 'bg-red-50', color: '#EF4444' },
  cancelled: { label: '已取消', textClass: 'text-slate-400', bgClass: 'bg-slate-100', color: '#94A3B8' },
  quote_expired: { label: '报价过期', textClass: 'text-orange-500', bgClass: 'bg-orange-50', color: '#F97316' },
  dispatching: { label: '调度中', textClass: 'text-violet-600', bgClass: 'bg-violet-50', color: '#7C3AED' },
  delivering: { label: '配送中', textClass: 'text-primary', bgClass: 'bg-blue-50', color: '#2088D8' },
  completed: { label: '已完成', textClass: 'text-emerald-600', bgClass: 'bg-emerald-50', color: '#059669' },
}

export const ORDER_TAB_FILTERS: Record<string, string[]> = {
  all: [],
  pending: ['pending_review', 'pending_payment'],
  active: ['paid', 'dispatching', 'delivering'],
  completed: ['completed'],
  closed: ['rejected', 'cancelled', 'quote_expired'],
}

export const ORDER_TAB_LABELS: Record<string, string> = {
  all: '全部',
  pending: '待处理',
  active: '进行中',
  completed: '已完成',
  closed: '已关闭',
}

export const ORDER_INITIAL_TAB_KEY = 'orders_initial_tab'
