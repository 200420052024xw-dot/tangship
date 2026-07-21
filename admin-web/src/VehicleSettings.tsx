import { DragEvent, useEffect, useMemo, useState } from 'react'
import { api, uploadAsset } from './api'

type VehicleMode = 'single' | 'monthly' | 'rental'
type VehicleSpecs = {
  maxLoadKg: number
  cargoVolume: string
  cargoDimensionsMm: { length: number; width: number; height: number }
  maxRangeKm: number
  speedKmh: string
  chargeTime: string
  temperatureRange?: string
}
type VehiclePricing = { description: string; startFrom?: number; breakdown?: Array<{ label: string; amount: number | string }> }
type VehicleImageItem = { id: string; url: string; objectKey: string; isPrimary: boolean; sortOrder: number }
type VehicleRecord = {
  id: string
  name: string
  fullName: string
  subtitle: string
  description: string
  specs: VehicleSpecs
  applicableScenes: string[]
  restrictions: string[]
  supportedModes: VehicleMode[]
  serviceMode: VehicleMode
  pricingDescription: VehiclePricing
  tags: string[]
  enabled: boolean
  requiresApproval: boolean
  sortOrder: number
  totalCount: number
  reservedCount: number
  availableCount: number
  images: string[]
  imageItems: VehicleImageItem[]
}

const MODE_LABELS: Record<VehicleMode, string> = { single: '按趟结算', monthly: '包月专线', rental: '租购服务' }
const COPY_LABELS: Record<VehicleMode, string> = { single: '复制到按趟', monthly: '复制到包月', rental: '复制到租赁' }

function emptyVehicle(mode: VehicleMode, sortOrder: number): VehicleRecord {
  return {
    id: `vehicle-${Date.now()}`,
    name: '', fullName: '', subtitle: '', description: '',
    specs: { maxLoadKg: 0, cargoVolume: '', cargoDimensionsMm: { length: 0, width: 0, height: 0 }, maxRangeKm: 0, speedKmh: '', chargeTime: '' },
    applicableScenes: [], restrictions: [], supportedModes: [mode], serviceMode: mode,
    pricingDescription: { description: '最终价格由后台统一核价确认', startFrom: 0 },
    tags: [], enabled: true, requiresApproval: false, sortOrder, totalCount: 0, reservedCount: 0, availableCount: 0, images: [], imageItems: [],
  }
}

function normalizeVehicle(value: Partial<VehicleRecord>): VehicleRecord {
  const specs = value.specs ?? ({} as VehicleSpecs)
  const images = value.images ?? []
  const imageItems = value.imageItems?.length ? value.imageItems : images.map((url, index) => ({ id: '', url, objectKey: '', isPrimary: index === 0, sortOrder: index }))
  return {
    ...emptyVehicle(value.serviceMode ?? 'single', Number(value.sortOrder) || 0),
    ...value,
    specs: {
      maxLoadKg: Number(specs.maxLoadKg) || 0,
      cargoVolume: specs.cargoVolume ?? '',
      cargoDimensionsMm: {
        length: Number(specs.cargoDimensionsMm?.length) || 0,
        width: Number(specs.cargoDimensionsMm?.width) || 0,
        height: Number(specs.cargoDimensionsMm?.height) || 0,
      },
      maxRangeKm: Number(specs.maxRangeKm) || 0,
      speedKmh: specs.speedKmh ?? '',
      chargeTime: specs.chargeTime ?? '',
      temperatureRange: specs.temperatureRange ?? '',
    },
    applicableScenes: value.applicableScenes ?? [], restrictions: value.restrictions ?? [], tags: value.tags ?? [], images, imageItems,
    pricingDescription: { description: value.pricingDescription?.description ?? '最终价格由后台统一核价确认', startFrom: Number(value.pricingDescription?.startFrom) || 0 },
  }
}

