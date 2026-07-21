import { useCallback, useEffect, useState } from 'react'
import { ApiError, api, dateTime } from './api'
import type { Page, Role } from './types'

type WechatUser = {
  id: string
  nickname: string
  openid: string
  status: string
  lastLoginAt: string
  bindingId?: string
  role?: Role | 'finance'
  adminStatus?: string
}

const labels: Record<Role, string> = { super_admin: '超级管理员', operator: '运营' }
const normalizedRole = (role?: WechatUser['role']): Role => role === 'super_admin' ? 'super_admin' : 'operator'

export default function WechatAdmins() {
  const [data, setData] = useState<Page<WechatUser>>()
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const load = useCallback(async () => {
    setError('')
    try { setData(await api(`/wechat-users?page=${page}&pageSize=20&keyword=${encodeURIComponent(keyword)}`)) }
    catch (reason) { setError(reason instanceof ApiError && reason.status === 403 ? '仅超级管理员可以管理微信授权' : (reason as Error).message) }
  }, [keyword, page])
  useEffect(() => { void load() }, [load])

  const grant = async (id: string) => {
    setBusy(id)
    try { await api('/wechat-bindings', { method: 'POST', body: JSON.stringify({ userId: id, role: 'operator' }) }); await load() }
    catch (reason) { setError((reason as Error).message) }
    finally { setBusy('') }
  }
  const update = async (row: WechatUser, role: Role) => {
    if (!row.bindingId) return
    setBusy(row.id)
    try { await api(`/wechat-bindings/${row.bindingId}`, { method: 'PATCH', body: JSON.stringify({ role, status: row.adminStatus || 'active' }) }); await load() }
    catch (reason) { setError((reason as Error).message) }
    finally { setBusy('') }
  }
  const revoke = async (row: WechatUser) => {
    if (!row.bindingId || !confirm(`确认撤销“${row.nickname || row.id}”的管理员权限？`)) return
    setBusy(row.id)
    try { await api(`/wechat-bindings/${row.bindingId}`, { method: 'DELETE' }); await load() }
    catch (reason) { setError((reason as Error).message) }
    finally { setBusy('') }
  }

  return <div className="admin-auth-page">
    <section className="role-guide">
      <article className="role-card super-role"><span>01</span><div><h2>超级管理员</h2><p>拥有全部管理权限：订单履约、咨询跟进、车型与数量、首页轮播、价格、联系方式和管理员授权。</p></div></article>
      <article className="role-card operator-role"><span>02</span><div><h2>运营</h2><p>负责订单审核、配车、配送完成、通知和包月/租购咨询；不能修改小程序运营配置，也不能授权管理员。</p></div></article>
    </section>
    <section className="panel admin-auth-panel">
      <div className="panel-title admin-auth-heading"><div><h2>微信管理员授权</h2><small>目标微信需先登录一次小程序；新授权默认设为运营</small></div><div className="admin-search"><input placeholder="昵称或用户 ID" value={keyword} onChange={event => setKeyword(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { setPage(1); void load() } }} /><button onClick={() => { setPage(1); void load() }}>查询</button></div></div>
      {error && <div className="alert error admin-auth-alert">{error}</div>}
      {!data ? <div className="full-state"><p>正在加载微信用户…</p></div> : data.items.length === 0 ? <div className="empty"><b>暂无用户</b><span>请先让目标微信登录小程序</span></div> : <div className="table-wrap admin-auth-table"><table><thead><tr><th>微信用户</th><th>内部用户 ID</th><th>OpenID</th><th>最近登录</th><th>角色</th><th>操作</th></tr></thead><tbody>{data.items.map(row => <tr key={row.id}><td><div className="wechat-user"><span>{(row.nickname || '微').slice(0, 1)}</span><div><b>{row.nickname || '微信用户'}</b><small>{row.status === 'active' ? '账号正常' : row.status}</small></div></div></td><td><code>{row.id}</code></td><td><code>{row.openid || '—'}</code></td><td>{dateTime(row.lastLoginAt)}</td><td>{row.bindingId ? <select className="role-select" value={normalizedRole(row.role)} disabled={busy === row.id} onChange={event => void update(row, event.target.value as Role)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : <span className="unbound-role">未授权</span>}</td><td>{row.bindingId ? <button className="danger auth-action" disabled={busy === row.id} onClick={() => void revoke(row)}>撤销授权</button> : <button className="primary auth-action" disabled={busy === row.id} onClick={() => void grant(row.id)}>授权为运营</button>}</td></tr>)}</tbody></table></div>}
      {data && data.totalPages > 1 && <div className="pager"><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>上一页</button><span>第 {page} / {data.totalPages} 页</span><button disabled={page >= data.totalPages} onClick={() => setPage(value => value + 1)}>下一页</button></div>}
    </section>
  </div>
}
