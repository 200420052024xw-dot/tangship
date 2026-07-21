import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, api, dateTime, money } from './api'
import type { Admin, AdminNotification, DashboardData, NotificationPage, OrderAddress, OrderDetailData, OrderRow, Page, ReviewRecord, Role } from './types'
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

export default function App() {
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
    <RouteContent path={path} admin={admin} notificationsChanged={() => setUnreadCount(0)} />
  </Layout>
}

function RouteContent({ path, admin, notificationsChanged }: { path: string; admin: Admin; notificationsChanged: () => void }) {
  if (path.startsWith('/orders/')) return <OrderDetail id={path.split('/')[2]} admin={admin} />
  if (path === '/orders') return <Orders />
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
      <div className="aside-foot"><span className="connection-dot" /> 本地运营环境<br /><small>SQLite 数据模式</small></div>
    </aside>
    <section className="workspace"><header className="topbar"><div><p>唐小识 / {title}</p><h1>{title}</h1></div><div className="top-actions"><button className="notification-button" onClick={() => go('/notifications')}>通知{unreadCount > 0 && <span>{unreadCount}</span>}</button><div className="admin-chip"><span>{admin.username.slice(0, 1).toUpperCase()}</span><div><b>{admin.username}</b><small>{ROLE_LABELS[admin.role]}</small></div><button onClick={logout}>退出</button></div></div></header><main className="content">{children}</main></section>
  </div>
}

function Dashboard() {
  const [data, setData] = useState<DashboardData>()
  const [error, setError] = useState('')
  useEffect(() => { api<DashboardData>('/dashboard').then(setData).catch(reason => setError(messageOf(reason))) }, [])
  if (error) return <ErrorState text={error} />
  if (!data) return <Loading />
  const metrics = [
    { label: '待审核订单', value: data.pendingReview, path: '/orders?status=pending_review', tone: 'amber' },
    { label: '待安排车辆', value: data.paid, path: '/orders?status=paid', tone: 'blue' },
    { label: '配送进行中', value: data.dispatching + data.delivering, path: '/orders?status=dispatching', tone: 'cyan' },
    { label: '未读提醒', value: data.unreadNotifications, path: '/notifications', tone: 'red' },
  ]
  return <>
    <section className="dashboard-intro"><div><small>TODAY'S OPERATIONS</small><h2>先处理最紧迫的运营待办</h2><p>聚焦按趟订单审核、无人车安排和正在进行的配送任务。</p></div><div className="today-number"><span>今日新增</span><strong>{data.todayNew}</strong><small>笔线上需求</small></div></section>
    <div className="metrics">{metrics.map(metric => <button className={`metric ${metric.tone}`} key={metric.label} onClick={() => go(metric.path)}><span>{metric.label}</span><strong>{metric.value}</strong><small>进入处理</small></button>)}</div>
    <Panel title="按趟车型参考数量" action={<button onClick={() => go('/operations/vehicles')}>管理车型数量</button>}><div className="capacity-track">{data.vehicleCapacity.map(vehicle => <button key={vehicle.id} className={vehicle.availableCount <= 0 ? 'warning' : ''} onClick={() => go('/operations/vehicles')}><span>{vehicle.name}</span><strong>{vehicle.availableCount}</strong><small>可用 · 总数 {vehicle.totalCount} / 预占 {vehicle.reservedCount}</small></button>)}</div></Panel>
  </>
}

