import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, api, dateTime, money } from './api'
import { FeedbackProvider, useFeedback } from './feedback'
import type { Admin, AdminNotification, AppointmentRow, DashboardData, NotificationPage, OrderAddress, OrderDetailData, OrderRow, Page, ReviewRecord, Role } from './types'
import OperationsSettings from './OperationsSettings'
import WechatAdmins from './WechatAdmins'

const STATUS_LABELS: Record<string, string> = {
  pending_review: '待审核', rejected: '已拒绝', pending_payment: '待支付', quote_expired: '报价过期',
  paid: '待安排车辆', dispatching: '调度中', delivering: '配送中', completed: '已完成',
  cancelled: '已取消', refund_pending: '退款处理中', refunded: '已退款',
}
const ROLE_LABELS: Record<Role, string> = { super_admin: '超级管理员', operator: '运营' }
const messageOf = (error: unknown) => error instanceof Error ? error.message : '操作失败，请稍后重试'
const currentRoute = () => (location.hash.slice(1) || '/dashboard').split('?')[0]
const go = (path: string) => { location.hash = path }
const REJECTION_REASONS = ['超出服务范围', '暂无可用车辆', '预约时间无法满足', '货物不符合运输要求', '地址信息不完整', '需求需线下确认']

type NavItem = { path: string; label: string; roles?: Role[] }
type NavGroup = { label: string; items: NavItem[] }
const NAV_GROUPS: NavGroup[] = [
  { label: '概览', items: [{ path: '/dashboard', label: '工作台' }, { path: '/notifications', label: '通知中心' }] },
  { label: '订单履约', items: [{ path: '/orders', label: '按趟订单' }, { path: '/reviews', label: '审核记录' }] },
  { label: '客户跟进', items: [{ path: '/inquiries/monthly', label: '包月咨询', roles: ['super_admin', 'operator'] }, { path: '/inquiries/rental', label: '租购咨询', roles: ['super_admin', 'operator'] }] },
  { label: '小程序运营', items: [
    { path: '/operations/vehicles', label: '车型与数量', roles: ['super_admin'] },
    { path: '/operations/banners', label: '首页轮播', roles: ['super_admin'] },
    { path: '/operations/pricing', label: '价格规则', roles: ['super_admin'] },
    { path: '/operations/content', label: '联系方式', roles: ['super_admin'] },
  ] },
  { label: '系统管理', items: [{ path: '/system/admins', label: '管理员授权', roles: ['super_admin'] }] },
]

export default function App() { return <FeedbackProvider><AdminApp /></FeedbackProvider> }

function AdminApp() {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [checking, setChecking] = useState(true)
  const [path, setPath] = useState(currentRoute())
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const onHashChange = () => setPath(currentRoute())
    const onExpired = () => { setAdmin(null); go('/login') }
    addEventListener('hashchange', onHashChange)
    addEventListener('admin-session-expired', onExpired)
    api<Admin>('/auth/me').then(setAdmin).catch(() => setAdmin(null)).finally(() => setChecking(false))
    return () => { removeEventListener('hashchange', onHashChange); removeEventListener('admin-session-expired', onExpired) }
  }, [])

  useEffect(() => {
    if (!admin) return
    const load = () => void api<NotificationPage>('/notifications?page=1&pageSize=1').then(value => setUnreadCount(value.unreadCount)).catch(() => undefined)
    load()
    const timer = window.setInterval(load, 30_000)
    return () => window.clearInterval(timer)
  }, [admin, path])

  const logout = async () => { try { await api('/auth/logout', { method: 'POST' }) } finally { setAdmin(null); go('/login') } }
  if (checking) return <FullState text="正在恢复登录状态…" />
  if (!admin) return <Login onLogin={value => { setAdmin(value); go('/dashboard') }} />
  if (path === '/login') go('/dashboard')

  return <Layout admin={admin} path={path} unreadCount={unreadCount} logout={logout}>
    <RouteContent path={path} admin={admin} notificationsChanged={setUnreadCount} />
  </Layout>
}

function RouteContent({ path, admin, notificationsChanged }: { path: string; admin: Admin; notificationsChanged: (count: number) => void }) {
  if (path.startsWith('/orders/')) return <OrderDetail id={path.split('/')[2]} admin={admin} />
  if (path === '/orders') return <Orders />
  if (path === '/appointments') return <Appointments />
  if (path === '/reviews') return <Reviews />
  if (path === '/notifications') return <Notifications changed={notificationsChanged} />
  if (path === '/inquiries/monthly') return <OperationsSettings key="monthly-inquiries" section="inquiries" inquiryType="monthly" />
  if (path === '/inquiries/rental') return <OperationsSettings key="rental-inquiries" section="inquiries" inquiryType="rental" />
  if (path === '/operations/vehicles') return <OperationsSettings section="vehicles" />
  if (path === '/operations/banners') return <OperationsSettings section="banners" />
  if (path === '/operations/pricing') return <OperationsSettings section="pricing" />
  if (path === '/operations/content') return <OperationsSettings section="contact" />
  if (path === '/system/admins') return <WechatAdmins />
  return <Dashboard />
}

