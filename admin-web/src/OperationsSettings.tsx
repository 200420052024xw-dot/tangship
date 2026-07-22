import { useEffect, useMemo, useState } from 'react'
import { ApiError, api, money, uploadAsset } from './api'
import type { AnyRecord } from './types'
import VehicleSettings from './VehicleSettings'
import { useFeedback } from './feedback'

type RuntimeInfo = { dataMode: 'supabase'; capabilities: { assetUpload: boolean } }
function useRuntime() { const [runtime, setRuntime] = useState<RuntimeInfo>(); useEffect(() => { void api<RuntimeInfo>('/runtime').then(setRuntime) }, []); return runtime }

function Banners() {
  const { toast } = useFeedback()
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
    if (!runtime?.capabilities.assetUpload) return setError('图片已在本页预览；请配置 TOS 后再上传并持久化图片')
    try { const asset = await uploadAsset(file); patchSelected({ imageUrl: asset.url, objectKey: asset.objectKey }); setPreviewUrl('') } catch (e) { setError((e as Error).message) }
  }
  const save = async () => {
    if (!selected) return
    if (!selected.title?.trim()) return setError('请填写轮播标题')
    if (!selected.imageUrl) return setError(runtime?.capabilities.assetUpload ? '请先上传轮播图片' : '本地预览图片不会持久化，请在部署后的 TOS 环境上传并保存')
    setSaving(true); setError('')
    try { const saved = await api<AnyRecord>(`/operations/banners/${selected.id}`, { method: 'PUT', body: JSON.stringify(selected) }); await load(); setSelected(saved); toast(`${selected.title}轮播保存成功`, 'success') } catch (e) { setError((e as Error).message); toast((e as Error).message, 'error') } finally { setSaving(false) }
  }
  const selectedImage = previewUrl || selected?.imageUrl || ''
  return <section className="ops-grid banner-workbench"><div className="panel"><div className="panel-title"><div><h2>首页轮播</h2><small>左侧内容与编辑区实时同步</small></div><button onClick={create}>新增轮播</button></div><div className="ops-list banner-list">{list.map(row => { const imageUrl = row.id === selected?.id ? selectedImage : row.imageUrl; const title = row.id === selected?.id ? selected?.title : row.title; return <button key={row.id} className={selected?.id === row.id ? 'active' : ''} onClick={() => select(row)}>{imageUrl ? <img src={imageUrl} alt="" /> : <span className="banner-list-empty">待上传图片</span>}<span className="banner-list-copy"><b>{title || '未命名轮播'}</b><small>{row.enabled ? '展示中' : '已停用'}</small></span></button> })}</div></div><div className="panel ops-editor">{selected ? <><div className="panel-title"><div><h2>编辑轮播</h2><small>上传图片后可立即查看实际展示效果</small></div><button className="primary banner-save" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存轮播'}</button></div><div className="ops-form banner-form"><div className="wide banner-upload"><span className="banner-field-label">轮播图片</span><div className="banner-upload-controls"><label className="banner-file-button">选择轮播图片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => void upload(e.target.files?.[0])} /></label><small>{fileName || '支持 JPG、PNG、WebP，单张不超过 5MB'}</small></div>{selectedImage ? <img className="banner-preview" src={selectedImage} alt="轮播预览" /> : <span className="banner-image-placeholder">建议上传清晰的横向图片</span>}</div><Field label="标题" value={selected.title} change={title => patchSelected({ title })} /><label>状态<select value={selected.enabled ? '1' : '0'} onChange={e => patchSelected({ enabled: e.target.value === '1' })}><option value="1">展示</option><option value="0">停用</option></select></label></div>{error && <div className="alert error banner-feedback">{error}</div>}</> : <div className="empty"><b>请选择轮播图</b><span>在左侧选择已有内容，或新增一张轮播图</span></div>}</div></section>
}