function Orders() {
  const initial = new URLSearchParams(location.hash.split('?')[1]).get('status') || 'pending_review'
  const [filters, setFilters] = useState({ status: initial, orderNo: '', keyword: '', dateFrom: '', dateTo: '', page: 1 })
  const [data, setData] = useState<Page<OrderRow>>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const sequence = useRef(0)
  const load = useCallback(async () => {
    const current = ++sequence.current; setLoading(true); setError('')
    try { const query = new URLSearchParams({ ...filters, page: String(filters.page), pageSize: '20' }); const value = await api<Page<OrderRow>>(`/orders?${query}`); if (current === sequence.current) setData(value) }
    catch (reason) { if (current === sequence.current) setError(messageOf(reason)) }
    finally { if (current === sequence.current) setLoading(false) }
  }, [filters])
  useEffect(() => { void load() }, [load])
  const update = (key: keyof typeof filters, value: string | number) => setFilters(current => ({ ...current, [key]: value, page: key === 'page' ? Number(value) : 1 }))
  const updateStatus = (status: string) => setFilters(current => ({ ...current, status, page: 1 }))
  return <><Panel title="筛选按趟订单" action={<button onClick={() => void load()} disabled={loading}>刷新数据</button>}><div className="filters"><select value={filters.status} onChange={event => updateStatus(event.target.value)}><option value="">全部状态</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><input placeholder="订单编号" value={filters.orderNo} onChange={event => update('orderNo', event.target.value)} /><input placeholder="联系人或手机号" value={filters.keyword} onChange={event => update('keyword', event.target.value)} /><input type="date" value={filters.dateFrom} onChange={event => update('dateFrom', event.target.value)} /><input type="date" value={filters.dateTo} onChange={event => update('dateTo', event.target.value)} /></div></Panel><Panel title={`订单列表${data ? ` · ${data.total} 条` : ''}`}>{error ? <ErrorState text={error} /> : loading && !data ? <Loading /> : data?.items.length ? <><OrderTable rows={data.items} /><Pager page={data.page} pages={data.totalPages} setPage={page => update('page', page)} /></> : <Empty text="没有符合条件的订单" />}</Panel></>
}

function OrderTable({ rows }: { rows: OrderRow[] }) {
  return <div className="table-wrap"><table><thead><tr><th>订单编号</th><th>提交时间</th><th>联系人</th><th>车型 / 数量</th><th>配送区域</th><th>预约时间</th><th>状态</th><th>审核人</th><th /></tr></thead><tbody>{rows.map(order => <tr key={order.id}><td><b className="mono">{order.orderNo}</b></td><td>{dateTime(order.createdAt || order.created_at)}</td><td>{order.contactName}<small>{order.phone}</small></td><td>{order.vehicleId}<small>{order.reserved_vehicle_count || 1} 辆</small></td><td>{order.senderDistrict || '—'} → {order.receiverDistrict || '—'}</td><td>{dateTime(order.scheduledAt)}</td><td><Status value={order.status} /></td><td>{order.reviewer || '—'}</td><td><button className="link" onClick={() => go(`/orders/${order.id}`)}>查看</button></td></tr>)}</tbody></table></div>
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
  return <><div className="detail-head"><button onClick={() => go('/orders')}>返回订单</button><div><p className="mono">{order.order_no}</p><Status value={order.status} /></div><div className="detail-actions">{order.status === 'pending_review' && canOperate && <button className="primary compact" onClick={() => setReview('approve')}>审核与报价</button>}{next && canOperate && <button className="primary compact" onClick={() => setTransition(next)}>{nextLabel}</button>}</div></div>
    <OrderFlow status={order.status} />
    <div className="detail-grid">
      <Panel title="地址信息"><Address title="寄件人" value={sender} /><Address title="收件人" value={receiver} /></Panel>
      <Panel title="订单信息"><Info rows={[['提交时间', dateTime(order.created_at)], ['车型', order.vehicle_id], ['占用车辆', `${order.reserved_vehicle_count || 0} 辆`], ['车牌', order.vehicle_plate || '—'], ['预约时间', dateTime(order.scheduled_at)], ['审核人员', order.reviewer || '—']]} /></Panel>
      <section className="panel detail-wide"><div className="panel-title"><h2>物品信息</h2><small>共 {order.items.length} 项</small></div><div className="item-table">{order.items.map(item => <div key={item.id}><b>{item.name}</b><span>分类<strong>{item.category || '—'}</strong></span><span>数量<strong>{item.quantity}</strong></span><span>重量<strong>{item.estimated_weight_kg} kg</strong></span><span>尺寸<strong>{item.length_mm || '—'} × {item.width_mm || '—'} × {item.height_mm || '—'} mm</strong></span><span>特殊要求<strong>{[item.fragile && '易碎', item.oversized && '超长', item.need_carry && '需搬运'].filter(Boolean).join('、') || '无'}</strong></span><span>备注<strong>{item.remark || '—'}</strong></span></div>)}</div></section>
      {order.customer_remark && <section className="panel customer-note-panel detail-wide"><div className="panel-title"><h2>用户填写的备注</h2></div><p>{order.customer_remark}</p></section>}
      {order.status === 'rejected' && <section className="panel rejection-panel detail-wide"><div className="panel-title"><h2>拒绝原因</h2></div><p>{order.rejection_reason || '未记录拒绝原因'}</p></section>}
    </div>
    {review && <ReviewModal order={order} mode={review} close={() => setReview(null)} done={() => { setReview(null); void load() }} switchMode={setReview} />}
    {transition && <TransitionModal order={order} target={transition} close={() => setTransition(null)} done={() => { setTransition(null); void load() }} />}
  </>
}

