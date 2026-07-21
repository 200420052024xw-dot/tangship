import { useEffect, useMemo, useState } from 'react'
import { ApiError, api, money, uploadAsset } from './api'
import type { AnyRecord } from './types'
import VehicleSettings from './VehicleSettings'

type RuntimeInfo = { dataMode: 'sqlite' | 'supabase'; capabilities: { assetUpload: boolean }; localOnly: boolean }
function useRuntime() { const [runtime, setRuntime] = useState<RuntimeInfo>(); useEffect(() => { void api<RuntimeInfo>('/runtime').then(setRuntime) }, []); return runtime }

function Banners() {
  const runtime = useRuntime()
  const [list, setList] = useState<AnyRecord[]>([]), [selected, setSelected] = useState<AnyRecord>(), [previewUrl, setPreviewUrl] = useState(''), [fileName, setFileName] = useState(''), [error, setError] = useState(''), [saving, setSaving] = useState(false)
  const load = async () => { try { setList(await api('/operations/banners')) } catch (e) { setError((e as Error).message) } }
  useEffect(() => { void load() }, [])
  const patchSelected = (patch: AnyRecord) => {
    const selectedId = selected?.id
    if (!selectedId) return
    setSelected(current => current ? { ...current, ...patch } : current)
    setList(rows => rows.map(row => row.id === selectedId ? { ...row, ...patch } : row))
  }
  const select = (row: AnyRecord) => { setSelected(row); setPreviewUrl(''); setFileName(''); setError('') }
  const create = () => {
    const draft = { id: `banner-${Date.now()}`, title: '', imageUrl: '', objectKey: '', linkType: 'service', linkTarget: '', sortOrder: list.length, enabled: true }
    setList(rows => [...rows, draft]); setSelected(draft); setPreviewUrl(''); setFileName(''); setError('')
  }
  const upload = async (file?: File) => {
    if (!file) return
    setError('')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setPreviewUrl(String(reader.result || ''))
    reader.readAsDataURL(file)
    if (!runtime?.capabilities.assetUpload) return setError('图片已在本页预览；本地 SQLite 不会上传或保存图片，部署到 TOS 环境后即可持久化')
    try { const asset = await uploadAsset(file); patchSelected({ imageUrl: asset.url, objectKey: asset.objectKey }); setPreviewUrl('') } catch (e) { setError((e as Error).message) }
  }
  const save = async () => {
    if (!selected) return
    if (!selected.title?.trim()) return setError('请填写轮播标题')
    if (!selected.imageUrl) return setError(runtime?.capabilities.assetUpload ? '请先上传轮播图片' : '本地预览图片不会持久化，请在部署后的 TOS 环境上传并保存')
    setSaving(true); setError('')
    try { const saved = await api<AnyRecord>(`/operations/banners/${selected.id}`, { method: 'PUT', body: JSON.stringify(selected) }); await load(); setSelected(saved) } catch (e) { setError((e as Error).message) } finally { setSaving(false) }
  }
  const selectedImage = previewUrl || selected?.imageUrl || ''
  return <section className="ops-grid banner-workbench"><div className="panel"><div className="panel-title"><div><h2>首页轮播</h2><small>左侧内容与编辑区实时同步</small></div><button onClick={create}>新增轮播</button></div><div className="ops-list banner-list">{list.map(row => { const imageUrl = row.id === selected?.id ? selectedImage : row.imageUrl; const title = row.id === selected?.id ? selected?.title : row.title; return <button key={row.id} className={selected?.id === row.id ? 'active' : ''} onClick={() => select(row)}>{imageUrl ? <img src={imageUrl} alt="" /> : <span className="banner-list-empty">待上传图片</span>}<span className="banner-list-copy"><b>{title || '未命名轮播'}</b><small>{row.enabled ? '展示中' : '已停用'}</small></span></button> })}</div></div><div className="panel ops-editor">{selected ? <><div className="panel-title"><div><h2>编辑轮播</h2><small>上传图片后可立即查看实际展示效果</small></div><button className="primary banner-save" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存轮播'}</button></div><div className="ops-form banner-form"><div className="wide banner-upload"><span className="banner-field-label">轮播图片</span><div className="banner-upload-controls"><label className="banner-file-button">选择轮播图片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => void upload(e.target.files?.[0])} /></label><small>{fileName || '支持 JPG、PNG、WebP，单张不超过 5MB'}</small></div>{selectedImage ? <img className="banner-preview" src={selectedImage} alt="轮播预览" /> : <span className="banner-image-placeholder">建议上传清晰的横向图片</span>}</div><Field label="标题" value={selected.title} change={title => patchSelected({ title })} /><label>状态<select value={selected.enabled ? '1' : '0'} onChange={e => patchSelected({ enabled: e.target.value === '1' })}><option value="1">展示</option><option value="0">停用</option></select></label></div>{error && <div className="alert error banner-feedback">{error}</div>}</> : <div className="empty"><b>请选择轮播图</b><span>在左侧选择已有内容，或新增一张轮播图</span></div>}</div></section>
}

function Pricing() {
  const [state, setState] = useState<AnyRecord>(), [config, setConfig] = useState<AnyRecord>(), [preview, setPreview] = useState<AnyRecord>(), [error, setError] = useState('')
  const fields = useMemo(() => [['baseDistanceMeters', '起步里程（米）'], ['baseFeeCents', '起步费（元）'], ['distanceFeePerKmCents', '超出里程单价（元/公里）'], ['coldChainFeeCents', '冷链附加费（元）'], ['overweightThresholdKg', '超重阈值（kg）'], ['overweightFeePerKgCents', '超重费（元/kg）'], ['nightFeeCents', '夜间费（元）'], ['remoteAreaFeeCents', '偏远地区费（元）'], ['defaultQuoteValidityHours', '报价有效小时']], [])
  const load = async () => { const value = await api<AnyRecord>('/operations/pricing'); setState(value); setConfig(pricingToYuan(value.draft?.config ?? value.published?.config ?? value.defaults)) }
  useEffect(() => { void load().catch(e => setError(e.message)) }, [])
  const save = async () => { if (!config) return; try { setState(await api('/operations/pricing/draft', { method: 'PUT', body: JSON.stringify({ config: pricingToCents(config), expectedVersion: state?.draft?.version }) })) } catch (e) { setError((e as Error).message) } }
  const publish = async () => { try { if (!state?.draft) throw new Error('请先保存草稿'); const value = await api<AnyRecord>('/operations/pricing/publish', { method: 'POST', body: JSON.stringify({ expectedVersion: state.draft.version }) }); setState(value); setConfig(pricingToYuan(value.published.config)) } catch (e) { setError(e instanceof ApiError && e.status === 409 ? '草稿已被其他管理员修改，请刷新' : (e as Error).message) } }
  const simulate = async () => { try { setPreview(await api('/operations/pricing/preview', { method: 'POST', body: JSON.stringify({ useDraft: true, input: { vehicleId: 'z5-2026', distanceMeters: 12000, weightKg: 450 } }) })) } catch (e) { setError((e as Error).message) } }
  if (!config) return <div className="full-state"><p>加载计费规则…</p></div>
  return <section className="panel ops-editor"><div className="panel-title"><div><h2>计费规则草稿</h2><small>页面金额统一按元填写 · 已发布版本：{state?.published?.version ?? '无'} · 草稿版本：{state?.draft?.version ?? '未创建'}</small></div><div><button onClick={() => void simulate()}>预览建议价</button><button onClick={() => void save()}>保存草稿</button><button className="primary" onClick={() => void publish()}>发布</button></div></div><div className="ops-form pricing-form">{fields.map(([key, label]) => <Field key={key} label={label} type="number" step={MONEY_FIELDS.has(key) ? '0.01' : '1'} value={config[key]} change={value => setConfig({ ...config, [key]: +value })} />)}</div>{preview && <div className="total"><span>示例订单建议价</span><strong>{money(preview.totalCents)}</strong><small>基础 {money(preview.baseFeeCents)} · 距离 {money(preview.distanceFeeCents)} · 车型 {money(preview.vehicleFeeCents)} · 服务 {money(preview.serviceFeeCents)}</small></div>}{error && <div className="alert error">{error}</div>}</section>
}

const MONEY_FIELDS = new Set(['baseFeeCents', 'distanceFeePerKmCents', 'coldChainFeeCents', 'overweightFeePerKgCents', 'nightFeeCents', 'remoteAreaFeeCents'])
function pricingToYuan(config: AnyRecord) { return Object.fromEntries(Object.entries(config || {}).map(([key, value]) => [key, MONEY_FIELDS.has(key) ? Number(value || 0) / 100 : value])) }
function pricingToCents(config: AnyRecord) { return Object.fromEntries(Object.entries(config || {}).map(([key, value]) => [key, MONEY_FIELDS.has(key) ? Math.round(Number(value || 0) * 100) : value])) }

function Inquiries({ inquiryType }: { inquiryType?: 'monthly' | 'rental' }) {
  const [list, setList] = useState<AnyRecord[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(false), [statusFilter, setStatusFilter] = useState(''), [selected, setSelected] = useState<AnyRecord>()
  const load = async () => { setLoading(true); try { const query = new URLSearchParams({ page: '1', pageSize: '100', ...(inquiryType ? { type: inquiryType } : {}) }); const page = await api<{ items: AnyRecord[] }>(`/operations/inquiries?${query}`); setList(page.items) } catch (e) { setError((e as Error).message) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => list.filter(v => !statusFilter || v.status === statusFilter), [list, statusFilter])
  const updateStatus = async (id: string, status: string, note?: string) => { try { await api(`/operations/inquiries/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, note }) }); await load(); setSelected(undefined) } catch (e) { setError((e as Error).message) } }
  const typeLabels: Record<string, string> = { monthly: '包月专线', rental: '租购服务' }
  const statusLabels: Record<string, string> = { pending: '待处理', contacted: '已联系', closed: '已关闭' }
  return <section className="ops-grid inquiry-grid"><div className="panel"><div className="panel-title"><div><h2>{typeLabels[inquiryType || 'monthly']}咨询记录</h2><small>按提交时间倒序</small></div><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">全部状态</option><option value="pending">待处理</option><option value="contacted">已联系</option><option value="closed">已关闭</option></select></div>{loading ? <div className="full-state"><p>加载中…</p></div> : <div className="ops-list inquiry-list">{filtered.map(row => <button key={row.id} className={selected?.id === row.id ? 'active' : ''} onClick={() => setSelected(row)}><b>{row.companyName || row.contactName}</b><span>{row.companyName ? `${row.contactName} · ${row.phone}` : row.phone}</span><small>{statusLabels[row.status] || row.status} · {new Date(row.createdAt).toLocaleDateString('zh-CN')}</small></button>)}</div>}</div><div className="panel ops-editor inquiry-detail">{selected ? <><div className="panel-title inquiry-heading"><div><small>{typeLabels[selected.type] || selected.type}</small><h2>{selected.companyName ? `${selected.companyName} · ${selected.contactName}` : selected.contactName}</h2></div><div><button onClick={() => void updateStatus(selected.id, 'contacted')}>标记已联系</button><button onClick={() => void updateStatus(selected.id, 'closed')}>关闭</button></div></div><div className="inquiry-contact"><div><small>联系电话</small><strong>{selected.phone}</strong></div><CopyPhoneButton phone={selected.phone} /></div><div className="inquiry-facts"><InquiryFact label="公司名称" value={selected.companyName || '未填写'} /><InquiryFact label="意向车型" value={displayVehicleModel(selected.vehicleId)} /><InquiryFact label="提交时间" value={new Date(selected.createdAt).toLocaleString('zh-CN')} />{selected.type === 'monthly' && <><InquiryFact label="发货地址" value={formatInquiryAddress(selected.senderAddress)} wide /><InquiryFact label="收货地址" value={formatInquiryAddress(selected.receiverAddress)} wide /><InquiryFact label="货物类型" value={selected.cargoType || '未填写'} /><InquiryFact label="配送周期" value={selected.deliveryCycle || '未填写'} /><InquiryFact label="每月预计次数" value={selected.monthlyTrips ? `${selected.monthlyTrips} 次` : '未填写'} /></>}{selected.type === 'rental' && <InquiryFact label="咨询内容" value={selected.consultContent || '未填写'} wide />}{selected.note && <InquiryFact label="跟进备注" value={selected.note} wide />}</div>{error && <div className="alert error">{error}</div>}</> : <div className="empty"><b>请选择咨询记录</b><span>左侧选择一位客户查看完整需求</span></div>}</div></section>
}

function InquiryFact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={wide ? 'wide' : ''}><small>{label}</small><strong>{value}</strong></div> }
function displayVehicleModel(value: unknown) { const model = String(value || '').replace(/-(monthly|rental)$/i, ''); return model ? model.toUpperCase() : '未选择' }
function formatInquiryAddress(value: unknown) { if (!value) return '未填写'; if (typeof value === 'string') return value; if (typeof value === 'object' && 'address' in value) return String((value as { address?: unknown }).address || '未填写'); return '未填写' }
function CopyPhoneButton({ phone }: { phone: string }) { const [copied, setCopied] = useState(false); const copy = async () => { await navigator.clipboard.writeText(phone); setCopied(true); window.setTimeout(() => setCopied(false), 1500) }; return <button className="copy-phone" onClick={() => void copy()}>{copied ? '已复制' : '复制电话'}</button> }

function ContactSettings() {
  const [data, setData] = useState<AnyRecord>(), [error, setError] = useState(''), [saving, setSaving] = useState(false)
  const load = async () => { try { const value = await api<AnyRecord | null>('/operations/contact'); setData(value ?? {}) } catch (e) { setError((e as Error).message) } }
  useEffect(() => { void load() }, [])
  const save = async () => { if (!data) return; setSaving(true); try { await api('/operations/contact', { method: 'PUT', body: JSON.stringify(data) }); await load() } catch (e) { setError((e as Error).message) } finally { setSaving(false) } }
  if (!data) return <div className="full-state"><p>加载中…</p></div>
  return <section className="panel ops-editor"><div className="panel-title"><div><h2>联系方式</h2><small>用于小程序内的客服与业务联系入口</small></div><button className="primary" disabled={saving} onClick={save}>{saving ? '保存中…' : '保存'}</button></div><div className="ops-form"><Field label="客服电话" value={data.phone ?? ''} change={phone => setData({ ...data, phone })} /><Field label="微信号" value={data.wechat ?? ''} change={wechat => setData({ ...data, wechat })} /><Field label="邮箱" value={data.email ?? ''} change={email => setData({ ...data, email })} /><Field label="工作时间" value={data.workTime ?? ''} change={workTime => setData({ ...data, workTime })} /></div>{error && <div className="alert error">{error}</div>}</section>
}

function Field({ label, value, change, type = 'text', step }: { label: string; value: string | number | undefined; change: (value: string) => void; type?: string; step?: string }) { return <label>{label}<input type={type} min={type === 'number' ? 0 : undefined} step={step} value={value ?? ''} onChange={e => change(e.target.value)} readOnly={change.toString() === '(() => {  })'} /></label> }

export type OperationsSection = 'vehicles' | 'banners' | 'pricing' | 'inquiries' | 'contact'
export default function OperationsSettings({ section, inquiryType }: { section: OperationsSection; inquiryType?: 'monthly' | 'rental' }) { const runtime = useRuntime(); return <>{runtime?.localOnly && <div className="alert">本地 SQLite 演示模式：数据可随时重置，图片上传需在线上 TOS 环境联调。</div>}{section === 'vehicles' ? <VehicleSettings assetUploadEnabled={runtime?.capabilities.assetUpload ?? false} /> : section === 'banners' ? <Banners /> : section === 'pricing' ? <Pricing /> : section === 'inquiries' ? <Inquiries inquiryType={inquiryType} /> : <ContactSettings />}</> }