function Login({ onLogin }: { onLogin: (admin: Admin) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true)
    try { const result = await api<{ admin: Admin }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }); onLogin(result.admin) }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : '登录失败，请稍后重试') }
    finally { setLoading(false) }
  }
  return <main className="login-shell">
    <section className="login-brand"><div className="brand-mark">唐</div><small>UNMANNED DELIVERY OPERATIONS</small><h1>唐小识<br />运营中心</h1><p>审核线上需求，安排无人车，掌握每一笔履约进度。</p><div className="brand-lines"><span>订单审核</span><span>运力参考</span><span>全程留痕</span></div></section>
    <form className="login-card" onSubmit={submit}><div><small>ADMIN PORTAL</small><h2>管理员登录</h2><p>进入无人配送运营工作台</p></div><label>用户名<input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required maxLength={100} /></label><label>密码<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>{error && <div className="alert error">{error}</div>}<button className="primary" disabled={loading}>{loading ? '正在验证…' : '登录运营中心'}</button><p className="security-note">会话使用 HttpOnly Cookie 保存，密码不会存储在浏览器中。</p></form>
  </main>
}

function Layout({ admin, path, unreadCount, logout, children }: { admin: Admin; path: string; unreadCount: number; logout: () => void; children: ReactNode }) {
  const groups = NAV_GROUPS.map(group => ({ ...group, items: group.items.filter(item => !item.roles || item.roles.includes(admin.role)) })).filter(group => group.items.length)
  const flat = groups.flatMap(group => group.items)
  const title = path.startsWith('/orders/') ? '订单详情' : flat.find(item => item.path === path)?.label || '工作台'
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="logo"><b>唐</b><div><strong>唐小识运营中心</strong><span>无人配送管理</span></div></div>
      <nav className="nav-groups">{groups.map(group => <section className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map(item => <button key={item.path} className={(path === item.path || (item.path === '/orders' && path.startsWith('/orders/'))) ? 'active' : ''} onClick={() => go(item.path)}><span>{item.label}</span>{item.path === '/notifications' && unreadCount > 0 && <i>{unreadCount > 99 ? '99+' : unreadCount}</i>}</button>)}</section>)}</nav>
      <div className="aside-foot"><span className="connection-dot" /> 运营环境<br /><small>Supabase 数据模式</small></div>
    </aside>
    <section className="workspace"><header className="topbar"><div><p>唐小识 / {title}</p><h1>{title}</h1></div><div className="top-actions"><button className="notification-button" onClick={() => go('/notifications')}>通知{unreadCount > 0 && <span>{unreadCount}</span>}</button><div className="admin-chip"><span>{admin.username.slice(0, 1).toUpperCase()}</span><div><b>{admin.username}</b><small>{ROLE_LABELS[admin.role]}</small></div><button onClick={logout}>退出</button></div></div></header><main className="content">{children}</main></section>
  </div>
}