export default function VehicleSettings({ assetUploadEnabled }: { assetUploadEnabled: boolean }) {
  const [mode, setMode] = useState<VehicleMode>('single')
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
  const [selected, setSelected] = useState<VehicleRecord>()
  const [baseline, setBaseline] = useState('')
  const [syncModes, setSyncModes] = useState<VehicleMode[]>([])
  const [draggingId, setDraggingId] = useState('')
  const [imageIndex, setImageIndex] = useState(0)
  const [imageManagerOpen, setImageManagerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = async (keepId?: string) => {
    const rows = (await api<VehicleRecord[]>('/operations/vehicles')).map(normalizeVehicle)
    setVehicles(rows)
    if (keepId) {
      const current = rows.find(row => row.id === keepId)
      if (current) { setSelected(current); setBaseline(JSON.stringify(current)); setImageIndex(index => Math.min(index, Math.max(0, current.images.length - 1))) }
    }
  }
  useEffect(() => { void load().catch(reason => setError((reason as Error).message)) }, [])

  const filtered = useMemo(() => vehicles.filter(vehicle => vehicle.serviceMode === mode).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)), [mode, vehicles])
  const dirty = Boolean(selected) && JSON.stringify(selected) !== baseline
  const update = (next: VehicleRecord) => { setSelected(next); setError(''); setNotice('') }
  const updateSpec = <K extends keyof VehicleSpecs>(key: K, value: VehicleSpecs[K]) => selected && update({ ...selected, specs: { ...selected.specs, [key]: value } })
  const updateDimension = (key: keyof VehicleSpecs['cargoDimensionsMm'], value: number) => selected && update({ ...selected, specs: { ...selected.specs, cargoDimensionsMm: { ...selected.specs.cargoDimensionsMm, [key]: value } } })

  const selectVehicle = (vehicle: VehicleRecord) => { setSelected(vehicle); setBaseline(JSON.stringify(vehicle)); setSyncModes([]); setImageIndex(0); setImageManagerOpen(false); setError(''); setNotice('') }
  const createVehicle = () => { const vehicle = emptyVehicle(mode, filtered.length); setSelected(vehicle); setBaseline(''); setSyncModes([]); setImageIndex(0); setImageManagerOpen(false); setError(''); setNotice('') }

  const validate = (vehicle: VehicleRecord) => {
    if (!vehicle.name.trim() || !vehicle.fullName.trim() || !vehicle.subtitle.trim()) return '请完整填写完整名称、车型简称和副标题'
    if (vehicle.specs.maxLoadKg <= 0 || !vehicle.specs.cargoVolume.trim() || vehicle.specs.maxRangeKm <= 0 || !vehicle.specs.speedKmh.trim() || !vehicle.specs.chargeTime.trim()) return '请完整填写载重、货厢容积、续航、时速和充电时长'
    const dimensions = vehicle.specs.cargoDimensionsMm
    if (dimensions.length <= 0 || dimensions.width <= 0 || dimensions.height <= 0) return '请完整填写货箱长、宽、高'
    if (!vehicle.applicableScenes.some(Boolean)) return '请至少填写一个适用场景'
    if (!Number.isFinite(Number(vehicle.pricingDescription.startFrom)) || Number(vehicle.pricingDescription.startFrom) <= 0) return '请填写大于 0 的起送价格'
    return ''
  }

  const save = async () => {
    if (!selected) return
    const invalid = validate(selected)
    if (invalid) { setError(invalid); return }
    setSaving(true); setError(''); setNotice('')
    try {
      const body = { ...selected, description: selected.subtitle, applicableScenes: selected.applicableScenes.filter(Boolean), tags: [], restrictions: [], requiresApproval: false, supportedModes: [selected.serviceMode], pricingDescription: { description: '最终价格由后台根据实际订单核价确认', startFrom: Number(selected.pricingDescription.startFrom) }, syncModes }
      await api(`/operations/vehicles/${selected.id}`, { method: 'PUT', body: JSON.stringify(body) })
      await load(selected.id)
      setSyncModes([])
      setNotice(syncModes.length ? `已保存，并同步到${syncModes.map(item => MODE_LABELS[item]).join('、')}` : '车型资料已保存')
    } catch (reason) { setError((reason as Error).message) } finally { setSaving(false) }
  }

  const remove = async () => {
    if (!selected || !confirm(`确认删除车型 ${selected.name || selected.id}？`)) return
    setSaving(true)
    try { await api(`/operations/vehicles/${selected.id}`, { method: 'DELETE' }); setSelected(undefined); setBaseline(''); await load() }
    catch (reason) { setError((reason as Error).message) } finally { setSaving(false) }
  }

  const upload = async (file?: File) => {
    if (!assetUploadEnabled) { setError('本地 SQLite 模式不执行真实图片上传，请在扣子线上环境联调'); return }
    if (!file || !selected) return
    setSaving(true)
    try {
      const asset = await uploadAsset(file)
      await api(`/operations/vehicles/${selected.id}/images`, { method: 'POST', body: JSON.stringify({ ...asset, isPrimary: !selected.images.length, sortOrder: selected.images.length }) })
      await load(selected.id)
      setNotice('图片已添加')
    } catch (reason) { setError((reason as Error).message) } finally { setSaving(false) }
  }

  const deleteImage = async (image: VehicleImageItem) => {
    if (!selected || !image.id || !confirm('确认删除这张车型图片？')) return
    setSaving(true); setError(''); setNotice('')
    try {
      await api(`/operations/vehicles/${selected.id}/images/${image.id}`, { method: 'DELETE' })
      await load(selected.id)
      setNotice('图片已删除')
    } catch (reason) { setError((reason as Error).message) } finally { setSaving(false) }
  }

  const startDrag = (event: DragEvent<HTMLButtonElement>, id: string) => { setDraggingId(id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id) }
  const reorder = async (targetId: string) => {
    if (dirty) { setDraggingId(''); setError('当前车型有未保存修改，请先保存再调整排序'); return }
    const sourceId = draggingId
    setDraggingId('')
    if (!sourceId || sourceId === targetId) return
    const next = [...filtered], from = next.findIndex(item => item.id === sourceId), to = next.findIndex(item => item.id === targetId)
    if (from < 0 || to < 0) return
    const [moved] = next.splice(from, 1); next.splice(to, 0, moved)
    const ordered = next.map((vehicle, index) => ({ ...vehicle, sortOrder: index }))
    setVehicles(current => current.map(vehicle => ordered.find(item => item.id === vehicle.id) ?? vehicle))
    try {
      await Promise.all(ordered.map(vehicle => api(`/operations/vehicles/${vehicle.id}`, { method: 'PUT', body: JSON.stringify(vehicle) })))
      setNotice('车型顺序已更新')
    } catch (reason) { setError((reason as Error).message); await load(selected?.id) }
  }

  return <>
    <div className="service-mode-tabs">{(['single', 'monthly', 'rental'] as const).map(item => <button key={item} className={mode === item ? 'active' : ''} onClick={() => { setMode(item); setSelected(undefined); setBaseline(''); setSyncModes([]); setImageIndex(0); setImageManagerOpen(false) }}>{MODE_LABELS[item]}</button>)}</div>
    <section className="vehicle-workbench">
      <aside className="panel vehicle-queue">
        <div className="panel-title"><div><h2>{MODE_LABELS[mode]}车型</h2><small>拖动左侧把手调整展示顺序</small></div><button onClick={createVehicle}>新增车型</button></div>
        <div className="vehicle-sort-list">{filtered.map(vehicle => <div key={vehicle.id} className={`vehicle-sort-row ${selected?.id === vehicle.id ? 'active' : ''} ${draggingId === vehicle.id ? 'dragging' : ''}`} onDragOver={event => event.preventDefault()} onDrop={() => void reorder(vehicle.id)}>
          <button className="drag-handle" draggable onDragStart={event => startDrag(event, vehicle.id)} onDragEnd={() => setDraggingId('')} aria-label={`拖动 ${vehicle.name} 排序`}><i /><i /><i /></button>
          <button className="vehicle-row-main" onClick={() => selectVehicle(vehicle)}><b>{vehicle.name || '未命名车型'}</b><span>{vehicle.fullName || vehicle.id}</span><small>{vehicle.enabled ? '已上架' : '已下架'} · 可用 {vehicle.availableCount}</small></button>
        </div>)}</div>
      </aside>

      <section className="panel vehicle-editor-shell">
        {selected ? <>
          <header className="vehicle-editor-head">
            <div><small className="mono">{selected.id}</small><h2>小程序车型详情 · 编辑预览</h2><p>在预览中的空白位置直接填写，保存后即成为小程序车型资料。</p></div>
            <div className="vehicle-editor-actions"><button className="primary vehicle-action vehicle-delete" disabled={saving} onClick={() => void remove()}>删除车型</button><button className="primary vehicle-action vehicle-save" disabled={saving || (!dirty && !syncModes.length)} onClick={() => void save()}>{saving ? '保存中…' : '保存车型'}</button></div>
          </header>

          <div className="vehicle-copy-strip"><div><b>同步服务资料</b><small>可多选，保存时同步资料和图片</small></div><div className="vehicle-copy-options">{(['single', 'monthly', 'rental'] as const).filter(item => item !== selected.serviceMode).map(item => <button key={item} className={`sync-choice ${syncModes.includes(item) ? 'active' : ''}`} aria-pressed={syncModes.includes(item)} onClick={() => setSyncModes(current => current.includes(item) ? current.filter(modeItem => modeItem !== item) : [...current, item])}>{COPY_LABELS[item]}</button>)}</div></div>

          <div className="vehicle-phone-preview">
            <section className="vehicle-preview-hero">
              {selected.images[imageIndex] ? <img src={selected.images[imageIndex]} alt={`${selected.fullName || '车型'}图片 ${imageIndex + 1}`} /> : <div className="vehicle-image-empty"><strong>{selected.name || '车型图片'}</strong><span>点击右下角管理车型图片</span></div>}
              {selected.images.length > 1 && <><button type="button" className="vehicle-carousel-arrow previous" aria-label="上一张图片" onClick={() => setImageIndex(index => (index - 1 + selected.images.length) % selected.images.length)}>‹</button><button type="button" className="vehicle-carousel-arrow next" aria-label="下一张图片" onClick={() => setImageIndex(index => (index + 1) % selected.images.length)}>›</button><div className="vehicle-carousel-dots">{selected.images.map((_, index) => <button type="button" key={index} aria-label={`查看第 ${index + 1} 张图片`} className={imageIndex === index ? 'active' : ''} onClick={() => setImageIndex(index)} />)}</div></>}
              {selected.images.length > 0 && <span className="vehicle-image-counter">{imageIndex + 1} / {selected.images.length}</span>}
              <button type="button" className="vehicle-image-manage" onClick={() => setImageManagerOpen(true)}>图片管理</button>
            </section>

            <section className="vehicle-preview-intro">
              <label>完整名称<input className="vehicle-title-input" value={selected.fullName} onChange={event => update({ ...selected, fullName: event.target.value })} placeholder="小程序详情页主标题" /></label>
              <label>车型简称<input value={selected.name} onChange={event => update({ ...selected, name: event.target.value })} placeholder="例如 Z5" /></label>
              <label>副标题<textarea value={selected.subtitle} onChange={event => update({ ...selected, subtitle: event.target.value, description: event.target.value })} placeholder="一句话说明车型定位、能力和适用运输任务" /></label>
            </section>

            <section className="vehicle-preview-block"><div className="vehicle-block-title"><h3>核心参数</h3><span>小程序同款参数格</span></div><div className="vehicle-spec-grid">
              <SpecInput label="额定载重" suffix="kg" type="number" value={selected.specs.maxLoadKg} change={value => updateSpec('maxLoadKg', Number(value))} />
              <SpecInput label="货厢容积" suffix="m³" type="number" placeholder="例如 3.0" value={stripCargoVolumeUnit(selected.specs.cargoVolume)} change={value => updateSpec('cargoVolume', withUnit(value, 'm³'))} />
              <SpecInput label="最大续航" suffix="km" type="number" value={selected.specs.maxRangeKm} change={value => updateSpec('maxRangeKm', Number(value))} />
              <SpecInput label="运行时速" suffix="km/h" placeholder="例如 20-30" value={selected.specs.speedKmh} change={value => updateSpec('speedKmh', value)} />
              <SpecInput label="充电时长" suffix="小时" type="number" placeholder="例如 2" value={stripHourUnit(selected.specs.chargeTime)} change={value => updateSpec('chargeTime', withUnit(value, '小时'))} />
              <SpecInput label="温控范围（选填）" placeholder="例如 -18°C ~ +8°C" value={selected.specs.temperatureRange ?? ''} change={value => updateSpec('temperatureRange', value)} />
            </div><div className="vehicle-dimensions"><span>货箱尺寸（毫米）</span><div><SpecInput label="长" type="number" value={selected.specs.cargoDimensionsMm.length} change={value => updateDimension('length', Number(value))} /><SpecInput label="宽" type="number" value={selected.specs.cargoDimensionsMm.width} change={value => updateDimension('width', Number(value))} /><SpecInput label="高" type="number" value={selected.specs.cargoDimensionsMm.height} change={value => updateDimension('height', Number(value))} /></div></div></section>

            <section className="vehicle-preview-block vehicle-tag-section"><div className="vehicle-block-title"><h3>适用场景</h3><span>输入一个场景后按回车</span></div><SceneTagInput value={selected.applicableScenes} change={applicableScenes => update({ ...selected, applicableScenes })} /></section>
            <section className="vehicle-preview-block"><div className="vehicle-block-title"><h3>运营与价格</h3><span>起送价按车型单独设置</span></div><div className="vehicle-operation-grid">
              <SpecInput label="车型总数量" type="number" value={selected.totalCount} change={value => update({ ...selected, totalCount: Math.max(0, Number(value)) })} />
              <SpecInput label="起送价格" suffix="元" type="number" value={selected.pricingDescription.startFrom ?? 0} change={value => update({ ...selected, pricingDescription: { ...selected.pricingDescription, startFrom: Math.max(0, Number(value)) } })} />
              <label className="vehicle-toggle"><input type="checkbox" checked={selected.enabled} onChange={event => update({ ...selected, enabled: event.target.checked })} /><span>小程序上架展示</span></label>
            </div><div className="vehicle-price-note"><b>车型起送价格</b><span>此价格展示在小程序车型详情页；实际订单仍由管理员根据路线和货物核价。</span></div></section>
          </div>
          {error && <div className="alert error vehicle-feedback">{error}</div>}{notice && <div className="alert vehicle-feedback">{notice}</div>}
          {imageManagerOpen && <div className="modal-bg image-manager-bg" onClick={() => setImageManagerOpen(false)}><section className="image-manager-modal" onClick={event => event.stopPropagation()}><header><div><small className="mono">{selected.id}</small><h2>车型图片管理</h2><p>支持多张图片，小程序详情页将按这里的顺序轮播展示。</p></div><button type="button" className="icon-close" aria-label="关闭图片管理" onClick={() => setImageManagerOpen(false)}>×</button></header><div className="image-manager-toolbar"><label className={`image-add-button ${assetUploadEnabled ? '' : 'disabled'}`}>添加图片<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!assetUploadEnabled || saving} onChange={event => void upload(event.target.files?.[0])} /></label><span>{assetUploadEnabled ? '图片将上传至 TOS 对象存储' : '本地 SQLite 模式禁用真实上传，可在线上环境添加'}</span></div>{selected.imageItems.length ? <div className="image-manager-grid">{selected.imageItems.map((image, index) => <article key={image.id || `${image.url}-${index}`}><img src={image.url} alt={`车型图片 ${index + 1}`} /><div><span>{index === 0 || image.isPrimary ? '主图' : `第 ${index + 1} 张`}</span><button type="button" disabled={!image.id || saving} onClick={() => void deleteImage(image)}>删除</button></div></article>)}</div> : <div className="image-manager-empty"><b>还没有车型图片</b><span>线上环境可点击“添加图片”上传多张展示图。</span></div>}{error && <div className="alert error">{error}</div>}</section></div>}
        </> : <div className="empty"><b>选择一个车型开始编辑</b><span>右侧会模拟小程序车型详情页，所有空白位置都可以直接填写。</span></div>}
      </section>
    </section>
  </>
}