function Pricing() {
  const { confirm, toast } = useFeedback()
  const [state, setState] = useState<AnyRecord>(), [config, setConfig] = useState<AnyRecord>(), [preview, setPreview] = useState<AnyRecord>(), [error, setError] = useState('')
  const [vehicles, setVehicles] = useState<AnyRecord[]>([]), [editingVehicleId, setEditingVehicleId] = useState(''), [editingVehicleRule, setEditingVehicleRule] = useState<AnyRecord>(), [editingVehicleIsNew, setEditingVehicleIsNew] = useState(false), [addVehicleId, setAddVehicleId] = useState('')
  const [commonRulesOpen, setCommonRulesOpen] = useState(false)
  const fields = useMemo(() => [['baseDistanceMeters', '起步里程（米）'], ['baseFeeCents', '起步费（元）'], ['distanceFeePerKmCents', '超出里程单价（元/公里）'], ['coldChainFeeCents', '冷链附加费（元）'], ['overweightThresholdKg', '超重阈值（kg）'], ['overweightFeePerKgCents', '超重费（元/kg）'], ['nightFeeCents', '夜间费（元）'], ['remoteAreaFeeCents', '偏远地区费（元）'], ['defaultQuoteValidityHours', '报价有效小时']], [])
  const load = async () => {
    const [value, vehicleRows] = await Promise.all([api<AnyRecord>('/operations/pricing'), api<AnyRecord[]>('/operations/vehicles')])
    setState(value)
    setConfig(pricingToYuan(value.draft?.config ?? value.published?.config ?? value.defaults))
    setVehicles(vehicleRows.filter(vehicle => vehicle.serviceMode === 'single'))
  }
  useEffect(() => { void load().catch(e => setError(e.message)) }, [])
  const save = async () => { if (!config) return; try { setState(await api('/operations/pricing/draft', { method: 'PUT', body: JSON.stringify({ config: pricingToCents(config), expectedVersion: state?.draft?.version }) })); toast('计费草稿保存成功', 'success') } catch (e) { setError((e as Error).message); toast((e as Error).message, 'error') } }
  const publish = async () => { try { if (!state?.draft) throw new Error('请先保存草稿'); const value = await api<AnyRecord>('/operations/pricing/publish', { method: 'POST', body: JSON.stringify({ expectedVersion: state.draft.version }) }); setState(value); setConfig(pricingToYuan(value.published.config)); toast('计费规则发布成功', 'success') } catch (e) { const message = e instanceof ApiError && e.status === 409 ? '草稿已被其他管理员修改，请刷新' : (e as Error).message; setError(message); toast(message, 'error') } }
  useEffect(() => {
    if (!config) return
    const previewConfig = editingVehicleId && editingVehicleRule
      ? { ...config, vehicleRules: { ...(config.vehicleRules || {}), [editingVehicleId]: editingVehicleRule } }
      : config
    const timer = window.setTimeout(() => {
      void api<AnyRecord>('/operations/pricing/preview', {
        method: 'POST',
        body: JSON.stringify({ config: pricingToCents(previewConfig), input: { vehicleId: editingVehicleId || Object.keys(config.vehicleRules || {})[0] || vehicles[0]?.id || '', distanceMeters: 12000, weightKg: 450 } }),
      }).then(setPreview).catch(e => setError((e as Error).message))
    }, 280)
    return () => window.clearTimeout(timer)
  }, [config, editingVehicleId, editingVehicleRule, vehicles])
  const closeVehicleRule = () => {
    setEditingVehicleId('')
    setEditingVehicleRule(undefined)
    setEditingVehicleIsNew(false)
  }
  const addVehicleRule = () => {
    if (!addVehicleId || !config) return
    setEditingVehicleId(addVehicleId)
    setEditingVehicleRule({ ...Object.fromEntries(fields.map(([key]) => [key, config[key]])), nightStartHour: config.nightStartHour, nightEndHour: config.nightEndHour })
    setEditingVehicleIsNew(true)
    setAddVehicleId('')
  }
  const editVehicleRule = (vehicleId: string) => {
    setEditingVehicleId(vehicleId)
    setEditingVehicleRule({ ...(config?.vehicleRules?.[vehicleId] || {}) })
    setEditingVehicleIsNew(false)
  }
  const commitVehicleRule = () => {
    if (!config || !editingVehicleId || !editingVehicleRule) return
    setConfig({ ...config, vehicleRules: { ...(config.vehicleRules || {}), [editingVehicleId]: editingVehicleRule } })
    closeVehicleRule()
  }
  const removeVehicleRule = async (vehicleId: string) => {
    if (!config) return
    const vehicleName = vehicles.find(vehicle => vehicle.id === vehicleId)?.name || vehicleId.toUpperCase()
    if (!await confirm({
      title: '删除车型专属计费',
      message: `确认删除“${vehicleName}”的专属计费规则？删除后该车型将改用统一价格，保存草稿后生效。`,
      confirmLabel: '确认删除',
      danger: true,
    })) return
    const nextRules = { ...(config.vehicleRules || {}) }
    delete nextRules[vehicleId]
    setConfig({ ...config, vehicleRules: nextRules })
    if (editingVehicleId === vehicleId) closeVehicleRule()
    toast(`${vehicleName}专属计费已从当前草稿移除`, 'success')
  }
  const vehicleRule = editingVehicleRule
  if (!config) return <div className="full-state"><p>加载计费规则…</p></div>

  return <>
    <section className="panel ops-editor pricing-workbench">
      <div className="panel-title"><div><h2>通用计费规则</h2><small>页面金额统一按元填写 · 已发布版本：{state?.published?.version ?? '无'} · 草稿版本：{state?.draft?.version ?? '未创建'}</small></div><div className="pricing-actions"><button className="pricing-collapse-toggle" aria-expanded={commonRulesOpen} onClick={() => setCommonRulesOpen(value => !value)}>{commonRulesOpen ? '收起规则' : '展开规则'}</button><button onClick={() => void save()}>保存草稿</button><button className="primary" onClick={() => void publish()}>发布</button></div></div>
      {commonRulesOpen && <div className="common-pricing-content">
        <div className="ops-form pricing-form">{fields.map(([key, label]) => <Field key={key} label={label} type="number" step={MONEY_FIELDS.has(key) ? '0.01' : '1'} value={config[key]} change={value => setConfig({ ...config, [key]: +value })} />)}</div>
        {preview && <div className="total live-price-preview"><span>实时示例价 · 12 公里 / 450 kg</span><strong>{money(preview.totalCents)}</strong><small>基础 {money(preview.baseFeeCents)} · 距离 {money(preview.distanceFeeCents)} · 车型 {money(preview.vehicleFeeCents)} · 服务 {money(preview.serviceFeeCents)}</small></div>}
      </div>}
      <section className="vehicle-rule-section">
        <div className="panel-title"><div><h2>车型专属计费</h2><small>人工审核价优先于车型专属价，车型专属价优先于统一价格</small></div><div className="add-vehicle-rule"><select value={addVehicleId} onChange={event => setAddVehicleId(event.target.value)}><option value="">选择车型</option>{vehicles.filter(vehicle => !config.vehicleRules?.[vehicle.id]).map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.id.toUpperCase()}</option>)}</select><button onClick={addVehicleRule} disabled={!addVehicleId}>添加车型</button></div></div>
        <div className="vehicle-rule-list">{Object.keys(config.vehicleRules || {}).map(vehicleId => {
          const vehicle = vehicles.find(item => item.id === vehicleId)
          const rule = config.vehicleRules[vehicleId]
          const imageUrl = String(vehicle?.imageUrl || vehicle?.imageItems?.[0]?.url || '')
          return <article key={vehicleId} className="vehicle-rule-row">
            <button className="vehicle-rule-main" onClick={() => editVehicleRule(vehicleId)}>
              <span className="vehicle-rule-image">{imageUrl ? <img src={imageUrl} alt={vehicle?.name || vehicleId} /> : <b>{String(vehicle?.name || vehicleId).slice(0, 1)}</b>}</span>
              <span className="vehicle-rule-name"><b>{vehicle?.name || vehicleId.toUpperCase()}</b><small>{vehicleId.toUpperCase()}</small></span>
              <span className="vehicle-rule-prices">
                <span><small>起步价</small><strong>{money(Math.round(Number(rule.baseFeeCents || 0) * 100))}</strong></span>
                <span><small>起步里程</small><strong>{Number(rule.baseDistanceMeters || 0).toLocaleString('zh-CN')} 米</strong></span>
                <span><small>超里程</small><strong>{money(Math.round(Number(rule.distanceFeePerKmCents || 0) * 100))}/公里</strong></span>
                <span><small>冷链附加</small><strong>{money(Math.round(Number(rule.coldChainFeeCents || 0) * 100))}</strong></span>
                <span><small>超重计费</small><strong>{Number(rule.overweightThresholdKg || 0)}kg 后 {money(Math.round(Number(rule.overweightFeePerKgCents || 0) * 100))}/kg</strong></span>
                <span><small>夜间 / 偏远</small><strong>{money(Math.round(Number(rule.nightFeeCents || 0) * 100))} / {money(Math.round(Number(rule.remoteAreaFeeCents || 0) * 100))}</strong></span>
                <span><small>报价有效期</small><strong>{rule.defaultQuoteValidityHours || config.defaultQuoteValidityHours || 0} 小时</strong></span>
              </span>
            </button>
            <button className="danger vehicle-rule-delete" onClick={() => void removeVehicleRule(vehicleId)}>删除</button>
          </article>
        })}{!Object.keys(config.vehicleRules || {}).length && <div className="empty"><b>暂无车型专属规则</b><span>未添加的车型继续使用统一价格</span></div>}</div>
      </section>
      {error && <div className="alert error">{error}</div>}
    </section>
    {vehicleRule && <div className="modal-bg" onMouseDown={closeVehicleRule}>
      <section className="modal vehicle-rule-modal" onMouseDown={event => event.stopPropagation()}>
        <div className="modal-title"><div><small className="mono">{editingVehicleId.toUpperCase()}</small><h2>{vehicles.find(vehicle => vehicle.id === editingVehicleId)?.name || '车型'}专属计费</h2></div><button className="plain-close" onClick={closeVehicleRule}>×</button></div>
        <div className="ops-form pricing-form">{fields.map(([key, label]) => <Field key={key} label={label} type="number" step={MONEY_FIELDS.has(key) ? '0.01' : '1'} value={vehicleRule[key] ?? config[key]} change={value => setEditingVehicleRule(current => ({ ...(current || {}), [key]: +value }))} />)}</div>
        <div className="modal-actions vehicle-rule-modal-actions"><button className="primary vehicle-rule-save" onClick={commitVehicleRule}>{editingVehicleIsNew ? '保存并添加' : '保存修改'}</button></div>
      </section>
    </div>}
  </>
}