function Dashboard() {
  const [data, setData] = useState<DashboardData>()
  const [error, setError] = useState('')
  const [countModalOpen, setCountModalOpen] = useState(false)
  const [countDraft, setCountDraft] = useState<Record<string, { totalCount: number; manualReservedCount: number }>>({})
  const [savingCounts, setSavingCounts] = useState(false)
  const { toast } = useFeedback()

  useEffect(() => { api<DashboardData>('/dashboard').then(setData).catch(reason => setError(messageOf(reason))) }, [])

  if (error) return <ErrorState text={error} />
  if (!data) return <Loading />

  const openCountModal = () => {
    setCountDraft(Object.fromEntries(data.vehicleCapacity.map(vehicle => [vehicle.id, {
      totalCount: vehicle.totalCount,
      manualReservedCount: vehicle.manualReservedCount,
    }])))
    setCountModalOpen(true)
  }
  const updateReservedCount = (vehicleId: string, totalCount: number, fallback: number, value: number) => {
    setCountDraft(current => ({
      ...current,
      [vehicleId]: {
        ...(current[vehicleId] || { totalCount, manualReservedCount: fallback }),
        manualReservedCount: Math.min(9999, Math.max(0, Math.floor(value) || 0)),
      },
    }))
  }
  const saveCounts = async () => {
    setSavingCounts(true)
    try {
      await api<unknown>('/operations/vehicle-counts', {
        method: 'PUT',
        body: JSON.stringify({
          items: data.vehicleCapacity.map(vehicle => ({
            id: vehicle.id,
            totalCount: vehicle.totalCount,
            manualReservedCount: countDraft[vehicle.id]?.manualReservedCount ?? vehicle.manualReservedCount,
          })),
        }),
      })
      setData(current => current ? {
        ...current,
        vehicleCapacity: current.vehicleCapacity.map(vehicle => {
          const manualReservedCount = countDraft[vehicle.id]?.manualReservedCount ?? vehicle.manualReservedCount
          const reservedCount = vehicle.onlineReservedCount + manualReservedCount
          return {
            ...vehicle,
            manualReservedCount,
            reservedCount,
            availableCount: Math.max(0, vehicle.totalCount - reservedCount),
            insufficient: reservedCount > vehicle.totalCount,
          }
        }),
      } : current)
      setCountModalOpen(false)
      toast('占用数量保存成功', 'success')
    } catch (reason) {
      toast(messageOf(reason), 'error')
    } finally {
      setSavingCounts(false)
    }
  }
  const metrics = [
    { label: '待审核订单', value: data.pendingReview, path: '/orders?status=pending_review', tone: 'amber', detail: '进入处理' },
    { label: '待安排车辆', value: data.paid, path: '/orders?status=paid', tone: 'blue', detail: '进入处理' },
    { label: '配送进行中', value: data.dispatching + data.delivering, path: '/orders?status=dispatching', tone: 'cyan', detail: '进入处理' },
    { label: '两小时内预约', value: data.appointmentSummary.dueSoon, path: '/appointments?scope=due', tone: 'red', detail: `今日共 ${data.appointmentSummary.todayTotal} 单` },
  ]

  return <>
    <section className="dashboard-intro"><div><small>TODAY'S OPERATIONS</small><h2>先处理最紧迫的运营待办</h2><p>聚焦按趟订单审核、无人车安排和正在进行的配送任务。</p></div><div className="today-number"><span>今日新增</span><strong>{data.todayNew}</strong><small>笔线上需求</small></div></section>
    <div className="metrics">{metrics.map(metric => <button className={`metric ${metric.tone}`} key={metric.label} onClick={() => go(metric.path)}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></button>)}</div>
    <Panel title="按趟车型参考数量" action={<button onClick={openCountModal}>管理占用数量</button>}>
      <div className="capacity-track">{data.vehicleCapacity.map(vehicle => <button key={vehicle.id} className={vehicle.availableCount <= 0 ? 'warning' : ''} onClick={openCountModal}>{vehicle.availableCount <= 0 && <i>余量 0 台</i>}<span>{vehicle.name}</span><strong>{vehicle.availableCount}</strong><small>可用 · 总数 {vehicle.totalCount} / 占用 {vehicle.reservedCount}</small>{vehicle.insufficient && <em>当前占用已超过总数</em>}</button>)}</div>
    </Panel>
    {countModalOpen && <div className="modal-bg" onMouseDown={() => !savingCounts && setCountModalOpen(false)}>
      <section className="vehicle-count-modal" role="dialog" aria-modal="true" aria-label="管理车型占用数量" onMouseDown={event => event.stopPropagation()}>
        <header><div><small>FLEET OCCUPANCY</small><h2>管理按趟车型占用数量</h2><p>仅登记人工占用数量；系统预占由有效订单自动计算，总数保持车型设置中的值。</p></div><button className="plain-close" aria-label="关闭" onClick={() => setCountModalOpen(false)}>×</button></header>
        <div className="vehicle-count-list inventory-list">{data.vehicleCapacity.map(vehicle => {
          const reserved = countDraft[vehicle.id]?.manualReservedCount ?? vehicle.manualReservedCount
          return <div className="inventory-row" key={vehicle.id}>
            <div className="vehicle-count-image">{vehicle.imageUrl ? <img src={vehicle.imageUrl} alt={vehicle.name} /> : <span>{vehicle.name.slice(0, 1)}</span>}</div>
            <div className="inventory-name"><b>{vehicle.name}</b><small>总数 {vehicle.totalCount} 台 · 系统预占 {vehicle.onlineReservedCount} 台 · 当前可用 {Math.max(0, vehicle.totalCount - vehicle.onlineReservedCount - reserved)} 台</small></div>
            <label className="inventory-reserved-control">占用数量<div className="count-stepper"><button type="button" aria-label={`${vehicle.name}占用数量减一`} onClick={() => updateReservedCount(vehicle.id, vehicle.totalCount, vehicle.manualReservedCount, reserved - 1)}>−</button><input type="number" min="0" max="9999" step="1" value={reserved} onChange={event => updateReservedCount(vehicle.id, vehicle.totalCount, vehicle.manualReservedCount, Number(event.target.value))} /><button type="button" className="count-increment" aria-label={`${vehicle.name}占用数量加一`} onClick={() => updateReservedCount(vehicle.id, vehicle.totalCount, vehicle.manualReservedCount, reserved + 1)}>+1</button></div></label>
          </div>
        })}</div>
        <footer><span>共 {data.vehicleCapacity.length} 个按趟车型</span><div><button className="danger count-footer-action" disabled={savingCounts} onClick={() => setCountModalOpen(false)}>取消</button><button className="primary count-footer-action" disabled={savingCounts} onClick={() => void saveCounts()}>{savingCounts ? '保存中…' : '保存数量'}</button></div></footer>
      </section>
    </div>}
  </>
}

function Orders() {
  const initial = new URLSearchParams(location.hash.split('?')[1]).get('status') || ''
  const [filters, setFilters] = useState({ status: initial, orderNo: '', keyword: '', dateFrom: '', dateTo: '', page: 1 })
  const [data, setData] = useState<Page<OrderRow>>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const sequence = useRef(0)
  const load = useCallback(async () => {
    const current = ++sequence.current
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({ ...filters, page: String(filters.page), pageSize: '20' })
      const value = await api<Page<OrderRow>>(`/orders?${query}`)
      if (current === sequence.current) setData(value)
    } catch (reason) {
      if (current === sequence.current) setError(messageOf(reason))
    } finally {
      if (current === sequence.current) setLoading(false)
    }
  }, [filters])
  useEffect(() => { void load() }, [load])
  const update = (key: keyof typeof filters, value: string | number) => setFilters(current => ({ ...current, [key]: value, page: key === 'page' ? Number(value) : 1 }))
  const updateStatus = (status: string) => setFilters(current => ({ ...current, status, page: 1 }))
  return <>
    <Panel title="筛选按趟订单" action={<div className="panel-actions"><button onClick={() => go('/appointments')}>查看预约调度</button><button onClick={() => void load()} disabled={loading}>刷新数据</button></div>}>
      <div className="filters"><select value={filters.status} onChange={event => updateStatus(event.target.value)}><option value="">全部状态</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><input placeholder="订单编号" value={filters.orderNo} onChange={event => update('orderNo', event.target.value)} /><input placeholder="联系人或手机号" value={filters.keyword} onChange={event => update('keyword', event.target.value)} /><input type="date" value={filters.dateFrom} onChange={event => update('dateFrom', event.target.value)} /><input type="date" value={filters.dateTo} onChange={event => update('dateTo', event.target.value)} /></div>
    </Panel>
    <Panel title={`订单列表${data ? ` · ${data.total} 条` : ''}`}>{error ? <ErrorState text={error} /> : loading && !data ? <Loading /> : data?.items.length ? <><OrderTable rows={data.items} /><Pager page={data.page} pages={data.totalPages} setPage={page => update('page', page)} /></> : <Empty text="没有符合条件的订单" />}</Panel>
  </>
}