function ReviewModal({ order, mode, close, done, switchMode }: { order: OrderDetailData; mode: 'approve' | 'reject'; close: () => void; done: () => void; switchMode: (value: 'approve' | 'reject') => void }) {
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
    try { const body = mode === 'approve' ? { decision: 'approve', baseFeeCents: cents(form.base), distanceFeeCents: cents(form.distance), vehicleFeeCents: cents(form.vehicle), serviceFeeCents: cents(form.service), discountCents: cents(form.discount), distanceMeters: Number(form.distanceMeters), vehicleCount: Number(form.vehicleCount), expiresAt: new Date(form.expiresAt).toISOString(), internalNote: form.internalNote, userNote: form.userNote } : { decision: 'reject', rejectionReason: form.rejectionReason, internalNote: form.internalNote }; await api(`/orders/${order.id}/review`, { method: 'POST', body: JSON.stringify(body) }); done() }
    catch (reason) { setError(reason instanceof ApiError && reason.status === 409 ? '该订单已由其他管理员处理，请刷新查看。' : messageOf(reason)) }
    finally { setLoading(false) }
  }
  return <div className="modal-bg"><div className="modal"><div className="modal-title"><div><small className="mono">{order.order_no}</small><h2>订单审核与无人车预占</h2></div><button className="icon-close" onClick={close} aria-label="关闭">×</button></div><div className="mode-tabs"><button className={mode === 'approve' ? 'active' : ''} onClick={() => switchMode('approve')}>确认可服务</button><button className={mode === 'reject' ? 'active reject' : ''} onClick={() => switchMode('reject')}>拒绝订单</button></div>{mode === 'approve' ? <><div className="form-grid">{([['base', '起步费（元）'], ['distance', '距离费（元）'], ['vehicle', '车型费（元）'], ['service', '服务费（元）'], ['discount', '优惠金额（元）'], ['distanceMeters', '参考路线距离（米）'], ['vehicleCount', '预占车辆数']] as const).map(([key, label]) => <label key={key}>{label}<input type="number" min={key === 'vehicleCount' ? '1' : '0'} step={key === 'distanceMeters' || key === 'vehicleCount' ? '1' : '0.01'} value={form[key]} onChange={event => set(key, event.target.value)} />{key === 'distanceMeters' && estimatedDistance > 0 && <small>已根据地址坐标自动估算，可人工修正</small>}</label>)}<label>报价有效期<input type="datetime-local" value={form.expiresAt} onChange={event => set('expiresAt', event.target.value)} required /></label></div><div className="total"><span>用户应付总价</span><strong>{money(total)}</strong><small>审核通过后预占 {form.vehicleCount || 1} 辆无人车；数量不足只提醒，不阻断。</small></div><label>给用户的说明<textarea maxLength={500} value={form.userNote} onChange={event => set('userNote', event.target.value)} /></label></> : <><div className="reason-options">{REJECTION_REASONS.map(reason => <button key={reason} className={form.rejectionReason === reason ? 'active' : ''} onClick={() => set('rejectionReason', reason)}>{reason}</button>)}</div><label>拒绝原因（用户可见）<textarea required maxLength={500} value={form.rejectionReason} onChange={event => set('rejectionReason', event.target.value)} placeholder="选择常用原因，或输入其他原因" /></label></>}<label>内部备注（用户不可见）<textarea maxLength={1000} value={form.internalNote} onChange={event => set('internalNote', event.target.value)} /></label>{error && <div className="alert error">{error}</div>}<div className="modal-actions"><button onClick={close}>取消</button><button className={mode === 'reject' ? 'danger' : 'primary'} onClick={() => void submit()} disabled={loading}>{loading ? '提交中…' : mode === 'approve' ? '批准并预占车辆' : '确认拒绝'}</button></div></div></div>
}