function SpecInput({ label, value, change, suffix, type = 'text', placeholder }: { label: string; value: string | number; change: (value: string) => void; suffix?: string; type?: 'text' | 'number'; placeholder?: string }) {
  return <label className="vehicle-spec-input"><span>{label}</span><div><input type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined} value={value} placeholder={placeholder} onChange={event => change(event.target.value)} />{suffix && <small>{suffix}</small>}</div></label>
}

function SceneTagInput({ value, change }: { value: string[]; change: (value: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = (input = draft) => {
    const additions = input.split(/[、,，\n]/).map(item => item.trim()).filter(Boolean)
    if (!additions.length) return
    change([...new Set([...value.filter(Boolean), ...additions])])
    setDraft('')
  }
  return <div className="scene-tag-editor"><div>{value.filter(Boolean).map((tag, index) => <span key={`${tag}-${index}`}>{tag}<button type="button" aria-label={`删除场景 ${tag}`} onClick={() => change(value.filter((_, itemIndex) => itemIndex !== index))}>×</button></span>)}</div><input value={draft} placeholder="输入场景，例如社区配送，按回车添加" onChange={event => { const input = event.target.value; if (/[、,，]$/.test(input)) add(input.slice(0, -1)); else setDraft(input) }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add() } }} onBlur={() => add()} /></div>
}

function stripCargoVolumeUnit(value: string) { return value.replace(/\s*m(?:³|3)$/i, '').trim() }
function stripHourUnit(value: string) { return value.replace(/\s*小时$/, '').trim() }
function withUnit(value: string, unit: string) { const clean = value.trim(); return clean ? `${clean} ${unit}` : '' }