function OrderTable({ rows }: { rows: OrderRow[] }) {
  return <div className="table-wrap"><table><thead><tr><th>订单编号</th><th>提交时间</th><th>联系人</th><th>车型 / 数量</th><th>配送区域</th><th>用车时间</th><th>状态</th><th>审核人</th><th /></tr></thead><tbody>{rows.map(order => <tr key={order.id}><td><b className="mono order-number">{order.orderNo.toUpperCase()}</b></td><td>{dateTime(order.createdAt || order.created_at)}</td><td>{order.contactName}<small>{order.phone}</small></td><td>{order.vehicleId.toUpperCase()}<small>{order.reserved_vehicle_count || 1} 辆</small></td><td>{regionLabel(order.senderCity, order.senderDistrict)} → {regionLabel(order.receiverCity, order.receiverDistrict)}</td><td>{orderRowAppointmentTime(order)}</td><td><Status value={order.status} /></td><td>{order.reviewer || '—'}</td><td><button className="link" onClick={() => go(`/orders/${order.id}`)}>查看</button></td></tr>)}</tbody></table></div>
}

function Appointments() {
  const initial = new URLSearchParams(location.hash.split('?')[1]).get('scope') || 'due'
  const [scope, setScope] = useState(initial), [page, setPage] = useState(1), [data, setData] = useState<Page<AppointmentRow>>(), [error, setError] = useState('')
  useEffect(() => { void api<Page<AppointmentRow>>(`/appointments?scope=${scope}&page=${page}&pageSize=20`).then(setData).catch(reason => setError(messageOf(reason))) }, [scope, page])
  return <Panel title="预约调度" action={<div className="scope-tabs"><button className={scope === 'due' ? 'active' : ''} onClick={() => { setScope('due'); setPage(1) }}>两小时内</button><button className={scope === 'today' ? 'active' : ''} onClick={() => { setScope('today'); setPage(1) }}>今日预约</button><button className={scope === 'all' ? 'active' : ''} onClick={() => { setScope('all'); setPage(1) }}>全部预约</button></div>}>{error ? <ErrorState text={error} /> : !data ? <Loading /> : data.items.length ? <><OrderTable rows={data.items} /><Pager page={data.page} pages={data.totalPages} setPage={setPage} /></> : <Empty text="当前没有需要提醒的预约订单" />}</Panel>
}

function OrderDetail({ id, admin }: { id: string; admin: Admin }) {
  const [order, setOrder] = useState<OrderDetailData>()
  const [error, setError] = useState('')
  const [review, setReview] = useState<'approve' | 'reject' | null>(null)
  const [transition, setTransition] = useState<'dispatching' | 'delivering' | 'completed' | null>(null)
  const load = useCallback(() => api<OrderDetailData>(`/orders/${id}`).then(setOrder).catch(reason => setError(messageOf(reason))), [id])

  useEffect(() => { void load() }, [load])
  if (error) return <ErrorState text={error} />
  if (!order) return <Loading />

  const sender = order.addresses.find(address => address.role === 'sender')
  const receiver = order.addresses.find(address => address.role === 'receiver')
  const next = order.status === 'paid' ? 'dispatching' : order.status === 'dispatching' ? 'delivering' : order.status === 'delivering' ? 'completed' : null
  const nextLabel = next === 'dispatching' ? '确认已安排车辆' : next === 'delivering' ? '开始配送' : next === 'completed' ? '完成订单' : ''
  const canOperate = ['super_admin', 'operator'].includes(admin.role)

  return <>
    <section className="order-detail-screen">
      <div className="detail-head">
        <button onClick={() => go('/orders')}>返回订单</button>
        <div className="detail-identity-block">
          <div className="detail-identity"><p className="mono">{order.order_no.toUpperCase()}</p><Status value={order.status} /></div>
          <div className="detail-meta"><span>提交 {dateTime(order.created_at)}</span><span>车型 {order.vehicle_id.toUpperCase()}</span><span>{appointmentTime(order)}</span><span>{order.items.length} 类物品</span></div>
        </div>
        <div className="detail-actions">{order.status === 'pending_review' && canOperate && <button className="primary compact" onClick={() => setReview('approve')}>审核与报价</button>}{next && canOperate && <button className="primary compact" onClick={() => setTransition(next)}>{nextLabel}</button>}</div>
      </div>
      <OrderFlow order={order} />
      <div className="order-detail-body">
        <div className="order-overview-row">
          <Panel title="地址信息"><Address title="寄件人" value={sender} /><Address title="收件人" value={receiver} /></Panel>
          <div className="order-information-column">
            <Panel title="订单信息"><Info rows={[['车型', order.vehicle_id.toUpperCase()], ['占用车辆', `${order.reserved_vehicle_count || 0} 辆`], ['无人车编号（车牌）', order.vehicle_plate || '—'], ['用车时间', appointmentTime(order)], ...(order.reviewer ? [['审核人员', order.reviewer] as [string, string]] : [])]} /></Panel>
            {order.status === 'rejected' && <section className="panel rejection-panel"><div className="panel-title"><h2>拒绝原因</h2></div><p>{order.rejection_reason || '未记录拒绝原因'}</p></section>}
          </div>
        </div>
        <section className="panel detail-items-panel">
          <div className="panel-title"><div><h2>物品信息</h2><small>共 {order.items.length} 类物品，全部展示在当前页面</small></div></div>
          <div className="item-table">{order.items.map(item => <div key={item.id}><b>{item.name}</b><span>分类<strong>{item.categoryLabel || item.category || '其他'}</strong></span><span>数量<strong>{item.quantity}</strong></span><span>重量<strong>{item.estimated_weight_kg} kg</strong></span><span>尺寸<strong>{item.length_mm || '—'} × {item.width_mm || '—'} × {item.height_mm || '—'} mm</strong></span><span>特殊要求<strong>{[item.fragile && '易碎', item.oversized && '超长', item.need_carry && '需搬运'].filter(Boolean).join('、') || '无'}</strong></span><span>备注<strong>{item.remark || '—'}</strong></span></div>)}</div>
        </section>
      </div>
    </section>
    {review && <ReviewModal order={order} mode={review} close={() => setReview(null)} done={() => { setReview(null); void load() }} switchMode={setReview} />}
    {transition && <TransitionModal order={order} target={transition} close={() => setTransition(null)} done={() => { setTransition(null); void load() }} />}
  </>
}