function TransitionModal({ order, target, close, done }: { order: OrderDetailData; target: 'dispatching' | 'delivering' | 'completed'; close: () => void; done: () => void }) {
  const [note, setNote] = useState(''), [vehicleCount, setVehicleCount] = useState(String(order.reserved_vehicle_count || 1)), [vehiclePlate, setVehiclePlate] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(false)
  const submit = async () => { if (target === 'dispatching' && (!Number.isInteger(Number(vehicleCount)) || Number(vehicleCount) < 1)) return setError('请填写本次实际派出的车辆数量'); if (target === 'completed' && !note.trim()) return setError('请填写完成说明'); setLoading(true); try { await api(`/orders/${order.id}/status`, { method: 'POST', body: JSON.stringify({ status: target, note, vehicleCount: target === 'dispatching' ? Number(vehicleCount) : undefined, vehiclePlate: target === 'dispatching' ? vehiclePlate : undefined }) }); done() } catch (reason) { setError(messageOf(reason)) } finally { setLoading(false) } }
  const title = target === 'dispatching' ? '确认已安排无人车' : target === 'delivering' ? '确认开始配送' : '确认完成订单'
  return <div className="modal-bg"><div className="modal compact-modal"><div className="modal-title"><div><small className="mono">{order.order_no}</small><h2>{title}</h2></div><button className="icon-close" onClick={close} aria-label="关闭">×</button></div>{target === 'dispatching' && <div className="dispatch-fields"><label>实际派车数量<input type="number" min="1" step="1" value={vehicleCount} onChange={event => setVehicleCount(event.target.value)} /></label><label>车牌（选填）<input maxLength={32} value={vehiclePlate} onChange={event => setVehiclePlate(event.target.value)} placeholder="例如 沪A·12345" /></label></div>}<label>{target === 'completed' ? '完成说明' : '内部调度备注'}<textarea value={note} onChange={event => setNote(event.target.value)} placeholder={target === 'dispatching' ? '记录线下安排情况和预计时间' : target === 'completed' ? '记录送达结果；当前不要求上传图片' : '记录本次状态更新说明'} /></label>{error && <div className="alert error">{error}</div>}<div className="modal-actions"><button onClick={close}>取消</button><button className="primary" onClick={() => void submit()} disabled={loading}>{loading ? '提交中…' : title}</button></div></div></div>
}

function Reviews() {
  const [data, setData] = useState<Page<ReviewRecord>>(), [result, setResult] = useState(''), [page, setPage] = useState(1)
  useEffect(() => { void api<Page<ReviewRecord>>(`/reviews?result=${result}&page=${page}&pageSize=20`).then(setData) }, [result, page])
  return <Panel title="审核记录" action={<select value={result} onChange={event => { setResult(event.target.value); setPage(1) }}><option value="">全部结果</option><option value="approved">已批准</option><option value="rejected">已拒绝</option></select>}>{!data ? <Loading /> : data.items.length ? <><div className="table-wrap"><table><thead><tr><th>订单编号</th><th>审核结果</th><th>审核人</th><th>审核时间</th><th>报价金额</th><th>拒绝原因</th><th /></tr></thead><tbody>{data.items.map(record => <tr key={record.id}><td className="mono">{record.orderNo}</td><td>{record.action === 'order.approve' ? '批准' : '拒绝'}</td><td>{record.reviewer}</td><td>{dateTime(record.created_at)}</td><td>{money(record.totalCents)}</td><td>{record.rejectionReason || '—'}</td><td><button className="link" onClick={() => go(`/orders/${record.orderId}`)}>查看</button></td></tr>)}</tbody></table></div><Pager page={data.page} pages={data.totalPages} setPage={setPage} /></> : <Empty text="暂无审核记录" />}</Panel>
}