const MONEY_FIELDS = new Set(['baseFeeCents', 'distanceFeePerKmCents', 'coldChainFeeCents', 'overweightFeePerKgCents', 'nightFeeCents', 'remoteAreaFeeCents'])
function pricingToYuan(config: AnyRecord) { const result = Object.fromEntries(Object.entries(config || {}).map(([key, value]) => [key, MONEY_FIELDS.has(key) ? Number(value || 0) / 100 : value])); result.vehicleRules = Object.fromEntries(Object.entries(config?.vehicleRules || {}).map(([id, rule]) => [id, pricingToYuan(rule as AnyRecord)])); return result }
function pricingToCents(config: AnyRecord) { const result = Object.fromEntries(Object.entries(config || {}).map(([key, value]) => [key, MONEY_FIELDS.has(key) ? Math.round(Number(value || 0) * 100) : value])); result.vehicleRules = Object.fromEntries(Object.entries(config?.vehicleRules || {}).map(([id, rule]) => [id, pricingToCents(rule as AnyRecord)])); return result }

function Inquiries({ inquiryType }: { inquiryType?: 'monthly' | 'rental' }) {
  const { toast } = useFeedback()
  const [list, setList] = useState<AnyRecord[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(false), [statusFilter, setStatusFilter] = useState(''), [selected, setSelected] = useState<AnyRecord>()
  const load = async () => { setLoading(true); try { const query = new URLSearchParams({ page: '1', pageSize: '100', ...(inquiryType ? { type: inquiryType } : {}) }); const page = await api<{ items: AnyRecord[] }>(`/operations/inquiries?${query}`); setList(page.items) } catch (e) { setError((e as Error).message) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => list.filter(value => !statusFilter || value.status === statusFilter), [list, statusFilter])
  const updateStatus = async (id: string, status: string, note?: string) => { try { await api(`/operations/inquiries/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, note }) }); await load(); setSelected(undefined); toast('咨询状态更新成功', 'success') } catch (e) { setError((e as Error).message); toast((e as Error).message, 'error') } }
  const typeLabels: Record<string, string> = { monthly: '包月专线', rental: '租购服务' }
  const statusLabels: Record<string, string> = { pending: '待处理', contacted: '已联系', closed: '已关闭' }

  return <section className="ops-grid inquiry-grid inquiry-page-shell">
    <div className="panel inquiry-record-panel">
      <div className="panel-title"><div><h2>{typeLabels[inquiryType || 'monthly']}咨询记录</h2><small>按提交时间倒序</small></div><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="">全部状态</option><option value="pending">待处理</option><option value="contacted">已联系</option><option value="closed">已关闭</option></select></div>
      {loading ? <div className="full-state"><p>加载中…</p></div> : <div className="ops-list inquiry-list">{filtered.map(row => <button key={row.id} className={selected?.id === row.id ? 'active' : ''} onClick={() => setSelected(row)}><b>{row.companyName || row.contactName}</b><span>{row.companyName ? `${row.contactName} · ${row.phone}` : row.phone}</span><small>{statusLabels[row.status] || row.status} · {new Date(row.createdAt).toLocaleDateString('zh-CN')}</small></button>)}</div>}
    </div>
    <div className="panel ops-editor inquiry-detail">{selected ? <>
      <div className="panel-title inquiry-heading"><div><small>{typeLabels[selected.type] || selected.type}</small><h2>{selected.companyName ? `${selected.companyName} · ${selected.contactName}` : selected.contactName}</h2></div><div><button onClick={() => void updateStatus(selected.id, 'contacted')}>标记已联系</button><button onClick={() => void updateStatus(selected.id, 'closed')}>关闭</button></div></div>
      <div className="inquiry-contact"><div><small>联系电话</small><strong>{selected.phone}</strong></div><CopyPhoneButton phone={selected.phone} /></div>
      <div className="inquiry-facts">
        <InquiryFact label="公司名称" value={selected.companyName || '未填写'} />
        <InquiryFact label="意向车型" value={displayVehicleModel(selected.vehicleId)} />
        {selected.type === 'monthly' && <>
          <InquiryFact label="发货地址" value={formatInquiryAddress(selected.senderAddress)} wide />
          <InquiryFact label="收货地址" value={formatInquiryAddress(selected.receiverAddress)} wide />
          <InquiryFact label="货物类型" value={selected.cargoType || '未填写'} />
          <InquiryFact label="配送周期" value={selected.deliveryCycle || '未填写'} />
          {selected.note && <InquiryFact label="跟进备注" value={selected.note} wide />}
          <InquiryFact label="每月预计次数" value={selected.monthlyTrips ? `${selected.monthlyTrips} 次` : '未填写'} />
          <InquiryFact label="提交时间" value={new Date(selected.createdAt).toLocaleString('zh-CN')} />
        </>}
        {selected.type === 'rental' && <>
          <InquiryFact label="咨询内容" value={selected.consultContent || '未填写'} wide />
          {selected.note && <InquiryFact label="跟进备注" value={selected.note} wide />}
          <InquiryFact label="提交时间" value={new Date(selected.createdAt).toLocaleString('zh-CN')} wide />
        </>}
      </div>
      {error && <div className="alert error inquiry-error">{error}</div>}
    </> : <div className="empty"><b>请选择咨询记录</b><span>左侧选择一位客户查看完整需求</span></div>}</div>
  </section>
}

function InquiryFact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={wide ? 'wide' : ''}><small>{label}</small><strong>{value}</strong></div> }
function displayVehicleModel(value: unknown) { const model = String(value || '').replace(/-(monthly|rental)$/i, ''); return model ? model.toUpperCase() : '未选择' }
function formatInquiryAddress(value: unknown) { if (!value) return '未填写'; if (typeof value === 'string') return value; if (typeof value === 'object' && 'address' in value) return String((value as { address?: unknown }).address || '未填写'); return '未填写' }
function CopyPhoneButton({ phone }: { phone: string }) { const [copied, setCopied] = useState(false); const copy = async () => { await navigator.clipboard.writeText(phone); setCopied(true); window.setTimeout(() => setCopied(false), 1500) }; return <button className="copy-phone" onClick={() => void copy()}>{copied ? '已复制' : '复制电话'}</button> }

function ContactSettings() {
  const { toast } = useFeedback()
  const [data, setData] = useState<AnyRecord>(), [error, setError] = useState(''), [saving, setSaving] = useState(false)
  const load = async () => { try { const value = await api<AnyRecord | null>('/operations/contact'); setData(value ?? {}) } catch (e) { setError((e as Error).message) } }
  useEffect(() => { void load() }, [])
  const save = async () => { if (!data) return; setSaving(true); try { await api('/operations/contact', { method: 'PUT', body: JSON.stringify(data) }); await load(); toast('联系方式保存成功', 'success') } catch (e) { setError((e as Error).message); toast((e as Error).message, 'error') } finally { setSaving(false) } }
  if (!data) return <div className="full-state"><p>加载中…</p></div>
  return <section className="panel ops-editor"><div className="panel-title"><div><h2>联系方式</h2><small>用于小程序内的客服与业务联系入口</small></div><button className="primary" disabled={saving} onClick={save}>{saving ? '保存中…' : '保存'}</button></div><div className="ops-form"><Field label="客服电话" value={data.phone ?? ''} change={phone => setData({ ...data, phone })} /><Field label="微信号" value={data.wechat ?? ''} change={wechat => setData({ ...data, wechat })} /><Field label="邮箱" value={data.email ?? ''} change={email => setData({ ...data, email })} /><Field label="工作时间" value={data.workTime ?? ''} change={workTime => setData({ ...data, workTime })} /></div>{error && <div className="alert error">{error}</div>}</section>
}

function Field({ label, value, change, type = 'text', step }: { label: string; value: string | number | undefined; change: (value: string) => void; type?: string; step?: string }) { return <label>{label}<input type={type} min={type === 'number' ? 0 : undefined} step={step} value={value ?? ''} onChange={e => change(e.target.value)} readOnly={change.toString() === '(() => {  })'} /></label> }

export type OperationsSection = 'vehicles' | 'banners' | 'pricing' | 'inquiries' | 'contact'
export default function OperationsSettings({ section, inquiryType }: { section: OperationsSection; inquiryType?: 'monthly' | 'rental' }) { const runtime = useRuntime(); return <>{section === 'vehicles' ? <VehicleSettings assetUploadEnabled={runtime?.capabilities.assetUpload ?? false} /> : section === 'banners' ? <Banners /> : section === 'pricing' ? <Pricing /> : section === 'inquiries' ? <Inquiries inquiryType={inquiryType} /> : <ContactSettings />}</> }