function ReviewModal({ order, mode, close, done, switchMode }: { order: OrderDetailData; mode: 'approve' | 'reject'; close: () => void; done: () => void; switchMode: (value: 'approve' | 'reject') => void }) {
  const { toast } = useFeedback()
  const estimatedDistance = estimateRouteDistance(order.addresses)
  const [form, setForm] = useState({ base: '0', distance: '0', vehicle: '0', service: '0', discount: '0', distanceMeters: estimatedDistance ? String(estimatedDistance) : '0', vehicleCount: '1', expiresAt: '', internalNote: '', userNote: '', rejectionReason: '' })
  const [loading, setLoading] = useState(false), [error, setError] = useState('')
  const cents = (value: string) => Math.round(Number(value) * 100)
  const total = useMemo(() => cents(form.base) + cents(form.distance) + cents(form.vehicle) + cents(form.service) - cents(form.discount), [form])
  useEffect(() => { if (mode !== 'approve') return; const weightKg = order.items.reduce((sum, item) => sum + Number(item.estimated_weight_kg || 0), 0); api<{ baseFeeCents: number; distanceFeeCents: number; vehicleFeeCents: number; serviceFeeCents: number; discountCents: number; validityHours: number }>(`/operations/orders/${order.id}/suggested-quote`, { method: 'POST', body: JSON.stringify({ vehicleId: order.vehicle_id, distanceMeters: estimatedDistance, weightKg }) }).then(quote => setForm(current => ({ ...current, base: String(quote.baseFeeCents / 100), distance: String(quote.distanceFeeCents / 100), vehicle: String(quote.vehicleFeeCents / 100), service: String(quote.serviceFeeCents / 100), discount: String(quote.discountCents / 100), expiresAt: new Date(Date.now() + Number(quote.validityHours || 24) * 3_600_000).toISOString().slice(0, 16) }))).catch(() => undefined) }, [estimatedDistance, mode, order.id, order.items, order.vehicle_id])
  const set = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }))
  const submit = async () => {
    setError('')
    if (mode === 'reject' && !form.rejectionReason.trim()) return setError('拒绝原因不能为空')
    if (mode === 'approve' && (!Number.isInteger(Number(form.vehicleCount)) || Number(form.vehicleCount) < 1 || total < 0)) return setError('车辆数量必须为正整数，报价总额不能为负数')
    setLoading(true)
    try { const body = mode === 'approve' ? { decision: 'approve', baseFeeCents: cents(form.base), distanceFeeCents: cents(form.distance), vehicleFeeCents: cents(form.vehicle), serviceFeeCents: cents(form.service), discountCents: cents(form.discount), distanceMeters: Number(form.distanceMeters), vehicleCount: Number(form.vehicleCount), expiresAt: new Date(form.expiresAt).toISOString(), internalNote: form.internalNote, userNote: form.userNote } : { decision: 'reject', rejectionReason: form.rejectionReason, internalNote: form.internalNote }; await api(`/orders/${order.id}/review`, { method: 'POST', body: JSON.stringify(body) }); toast(`${order.order_no}审核完成`, 'success'); done() }
    catch (reason) { setError(reason instanceof ApiError && reason.status === 409 ? '该订单已由其他管理员处理，请刷新查看。' : messageOf(reason)) }
    finally { setLoading(false) }
  }
  return <div className="modal-bg"><div className="modal"><div className="modal-title"><div><small className="mono">{order.order_no}</small><h2>订单审核与无人车预占</h2></div><button className="icon-close" onClick={close} aria-label="关闭">×</button></div><div className="mode-tabs"><button className={mode === 'approve' ? 'active' : ''} onClick={() => switchMode('approve')}>确认可服务</button><button className={mode === 'reject' ? 'active reject' : ''} onClick={() => switchMode('reject')}>拒绝订单</button></div>{mode === 'approve' ? <><div className="form-grid">{([['base', '起步费（元）'], ['distance', '距离费（元）'], ['vehicle', '车型费（元）'], ['service', '服务费（元）'], ['discount', '优惠金额（元）'], ['distanceMeters', '参考路线距离（米）'], ['vehicleCount', '预占车辆数']] as const).map(([key, label]) => <label key={key}>{label}<input type="number" min={key === 'vehicleCount' ? '1' : '0'} step={key === 'distanceMeters' || key === 'vehicleCount' ? '1' : '0.01'} value={form[key]} onChange={event => set(key, event.target.value)} />{key === 'distanceMeters' && estimatedDistance > 0 && <small>已根据地址坐标自动估算，可人工修正</small>}</label>)}<label>报价有效期<input type="datetime-local" value={form.expiresAt} onChange={event => set('expiresAt', event.target.value)} required /></label></div><div className="total"><span>用户应付总价</span><strong>{money(total)}</strong><small>审核通过后预占 {form.vehicleCount || 1} 辆无人车；数量不足只提醒，不阻断。</small></div><label>给用户的说明<textarea maxLength={500} value={form.userNote} onChange={event => set('userNote', event.target.value)} /></label></> : <><div className="reason-options">{REJECTION_REASONS.map(reason => <button key={reason} className={form.rejectionReason === reason ? 'active' : ''} onClick={() => set('rejectionReason', reason)}>{reason}</button>)}</div><label>拒绝原因（用户可见）<textarea required maxLength={500} value={form.rejectionReason} onChange={event => set('rejectionReason', event.target.value)} placeholder="选择常用原因，或输入其他原因" /></label></>}<label>内部备注（用户不可见）<textarea maxLength={1000} value={form.internalNote} onChange={event => set('internalNote', event.target.value)} /></label>{error && <div className="alert error">{error}</div>}<div className="modal-actions"><button onClick={close}>取消</button><button className={mode === 'reject' ? 'danger' : 'primary'} onClick={() => void submit()} disabled={loading}>{loading ? '提交中…' : mode === 'approve' ? '批准并预占车辆' : '确认拒绝'}</button></div></div></div>
}