function Notifications({ changed }: { changed: () => void }) {
  const [data, setData] = useState<NotificationPage>(), [unreadOnly, setUnreadOnly] = useState(false), [error, setError] = useState('')
  const load = useCallback(() => api<NotificationPage>(`/notifications?page=1&pageSize=50&unreadOnly=${unreadOnly}`).then(setData).catch(reason => setError(messageOf(reason))), [unreadOnly])
  useEffect(() => { void load() }, [load])
  const read = async (notification: AdminNotification) => { if (!notification.readAt) await api(`/notifications/${notification.id}/read`, { method: 'PUT' }); if (notification.targetPath) go(notification.targetPath); else await load() }
  const readAll = async () => { await api('/notifications/read-all', { method: 'PUT' }); changed(); await load() }
  return <Panel title={`通知中心${data ? ` · ${data.unreadCount} 条未读` : ''}`} action={<div className="panel-actions"><label className="check-label"><input type="checkbox" checked={unreadOnly} onChange={event => setUnreadOnly(event.target.checked)} />只看未读</label><button onClick={() => void readAll()}>全部已读</button></div>}>{error ? <ErrorState text={error} /> : !data ? <Loading /> : data.items.length ? <div className="notification-list">{data.items.map(notification => <button key={notification.id} className={notification.readAt ? 'read' : ''} onClick={() => void read(notification)}><i /><div><b>{notification.title}</b><p>{notification.content}</p><small>{dateTime(notification.createdAt)}</small></div><span>{notification.readAt ? '已读' : '待处理'}</span></button>)}</div> : <Empty text="目前没有通知" />}</Panel>
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) { return <section className="panel"><div className="panel-title"><h2>{title}</h2>{action}</div>{children}</section> }
function Status({ value }: { value: string }) { return <span className={`status ${value}`}>{STATUS_LABELS[value] || value}</span> }
function Info({ rows }: { rows: Array<[string, string]> }) { return <dl className="info">{rows.map(row => <div key={row[0]}><dt>{row[0]}</dt><dd>{row[1]}</dd></div>)}</dl> }
function Address({ title, value }: { title: string; value?: OrderAddress }) { const addressText = [value?.province, value?.city, value?.district, value?.poi_name, value?.formatted_address, value?.detail_address].filter(Boolean).join(' '); return <div className="address"><div><b>{title} · {value?.contact_name || '—'} {value?.phone || ''}</b><CopyButton text={addressText} label="复制地址" /></div><span>{[value?.province, value?.city, value?.district, value?.poi_name].filter(Boolean).join(' ')}</span><small>{value?.formatted_address} {value?.detail_address}</small></div> }
function CopyButton({ text, label = '复制' }: { text: string; label?: string }) { const [copied, setCopied] = useState(false); const copy = async () => { if (!text) return; await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1500) }; return <button className="copy-button" onClick={() => void copy()} disabled={!text}>{copied ? '已复制' : label}</button> }
function OrderFlow({ status }: { status: string }) { const steps = ['下单', '审核', '支付', '配车', '配送', '完成']; const index = status === 'pending_review' ? 1 : status === 'rejected' ? 1 : ['pending_payment', 'quote_expired'].includes(status) ? 2 : status === 'paid' ? 3 : status === 'dispatching' ? 4 : status === 'delivering' ? 4 : status === 'completed' ? 5 : 0; return <section className={`order-flow ${status === 'rejected' ? 'stopped' : ''}`}>{steps.map((step, stepIndex) => <div key={step} className={stepIndex < index || status === 'completed' ? 'done' : stepIndex === index ? 'active' : ''}><i>{stepIndex + 1}</i><span>{step}</span></div>)}</section> }
function estimateRouteDistance(addresses: OrderAddress[]) { const sender = addresses.find(address => address.role === 'sender'), receiver = addresses.find(address => address.role === 'receiver'); const lat1 = Number(sender?.latitude), lat2 = Number(receiver?.latitude), lng1 = Number(sender?.longitude), lng2 = Number(receiver?.longitude); if (![lat1, lat2, lng1, lng2].every(Number.isFinite) || (lat1 === 0 && lng1 === 0) || (lat2 === 0 && lng2 === 0)) return 0; const radians = (value: number) => value * Math.PI / 180; const dLat = radians(lat2 - lat1), dLng = radians(lng2 - lng1); const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2; const directMeters = 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return Math.round(directMeters * 1.25 / 100) * 100 }
function Pager({ page, pages, setPage }: { page: number; pages: number; setPage: (page: number) => void }) { return <div className="pager"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button><span>第 {page} / {Math.max(1, pages)} 页</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>下一页</button></div> }
function Loading() { return <FullState text="正在加载运营数据…" /> }
function Empty({ text }: { text: string }) { return <div className="empty"><b>暂无数据</b><span>{text}</span></div> }
function ErrorState({ text }: { text: string }) { return <div className="empty error"><b>加载失败</b><span>{text}</span></div> }
function FullState({ text }: { text: string }) { return <div className="full-state"><span /><p>{text}</p></div> }
