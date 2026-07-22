import { useCallback, useEffect, useState } from 'react'
import { ApiError, api, dateTime } from './api'
import { useFeedback } from './feedback'
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
type WebAccount = { id: string; username: string; role: Role; status: string; created_at: string; updated_at?: string }

export default function WechatAdmins() {
  const { alert, confirm, toast } = useFeedback()
  const [channel, setChannel] = useState<'wechat' | 'web'>('wechat')
  const [data, setData] = useState<Page<WechatUser>>()
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [webAccounts, setWebAccounts] = useState<WebAccount[]>([])
  const [webForm, setWebForm] = useState({ username: '', password: '' })
  const [webModal, setWebModal] = useState(false)
  const [passwordTarget, setPasswordTarget] = useState<WebAccount>()
  const [newPassword, setNewPassword] = useState('')
  const load = useCallback(async () => {
    setError('')
    try { setData(await api(`/wechat-users?page=${page}&pageSize=20&keyword=${encodeURIComponent(keyword)}`)) }
    catch (reason) { setError(reason instanceof ApiError && reason.status === 403 ? '仅超级管理员可以管理微信授权' : (reason as Error).message) }
  }, [keyword, page])
  useEffect(() => { void load() }, [load])
  const loadWeb = useCallback(async () => { try { setWebAccounts(await api<WebAccount[]>('/web-accounts')) } catch (reason) { setError((reason as Error).message) } }, [])
  useEffect(() => { if (channel === 'web') void loadWeb() }, [channel, loadWeb])

  const createWeb = async () => {
    if (!/^[A-Za-z0-9._-]{4,32}$/.test(webForm.username) || webForm.password.length < 8) return void alert({ title: '账号信息不完整', message: '用户名需为 4-32 位字母、数字、点、下划线或短横线，密码至少 8 位。', danger: true })
    setBusy('web-create')
    try { await api('/web-accounts', { method: 'POST', body: JSON.stringify(webForm) }); setWebModal(false); setWebForm({ username: '', password: '' }); await loadWeb(); toast('Web 运营账号创建成功', 'success') } catch (reason) { await alert({ title: '创建失败', message: (reason as Error).message, danger: true }) } finally { setBusy('') }
  }
  const deleteWeb = async (account: WebAccount) => {
    if (!await confirm({ title: '删除运营账号', message: `确认删除“${account.username}”？删除后该账号将无法登录，现有会话会立即退出。`, confirmLabel: '确认删除', danger: true })) return
    setBusy(account.id)
    try { await api(`/web-accounts/${account.id}`, { method: 'DELETE' }); await loadWeb(); toast('Web 运营账号已删除', 'success') } catch (reason) { await alert({ title: '删除失败', message: (reason as Error).message, danger: true }) } finally { setBusy('') }
  }
  const resetWebPassword = async () => {
    if (!passwordTarget || newPassword.length < 8) return void alert({ title: '密码不符合要求', message: '新密码至少 8 位。', danger: true })
    try { await api(`/web-accounts/${passwordTarget.id}/password`, { method: 'PUT', body: JSON.stringify({ password: newPassword }) }); setPasswordTarget(undefined); setNewPassword(''); toast('密码已重置，原会话已退出', 'success') } catch (reason) { await alert({ title: '重置失败', message: (reason as Error).message, danger: true }) }
  }

  const grant = async (id: string) => {
    setBusy(id)
    try { await api('/wechat-bindings', { method: 'POST', body: JSON.stringify({ userId: id, role: 'operator' }) }); await load() }
    catch (reason) { setError((reason as Error).message) }
    finally { setBusy('') }
  }
  const revoke = async (row: WechatUser) => {
    if (!row.bindingId || !await confirm({ title: '撤销管理员权限', message: `确认撤销“${row.nickname || row.id}”的管理员权限？`, confirmLabel: '确认撤销', danger: true })) return
    setBusy(row.id)
    try { await api(`/wechat-bindings/${row.bindingId}`, { method: 'DELETE' }); await load(); toast('管理员权限已撤销', 'success') }
    catch (reason) { setError((reason as Error).message) }
    finally { setBusy('') }
  }

  return <div className="admin-auth-page"><div className="admin-channel-tabs"><button className={channel === 'wechat' ? 'active' : ''} onClick={() => setChannel('wechat')}>微信管理员</button><button className={channel === 'web' ? 'active' : ''} onClick={() => setChannel('web')}>Web 运营账号</button></div>
    {channel === 'wechat' ? <>
    <section className="role-guide">
      <article className="role-card super-role"><span>01</span><div><h2>超级管理员</h2><p>拥有全部管理权限：订单履约、咨询跟进、车型与数量、首页轮播、价格、联系方式和管理员授权。</p></div></article>
      <article className="role-card operator-role"><span>02</span><div><h2>运营</h2><p>负责订单审核、配车、配送完成、通知和包月/租购咨询；不能修改小程序运营配置，也不能授权管理员。</p></div></article>
    </section>
    <section className="panel admin-auth-panel">
      <div className="panel-title admin-auth-heading"><div><h2>微信管理员授权</h2><small>目标微信需先登录一次小程序；新授权默认设为运营</small></div><div className="admin-search"><input placeholder="昵称或用户 ID" value={keyword} onChange={event => setKeyword(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { setPage(1); void load() } }} /><button onClick={() => { setPage(1); void load() }}>查询</button></div></div>
      {error && <div className="alert error admin-auth-alert">{error}</div>}
      {!data ? <div className="full-state"><p>正在加载微信用户…</p></div> : data.items.length === 0 ? <div className="empty"><b>暂无用户</b><span>请先让目标微信登录小程序</span></div> : <div className="table-wrap admin-auth-table"><table><thead><tr><th>微信用户</th><th>内部用户 ID</th><th>OpenID</th><th>最近登录</th><th>角色</th><th>操作</th></tr></thead><tbody>{data.items.map(row => <tr key={row.id}><td><div className="wechat-user"><span>{(row.nickname || '微').slice(0, 1)}</span><div><b>{row.nickname || '微信用户'}</b><small>{row.status === 'active' ? '账号正常' : row.status}</small></div></div></td><td><code>{row.id}</code></td><td><code>{row.openid || '—'}</code></td><td>{dateTime(row.lastLoginAt)}</td><td>{row.bindingId ? <span className={row.role === 'super_admin' ? 'status completed' : 'unbound-role'}>{row.role === 'super_admin' ? '系统管理员' : '运营'}</span> : <span className="unbound-role">未授权</span>}</td><td>{row.bindingId ? row.role === 'super_admin' ? <span className="unbound-role">不可删除</span> : <button className="danger auth-action" disabled={busy === row.id} onClick={() => void revoke(row)}>删除授权</button> : <button className="primary auth-action" disabled={busy === row.id} onClick={() => void grant(row.id)}>添加为运营</button>}</td></tr>)}</tbody></table></div>}
      {data && data.totalPages > 1 && <div className="pager"><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>上一页</button><span>第 {page} / {data.totalPages} 页</span><button disabled={page >= data.totalPages} onClick={() => setPage(value => value + 1)}>下一页</button></div>}
    </section></> : <section className="panel admin-auth-panel">
      <div className="panel-title admin-auth-heading"><div><h2>Web 运营账号</h2><small>新增账号固定为运营角色</small></div><button className="primary admin-create-button" onClick={() => setWebModal(true)}>新增账号</button></div>
      {error && <div className="alert error admin-auth-alert">{error}</div>}
      <div className="table-wrap admin-auth-table web-account-table"><table><colgroup><col /><col /><col /><col /><col /></colgroup><thead><tr><th>用户名</th><th>角色</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>{webAccounts.map(account => <tr key={account.id}><td><code title={account.username}>{account.username}</code></td><td>运营</td><td><span className={`status ${account.status === 'active' ? 'completed' : 'cancelled'}`}>{account.status === 'active' ? '正常' : '不可登录'}</span></td><td>{dateTime(account.created_at)}</td><td><div className="account-actions"><button className="danger account-delete-button" disabled={busy === account.id} onClick={() => void deleteWeb(account)}>删除</button></div></td></tr>)}</tbody></table></div>
      {!webAccounts.length && <div className="empty"><b>暂无 Web 运营账号</b><span>点击右上角创建首个账号</span></div>}
    </section>}
    {webModal && <div className="modal-bg" onMouseDown={() => setWebModal(false)}><section className="modal compact-modal" onMouseDown={event => event.stopPropagation()}><div className="modal-title"><h2>新增 Web 运营账号</h2><button className="plain-close" aria-label="关闭新增账号窗口" onClick={() => setWebModal(false)}>×</button></div><label>用户名<input value={webForm.username} onChange={event => setWebForm(current => ({ ...current, username: event.target.value }))} placeholder="4-32 位字母或数字" /></label><label>初始密码<input type="password" value={webForm.password} onChange={event => setWebForm(current => ({ ...current, password: event.target.value }))} placeholder="至少 8 位" /></label><div className="modal-actions"><button onClick={() => setWebModal(false)}>取消</button><button className="primary" disabled={busy === 'web-create'} onClick={() => void createWeb()}>创建账号</button></div></section></div>}
    {passwordTarget && <div className="modal-bg" onMouseDown={() => setPasswordTarget(undefined)}><section className="modal compact-modal password-reset-modal" onMouseDown={event => event.stopPropagation()}>
      <div className="modal-title"><div><small>账号安全</small><h2>重置登录密码</h2></div><button className="plain-close" aria-label="关闭重置密码窗口" onClick={() => setPasswordTarget(undefined)}>×</button></div>
      <div className="password-account-card"><span>目标账号</span><strong>{passwordTarget.username}</strong><small>重置后该账号的原登录会话将立即退出</small></div>
      <label className="password-reset-field">设置新密码<input type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="请输入至少 8 位新密码" /><small>建议同时包含字母、数字和符号</small></label>
      <div className="modal-actions password-reset-actions"><button className="admin-modal-cancel" onClick={() => setPasswordTarget(undefined)}>暂不重置</button><button className="primary password-reset-submit" onClick={() => void resetWebPassword()}>确认重置密码</button></div>
    </section></div>}
  </div>
}