function TransitionModal({ order, target, close, done }: { order: OrderDetailData; target: 'dispatching' | 'delivering' | 'completed'; close: () => void; done: () => void }) {
  const { toast } = useFeedback()
  const [note, setNote] = useState(''), [vehicleCount, setVehicleCount] = useState(String(order.reserved_vehicle_count || 1)), [vehiclePlate, setVehiclePlate] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(false)
  const submit = async () => { if (target === 'dispatching' && (!Number.isInteger(Number(vehicleCount)) || Number(vehicleCount) < 1)) return setError('请填写本次实际派出的车辆数量'); if (target === 'completed' && !note.trim()) return setError('请填写完成说明'); setLoading(true); try { await api(`/orders/${order.id}/status`, { method: 'POST', body: JSON.stringify({ status: target, note, vehicleCount: target === 'dispatching' ? Number(vehicleCount) : undefined, vehiclePlate: target === 'dispatching' ? vehiclePlate : undefined }) }); toast(`${order.order_no}状态更新成功`, 'success'); done() } catch (reason) { setError(messageOf(reason)); toast(messageOf(reason), 'error') } finally { setLoading(false) } }
  const title = target === 'dispatching' ? '确认已安排无人车' : target === 'delivering' ? '确认开始配送' : '确认完成订单'
  return <div className="modal-bg"><div className="modal compact-modal">
    <div className="modal-title"><div><small className="mono">{order.order_no}</small><h2>{title}</h2></div><button className="plain-close" onClick={close} aria-label="关闭">×</button></div>
    {target === 'dispatching' && <div className="dispatch-fields"><label>实际派车数量<input type="number" min="1" step="1" value={vehicleCount} onChange={event => setVehicleCount(event.target.value)} /></label><label>无人车编号（车牌）<input maxLength={32} value={vehiclePlate} onChange={event => setVehiclePlate(event.target.value)} placeholder="选填，例如 无人车 08（沪A·12345）" /></label></div>}
    <label>{target === 'completed' ? '完成说明' : '内部调度备注（默认不显示给用户）'}<textarea value={note} onChange={event => setNote(event.target.value)} placeholder={target === 'dispatching' ? '仅供内部调度查看，记录线下安排情况和预计时间' : target === 'completed' ? '记录送达结果；当前不要求上传图片' : '仅供内部查看，记录本次状态更新说明'} /></label>
    {error && <div className="alert error">{error}</div>}<div className="modal-actions"><button onClick={close}>取消</button><button className="primary" onClick={() => void submit()} disabled={loading}>{loading ? '提交中…' : title}</button></div>
  </div></div>
}

function Reviews() {
  const [data, setData] = useState<Page<ReviewRecord>>(), [result, setResult] = useState(''), [page, setPage] = useState(1)
  useEffect(() => { void api<Page<ReviewRecord>>(`/reviews?result=${result}&page=${page}&pageSize=20`).then(setData) }, [result, page])
  return <Panel title="审核记录" action={<select value={result} onChange={event => { setResult(event.target.value); setPage(1) }}><option value="">全部结果</option><option value="approved">已批准</option><option value="rejected">已拒绝</option></select>}>{!data ? <Loading /> : data.items.length ? <><div className="table-wrap"><table><thead><tr><th>订单编号</th><th>审核结果</th><th>审核人</th><th>审核时间</th><th>报价金额</th><th>拒绝原因</th><th /></tr></thead><tbody>{data.items.map(record => <tr key={record.id}><td className="mono">{record.orderNo}</td><td>{record.action === 'order.approve' ? '批准' : '拒绝'}</td><td>{record.reviewer}</td><td>{dateTime(record.created_at)}</td><td>{money(record.totalCents)}</td><td>{record.rejectionReason || '—'}</td><td><button className="link" onClick={() => go(`/orders/${record.orderId}`)}>查看</button></td></tr>)}</tbody></table></div><Pager page={data.page} pages={data.totalPages} setPage={setPage} /></> : <Empty text="暂无审核记录" />}</Panel>
}

function Notifications({ changed }: { changed: (count: number) => void }) {
  const [data, setData] = useState<NotificationPage>(), [unreadOnly, setUnreadOnly] = useState(false), [error, setError] = useState('')
  const { toast } = useFeedback()
  const load = useCallback(() => api<NotificationPage>(`/notifications?page=1&pageSize=50&unreadOnly=${unreadOnly}`).then(setData).catch(reason => setError(messageOf(reason))), [unreadOnly])
  useEffect(() => { void load() }, [load])
  const read = async (notification: AdminNotification) => {
    if (!notification.readAt) {
      const readAt = new Date().toISOString()
      const nextUnread = Math.max(0, (data?.unreadCount || 1) - 1)
      setData(current => current ? { ...current, unreadCount: nextUnread, items: unreadOnly ? current.items.filter(item => item.id !== notification.id) : current.items.map(item => item.id === notification.id ? { ...item, readAt } : item) } : current)
      changed(nextUnread)
      try {
        await api(`/notifications/${notification.id}/read`, { method: 'PUT' })
      } catch (reason) {
        toast(`标记已读失败：${messageOf(reason)}`, 'error')
        await load()
        return
      }
    }
    if (notification.targetPath) go(notification.targetPath)
  }
  const readAll = async () => { await api('/notifications/read-all', { method: 'PUT' }); changed(0); await load() }
  return <Panel title={`通知中心${data ? ` · ${data.unreadCount} 条未读` : ''}`} action={<div className="panel-actions"><label className="check-label"><input type="checkbox" checked={unreadOnly} onChange={event => setUnreadOnly(event.target.checked)} />只看未读</label><button onClick={() => void readAll()}>全部已读</button></div>}>
    {error ? <ErrorState text={error} /> : !data ? <Loading /> : data.items.length ? <div className="notification-list">{data.items.map(notification => <button key={notification.id} className={notification.readAt ? 'read' : ''} data-status={notification.status || 'default'} onClick={() => void read(notification)}><i /><div><div className="notification-title-row"><b>{notification.title}</b>{notification.status && <Status value={notification.status} />}</div><p>{notification.content}</p><small>{dateTime(notification.createdAt)}</small></div><span className="notification-read-state">{notification.readAt ? '已读' : '待处理'}</span></button>)}</div> : <Empty text="目前没有通知" />}
  </Panel>
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) { return <section className="panel"><div className="panel-title"><h2>{title}</h2>{action}</div>{children}</section> }
function Status({ value }: { value: string }) { return <span className={`status ${value}`}>{STATUS_LABELS[value] || value}</span> }
function Info({ rows }: { rows: Array<[string, string]> }) { return <dl className="info">{rows.map(row => <div key={row[0]}><dt>{row[0]}</dt><dd>{row[1]}</dd></div>)}</dl> }
function Address({ title, value }: { title: string; value?: OrderAddress }) { const addressText = [value?.province, value?.city, value?.district, value?.poi_name, value?.formatted_address, value?.detail_address].filter(Boolean).join(' '); const copyText = [value?.contact_name, value?.phone, addressText].filter(Boolean).join(' '); return <div className="address"><div><b>{title} · {value?.contact_name || '—'} {value?.phone || ''}</b><CopyButton text={copyText} label={`复制${title}信息`} /></div><span>{[value?.province, value?.city, value?.district, value?.poi_name].filter(Boolean).join(' ')}</span><small>{value?.formatted_address} {value?.detail_address}</small></div> }
function CopyButton({ text, label = '复制' }: { text: string; label?: string }) { const [copied, setCopied] = useState(false); const copy = async () => { if (!text) return; await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1500) }; return <button className="copy-button" onClick={() => void copy()} disabled={!text}>{copied ? '已复制' : label}</button> }
function appointmentRange(start: string, end?: string) {
  const startAt = new Date(start)
  if (Number.isNaN(startAt.getTime())) return '—'
  const endAt = end ? new Date(end) : new Date(startAt.getTime() + 30 * 60 * 1000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${startAt.getFullYear()}年${pad(startAt.getMonth() + 1)}月${pad(startAt.getDate())}日 ${pad(startAt.getHours())}:${pad(startAt.getMinutes())}-${pad(endAt.getHours())}:${pad(endAt.getMinutes())}`
}
function orderRowAppointmentTime(order: OrderRow) {
  const immediate = order.pickup_type === 'immediate' || !order.scheduledAt
  const start = immediate ? order.createdAt || order.created_at : order.scheduledAt
  return start ? appointmentRange(start, immediate ? undefined : order.scheduledEndAt) : '—'
}
function appointmentTime(order: OrderDetailData) {
  const immediate = order.pickup_type === 'immediate' || !order.scheduled_at
  const start = immediate ? order.created_at : order.scheduled_at
  return start ? appointmentRange(start, immediate ? undefined : order.scheduled_end_at) : '—'
}
function OrderFlow({ order }: { order: OrderDetailData }) {
  const [selectedStep, setSelectedStep] = useState<number | null>(null)
  const status = order.status
  const steps = [
    { label: '下单', targets: [] as string[] },
    { label: '审核', targets: ['pending_payment', 'rejected'] },
    { label: '支付', targets: ['paid', 'quote_expired'] },
    { label: '配车', targets: ['dispatching'] },
    { label: '配送', targets: ['delivering'] },
    { label: '完成', targets: ['completed'] },
  ]
  const index = status === 'pending_review' || status === 'rejected' ? 1 : ['pending_payment', 'quote_expired'].includes(status) ? 2 : status === 'paid' ? 3 : ['dispatching', 'delivering'].includes(status) ? 4 : status === 'completed' ? 5 : 0
  const logTime = (target: string) => order.statusLogs.find(log => log.to_status === target)?.created_at
  const times = [order.created_at, order.reviewed_at || logTime('pending_payment') || logTime('rejected'), logTime('paid'), order.dispatched_at || logTime('dispatching'), logTime('delivering'), order.completed_at || logTime('completed')]
  const currentStep = selectedStep ?? 0
  const auditMatchesStep = (action = '') => {
    const normalized = action.toLowerCase()
    if (currentStep === 1) return /review|approve|reject/.test(normalized)
    if (currentStep === 2) return /pay|quote/.test(normalized)
    if (currentStep === 3) return /dispatch|vehicle/.test(normalized)
    if (currentStep === 4) return /deliver/.test(normalized)
    if (currentStep === 5) return /complete/.test(normalized)
    return /create|submit/.test(normalized)
  }
  const details: Array<{ title: string; body: string; meta: string }> = []
  if (currentStep === 0) details.push({ title: '用户下单备注', body: order.customer_remark?.trim() || '用户未填写下单备注', meta: dateTime(order.created_at) })
  if (currentStep === 1 && order.rejection_reason) details.push({ title: '拒绝原因', body: order.rejection_reason, meta: order.reviewer || '管理员' })
  if (currentStep === 3 && (order.dispatch_note || order.vehicle_plate)) details.push({ title: '配车安排', body: [order.dispatch_note, order.vehicle_plate && `无人车编号：${order.vehicle_plate}`].filter(Boolean).join(' · '), meta: order.dispatched_at ? dateTime(order.dispatched_at) : '—' })
  if (currentStep === 5 && order.completion_note) details.push({ title: '完成说明', body: order.completion_note, meta: order.completed_at ? dateTime(order.completed_at) : '—' })
  for (const record of order.statusLogs.filter(record => steps[currentStep].targets.includes(record.to_status || ''))) {
    details.push({ title: STATUS_LABELS[record.to_status || ''] || record.to_status || '状态更新', body: record.remark || '未填写状态备注', meta: dateTime(record.created_at) })
  }
  for (const record of order.auditLogs.filter(record => auditMatchesStep(record.action))) {
    details.push({ title: record.action || '操作记录', body: record.admin_username || record.operator_name || '管理员操作', meta: dateTime(record.created_at) })
  }

  return <section className="order-flow-panel">
    <div className={`order-flow ${status === 'rejected' ? 'stopped' : ''}`}>{steps.map((step, stepIndex) => <button type="button" key={step.label} className={`${stepIndex < index || status === 'completed' ? 'done' : stepIndex === index ? 'active' : ''} ${selectedStep === stepIndex ? 'selected' : ''}`} onClick={() => setSelectedStep(stepIndex)}><i>{stepIndex + 1}</i><span>{step.label}</span><small>{times[stepIndex] ? dateTime(times[stepIndex]) : '\u00a0'}</small></button>)}</div>
    {selectedStep !== null && <div className="modal-bg flow-modal-bg" onMouseDown={() => setSelectedStep(null)}>
      <section className="modal flow-detail-modal" onMouseDown={event => event.stopPropagation()}>
        <div className="modal-title"><div><small>流程详情 · {details.length} 条备注与记录</small><h2>{steps[currentStep].label}</h2></div><button className="plain-close" aria-label="关闭流程详情" onClick={() => setSelectedStep(null)}>×</button></div>
        {details.length ? <div className="flow-records">{details.map((detail, detailIndex) => <article key={`${detail.title}-${detail.meta}-${detailIndex}`}><b>{detail.title}</b><p>{detail.body}</p><small>{detail.meta}</small></article>)}</div> : <p className="flow-empty">当前节点暂无备注或操作记录</p>}
      </section>
    </div>}
  </section>
}

function regionLabel(city?: string, district?: string) { return [city, district].filter((value, index, list) => value && list.indexOf(value) === index).join('') || '—' }
function estimateRouteDistance(addresses: OrderAddress[]) { const sender = addresses.find(address => address.role === 'sender'), receiver = addresses.find(address => address.role === 'receiver'); const lat1 = Number(sender?.latitude), lat2 = Number(receiver?.latitude), lng1 = Number(sender?.longitude), lng2 = Number(receiver?.longitude); if (![lat1, lat2, lng1, lng2].every(Number.isFinite) || (lat1 === 0 && lng1 === 0) || (lat2 === 0 && lng2 === 0)) return 0; const radians = (value: number) => value * Math.PI / 180; const dLat = radians(lat2 - lat1), dLng = radians(lng2 - lng1); const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2; const directMeters = 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return Math.round(directMeters * 1.25 / 100) * 100 }
function Pager({ page, pages, setPage }: { page: number; pages: number; setPage: (page: number) => void }) { return <div className="pager"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button><span>第 {page} / {Math.max(1, pages)} 页</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>下一页</button></div> }
function Loading() { return <FullState text="正在加载运营数据…" /> }
function Empty({ text }: { text: string }) { return <div className="empty"><b>暂无数据</b><span>{text}</span></div> }
function ErrorState({ text }: { text: string }) { return <div className="empty error"><b>加载失败</b><span>{text}</span></div> }
function FullState({ text }: { text: string }) { return <div className="full-state"><span /><p>{text}</p></div> }
