import { DragEvent, useEffect, useMemo, useState } from 'react'
import { api, uploadAsset } from './api'
import { useFeedback } from './feedback'

type VehicleMode = 'single' | 'monthly' | 'rental'
type VehicleSpecs = {
  maxLoadKg: number
  cargoVolume: string
  cargoDimensionsMm: { length: number; width: number; height: number }
  maxRangeKm: number
  speedKmh: string
  chargeTime: string
  supportsRefrigeration: boolean
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
  serviceVariants: Partial<Record<VehicleMode, string>>
}

const MODE_LABELS: Record<VehicleMode, string> = { single: '按趟结算', monthly: '包月专线', rental: '租购服务' }
const COPY_LABELS: Record<VehicleMode, string> = { single: '复制到按趟', monthly: '复制到包月', rental: '复制到租赁' }

function stripCelsiusUnit(value?: string) {
  return (value ?? '').replace(/\s*(?:°C|℃)/gi, '').trim()
}

function withCelsiusUnit(value: string) {
  const normalized = stripCelsiusUnit(value)
  return normalized ? `${normalized}℃` : ''
}

function emptyVehicle(mode: VehicleMode, sortOrder: number): VehicleRecord {
  return {
    id: `vehicle-${Date.now()}`,
    name: '', fullName: '', subtitle: '', description: '',
    specs: { maxLoadKg: 0, cargoVolume: '', cargoDimensionsMm: { length: 0, width: 0, height: 0 }, maxRangeKm: 0, speedKmh: '', chargeTime: '', supportsRefrigeration: false },
    applicableScenes: [], restrictions: [], supportedModes: [mode], serviceMode: mode,
    pricingDescription: { description: '', startFrom: 0 },
    tags: [], enabled: true, requiresApproval: false, sortOrder, totalCount: 1, reservedCount: 0, availableCount: 1, images: [], imageItems: [], serviceVariants: {},
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
      supportsRefrigeration: specs.supportsRefrigeration ?? Boolean(specs.temperatureRange?.trim()),
      temperatureRange: specs.temperatureRange ?? '',
    },
    applicableScenes: value.applicableScenes ?? [], restrictions: value.restrictions ?? [], tags: value.tags ?? [], images, imageItems, serviceVariants: value.serviceVariants ?? {},
    pricingDescription: { description: '', startFrom: Number(value.pricingDescription?.startFrom) || 0 },
  }
}

export default function VehicleSettings({ assetUploadEnabled }: { assetUploadEnabled: boolean }) {
  const { alert, confirm, toast } = useFeedback()
  const [mode, setMode] = useState<VehicleMode>('single')
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
  const [selected, setSelected] = useState<VehicleRecord>()
  const [baseline, setBaseline] = useState('')
  const [syncModes, setSyncModes] = useState<VehicleMode[]>([])
  const [draggingId, setDraggingId] = useState('')
  const [imageIndex, setImageIndex] = useState(0)
  const [imageManagerOpen, setImageManagerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all')

  const load = async (keepId?: string) => {
    const rows = (await api<VehicleRecord[]>('/operations/vehicles')).map(normalizeVehicle)
    setVehicles(rows)
    const current = rows.find(row => row.id === keepId) || rows.filter(row => row.serviceMode === mode).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))[0]
    if (current) { setSelected(current); setBaseline(JSON.stringify(current)); setImageIndex(index => Math.min(index, Math.max(0, current.images.length - 1))) }
    else { setSelected(undefined); setBaseline('') }
  }
  useEffect(() => { void load().catch(reason => setError((reason as Error).message)) }, [])

  const modeVehicles = useMemo(() => vehicles.filter(vehicle => vehicle.serviceMode === mode).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)), [mode, vehicles])
  const filtered = useMemo(() => modeVehicles.filter(vehicle => statusFilter === 'all' || (statusFilter === 'enabled' ? vehicle.enabled : !vehicle.enabled)), [modeVehicles, statusFilter])
  const dirty = Boolean(selected) && JSON.stringify(selected) !== baseline
  const update = (next: VehicleRecord) => { setSelected(next); setError(''); setNotice('') }
  const updateSpec = <K extends keyof VehicleSpecs>(key: K, value: VehicleSpecs[K]) => selected && update({ ...selected, specs: { ...selected.specs, [key]: value } })
  const updateDimension = (key: keyof VehicleSpecs['cargoDimensionsMm'], value: number) => selected && update({ ...selected, specs: { ...selected.specs, cargoDimensionsMm: { ...selected.specs.cargoDimensionsMm, [key]: value } } })
  const updateRefrigeration = (supportsRefrigeration: boolean) => selected && update({
    ...selected,
    specs: {
      ...selected.specs,
      supportsRefrigeration,
    },
  })

  const selectVehicle = (vehicle: VehicleRecord) => { setSelected(vehicle); setBaseline(JSON.stringify(vehicle)); setSyncModes([]); setImageIndex(0); setImageManagerOpen(false); setError(''); setNotice('') }
  const createVehicle = () => { const vehicle = emptyVehicle(mode, modeVehicles.length); setSelected(vehicle); setBaseline(''); setSyncModes([]); setImageIndex(0); setImageManagerOpen(false); setError(''); setNotice('') }

  const validate = (vehicle: VehicleRecord) => {
    if (!vehicle.name.trim() || !vehicle.fullName.trim() || !vehicle.subtitle.trim()) return '请完整填写完整名称、车型简称和副标题'
    if (vehicle.specs.maxLoadKg <= 0 || !vehicle.specs.cargoVolume.trim() || vehicle.specs.maxRangeKm <= 0 || !vehicle.specs.speedKmh.trim() || !vehicle.specs.chargeTime.trim()) return '请完整填写载重、货厢容积、续航、时速和充电时长'
    const dimensions = vehicle.specs.cargoDimensionsMm
    if (dimensions.length <= 0 || dimensions.width <= 0 || dimensions.height <= 0) return '请完整填写货箱长、宽、高'
    if (vehicle.specs.supportsRefrigeration && !vehicle.specs.temperatureRange?.trim()) return '支持冷藏的车型必须填写温控范围'
    if (!vehicle.applicableScenes.some(Boolean)) return '请至少填写一个适用场景'
    return ''
  }

  const save = async () => {
    if (!selected) return
    const invalid = validate(selected)
    if (invalid) { setError(invalid); await alert({ title: '车型资料未填写完整', message: invalid, danger: true }); return }
    setSaving(true); setError(''); setNotice('')
    try {
      const body = { ...selected, description: selected.subtitle, applicableScenes: selected.applicableScenes.filter(Boolean), tags: [], restrictions: [], requiresApproval: false, supportedModes: [selected.serviceMode], pricingDescription: { description: '', startFrom: Number(selected.pricingDescription.startFrom) }, syncModes }
      await api(`/operations/vehicles/${selected.id}`, { method: 'PUT', body: JSON.stringify(body) })
      await load(selected.id)
      setSyncModes([])
      setNotice(syncModes.length ? `已保存，并同步到${syncModes.map(item => MODE_LABELS[item]).join('、')}` : '车型资料已保存')
      toast(`${selected.name}车型保存成功${syncModes.length ? `，已同步到${syncModes.map(item => MODE_LABELS[item]).join('、')}` : ''}`, 'success')
    } catch (reason) { setError((reason as Error).message) } finally { setSaving(false) }
  }

  const remove = async () => {
    if (!selected || !await confirm({ title: '删除车型', message: `确认删除车型“${selected.name || selected.id}”？已被订单使用的车型无法删除。`, confirmLabel: '删除车型', danger: true })) return
    setSaving(true)
    try { const deletedName = selected.name || selected.id; await api(`/operations/vehicles/${selected.id}`, { method: 'DELETE' }); setSelected(undefined); setBaseline(''); await load(); toast(`${deletedName}车型已删除`, 'success') }
    catch (reason) {
      const message = (reason as Error).message
      if (/订单|引用|下架/.test(message) && await confirm({ title: '该车型不能直接删除', message: `${message}\n\n是否立即将该车型下架？`, confirmLabel: '立即下架', danger: true })) {
        try { await api(`/operations/vehicles/${selected.id}`, { method: 'PUT', body: JSON.stringify({ ...selected, enabled: false }) }); await load(selected.id); toast(`${selected.name || selected.id}已下架`, 'success') }
        catch (disableReason) { await alert({ title: '下架失败', message: (disableReason as Error).message, danger: true }) }
      } else setError(message)
    } finally { setSaving(false) }
  }

  const upload = async (file?: File) => {
    if (!assetUploadEnabled) { setError('请先配置 TOS 对象存储后再上传图片'); return }
    if (!file || !selected) return
    const localUrl = URL.createObjectURL(file)
    const temporaryId = `pending-${Date.now()}`
    const snapshot = selected
    const temporaryImage: VehicleImageItem = { id: temporaryId, url: localUrl, objectKey: '', isPrimary: selected.imageItems.length === 0, sortOrder: selected.imageItems.length }
    const optimistic = { ...selected, images: [...selected.images, localUrl], imageItems: [...selected.imageItems, temporaryImage] }
    setSelected(optimistic)
    setVehicles(current => current.map(vehicle => vehicle.id === optimistic.id ? optimistic : vehicle))
    setImageIndex(optimistic.images.length - 1)
    setImageBusy(true)
    try {
      const asset = await uploadAsset(file)
      const updated = normalizeVehicle(await api<VehicleRecord>(`/operations/vehicles/${selected.id}/images`, { method: 'POST', body: JSON.stringify({ ...asset, isPrimary: !snapshot.images.length, sortOrder: snapshot.images.length }) }))
      setSelected(updated); setVehicles(current => current.map(vehicle => vehicle.id === updated.id ? updated : vehicle)); setBaseline(JSON.stringify(updated)); setNotice('图片已添加'); toast('车型图片添加成功', 'success')
    } catch (reason) { setSelected(snapshot); setVehicles(current => current.map(vehicle => vehicle.id === snapshot.id ? snapshot : vehicle)); setImageIndex(Math.max(0, snapshot.images.length - 1)); setError((reason as Error).message); toast(`图片添加失败：${(reason as Error).message}`, 'error') } finally { URL.revokeObjectURL(localUrl); setImageBusy(false) }
  }

  const deleteImage = async (image: VehicleImageItem) => {
    if (!selected || !image.id || image.id.startsWith('pending-') || !await confirm({ title: '删除车型图片', message: '确认删除这张车型图片？删除后将同步影响小程序车型详情。', confirmLabel: '删除图片', danger: true })) return
    const snapshot = selected
    const removedIndex = selected.imageItems.findIndex(item => item.id === image.id)
    const remainingItems = selected.imageItems.filter(item => item.id !== image.id).map((item, index) => ({ ...item, isPrimary: index === 0, sortOrder: index }))
    const optimistic = { ...selected, imageItems: remainingItems, images: remainingItems.map(item => item.url) }
    setSelected(optimistic); setVehicles(current => current.map(vehicle => vehicle.id === optimistic.id ? optimistic : vehicle)); setImageIndex(index => Math.min(index, Math.max(0, optimistic.images.length - 1)))
    setImageBusy(true); setError(''); setNotice('')
    try {
      await api(`/operations/vehicles/${selected.id}/images/${image.id}`, { method: 'DELETE' })
      setBaseline(JSON.stringify(optimistic)); setNotice('图片已删除'); toast('车型图片已删除', 'success')
    } catch (reason) { setSelected(snapshot); setVehicles(current => current.map(vehicle => vehicle.id === snapshot.id ? snapshot : vehicle)); setImageIndex(Math.max(0, removedIndex)); setError((reason as Error).message); toast(`图片删除失败：${(reason as Error).message}`, 'error') } finally { setImageBusy(false) }
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

  return <div className="vehicle-page-shell">
    <div className="service-mode-tabs">{(['single', 'monthly', 'rental'] as const).map(item => <button key={item} className={mode === item ? 'active' : ''} onClick={() => { const first = vehicles.filter(vehicle => vehicle.serviceMode === item).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))[0]; setMode(item); setSelected(first); setBaseline(first ? JSON.stringify(first) : ''); setSyncModes([]); setImageIndex(0); setImageManagerOpen(false) }}>{MODE_LABELS[item]}</button>)}</div>
    <section className="vehicle-workbench">
      <aside className="panel vehicle-queue">
        <div className="panel-title"><div><h2>{MODE_LABELS[mode]}车型</h2><small>拖动左侧把手调整展示顺序</small></div><button onClick={createVehicle}>新增车型</button></div>
        <div className="vehicle-status-filter" role="tablist" aria-label="车型上架状态"><button className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}><span>全部</span><b>{modeVehicles.length}</b></button><button className={statusFilter === 'enabled' ? 'active' : ''} onClick={() => setStatusFilter('enabled')}><span>已上架</span><b>{modeVehicles.filter(vehicle => vehicle.enabled).length}</b></button><button className={statusFilter === 'disabled' ? 'active' : ''} onClick={() => setStatusFilter('disabled')}><span>已下架</span><b>{modeVehicles.filter(vehicle => !vehicle.enabled).length}</b></button></div>
        <div className="vehicle-sort-list">{filtered.map(vehicle => <div key={vehicle.id} className={`vehicle-sort-row ${selected?.id === vehicle.id ? 'active' : ''} ${draggingId === vehicle.id ? 'dragging' : ''}`} onDragOver={event => event.preventDefault()} onDrop={() => void reorder(vehicle.id)}>
          <button className="drag-handle" draggable onDragStart={event => startDrag(event, vehicle.id)} onDragEnd={() => setDraggingId('')} aria-label={`拖动 ${vehicle.name} 排序`}><i /><i /><i /></button>
          <button className="vehicle-row-main" onClick={() => selectVehicle(vehicle)}><b>{vehicle.name || '未命名车型'}{vehicle.specs.supportsRefrigeration && <em className="cold-vehicle-badge">冷藏</em>}</b><span>{vehicle.fullName || vehicle.id}</span><small>{vehicle.enabled ? '已上架' : '已下架'} · 可用 {vehicle.availableCount}</small></button>
        </div>)}</div>
      </aside>

      <section className="panel vehicle-editor-shell">
        {selected ? <>
          <header className="vehicle-editor-head">
            <div><small className="mono">{selected.id}</small><h2>小程序车型详情 · 编辑预览</h2><p>在预览中的空白位置直接填写，保存后即成为小程序车型资料。</p></div>
            <div className="vehicle-editor-actions"><button className="primary vehicle-action vehicle-delete" disabled={saving} onClick={() => void remove()}>删除车型</button><button className="primary vehicle-action vehicle-save" disabled={saving || (!dirty && !syncModes.length)} onClick={() => void save()}>{saving ? '保存中…' : '保存车型'}</button></div>
          </header>

          <div className="vehicle-copy-strip"><div><b>同步服务资料</b><small>可多选；同步资料和图片，但不覆盖目标车型数量</small></div><div className="vehicle-copy-options">{(['single', 'monthly', 'rental'] as const).filter(item => item !== selected.serviceMode).map(item => <button key={item} className={`sync-choice ${syncModes.includes(item) ? 'active' : ''}`} aria-pressed={syncModes.includes(item)} onClick={() => setSyncModes(current => current.includes(item) ? current.filter(modeItem => modeItem !== item) : [...current, item])}>{selected.serviceVariants[item] ? `同步到${MODE_LABELS[item].replace('结算', '').replace('专线', '').replace('服务', '')}` : COPY_LABELS[item]}</button>)}</div></div>

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
              <label>副标题<input value={selected.subtitle} onChange={event => update({ ...selected, subtitle: event.target.value, description: event.target.value })} placeholder="一句话说明车型定位、能力和适用运输任务" /></label>
            </section>

            <section className="vehicle-preview-block"><div className="vehicle-block-title"><h3>核心参数</h3><span>小程序同款参数格</span></div><div className="vehicle-spec-grid">
              <SpecInput label="额定载重" suffix="kg" type="number" value={selected.specs.maxLoadKg} change={value => updateSpec('maxLoadKg', Number(value))} />
              <SpecInput label="货厢容积" suffix="m³" type="number" placeholder="例如 3.0" value={stripCargoVolumeUnit(selected.specs.cargoVolume)} change={value => updateSpec('cargoVolume', withUnit(value, 'm³'))} />
              <SpecInput label="最大续航" suffix="km" type="number" value={selected.specs.maxRangeKm} change={value => updateSpec('maxRangeKm', Number(value))} />
              <SpecInput label="运行时速" suffix="km/h" placeholder="例如 20-30" value={selected.specs.speedKmh} change={value => updateSpec('speedKmh', value)} />
              <SpecInput label="充电时长" suffix="小时" type="number" placeholder="例如 2" value={stripHourUnit(selected.specs.chargeTime)} change={value => updateSpec('chargeTime', withUnit(value, '小时'))} />
              <div className="vehicle-refrigeration-field">
                <label className="vehicle-refrigeration-check">
                  <span>冷藏</span>
                  <input
                    type="checkbox"
                    checked={selected.specs.supportsRefrigeration}
                    onChange={event => updateRefrigeration(event.target.checked)}
                  />
                </label>
                <label className={`vehicle-refrigeration-temperature ${selected.specs.supportsRefrigeration ? '' : 'disabled'}`}>
                  <span>温度范围</span>
                  <div>
                    <input
                      value={stripCelsiusUnit(selected.specs.temperatureRange)}
                      placeholder="例如 -18 ~ +8"
                      disabled={!selected.specs.supportsRefrigeration}
                      onChange={event => updateSpec('temperatureRange', withCelsiusUnit(event.target.value))}
                    />
                    <small>℃</small>
                  </div>
                </label>
              </div>
            </div><div className="vehicle-dimensions"><span>货箱尺寸（毫米）</span><div><SpecInput label="长" type="number" value={selected.specs.cargoDimensionsMm.length} change={value => updateDimension('length', Number(value))} /><SpecInput label="宽" type="number" value={selected.specs.cargoDimensionsMm.width} change={value => updateDimension('width', Number(value))} /><SpecInput label="高" type="number" value={selected.specs.cargoDimensionsMm.height} change={value => updateDimension('height', Number(value))} /></div></div></section>

            <section className="vehicle-preview-block vehicle-tag-section"><div className="vehicle-block-title"><h3>适用场景</h3><span>输入一个场景后按回车</span></div><SceneTagInput value={selected.applicableScenes} change={applicableScenes => update({ ...selected, applicableScenes })} /></section>
            <section className="vehicle-preview-block"><div className="vehicle-block-title"><h3>运营与价格</h3><span>起送价由“价格规则”统一维护</span></div><div className="vehicle-operation-grid">
              <SpecInput label="车型总数量" type="number" value={selected.totalCount} change={value => update({ ...selected, totalCount: Math.max(0, Number(value)) })} />
              <label className="vehicle-spec-input"><span>已发布起送价格</span><div><input type="number" value={selected.pricingDescription.startFrom ?? 0} readOnly /><small>元</small></div></label>
              <label className="vehicle-toggle"><input type="checkbox" checked={selected.enabled} onChange={event => update({ ...selected, enabled: event.target.checked })} /><span>小程序上架展示</span></label>
            </div><div className="vehicle-price-note"><b>车型起送价格</b><span>请前往“价格规则”添加或修改车型专属规则。</span></div></section>
          </div>
          {error && <div className="alert error vehicle-feedback">{error}</div>}{notice && <div className="alert vehicle-feedback">{notice}</div>}
          {imageManagerOpen && <div className="modal-bg image-manager-bg" onClick={() => !imageBusy && setImageManagerOpen(false)}><section className="image-manager-modal" onClick={event => event.stopPropagation()}><header><div><small className="mono">{selected.id}</small><h2>车型图片管理</h2><p>支持多张图片，小程序详情页将按这里的顺序轮播展示。</p></div><button type="button" className="plain-close" aria-label="关闭图片管理" onClick={() => setImageManagerOpen(false)}>×</button></header><div className="image-manager-toolbar"><label className={`image-add-button ${assetUploadEnabled ? '' : 'disabled'}`}>{imageBusy ? '后台处理中…' : '添加图片'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!assetUploadEnabled || imageBusy} onChange={event => { void upload(event.target.files?.[0]); event.currentTarget.value = '' }} /></label><span>{assetUploadEnabled ? '选择后立即预览，图片在后台上传至 TOS' : '请先配置 TOS 对象存储'}</span></div>{selected.imageItems.length ? <div className="image-manager-grid">{selected.imageItems.map((image, index) => <article className={image.id.startsWith('pending-') ? 'pending' : ''} key={image.id || `${image.url}-${index}`}><img src={image.url} alt={`车型图片 ${index + 1}`} /><div><span>{image.id.startsWith('pending-') ? '上传中…' : index === 0 || image.isPrimary ? '主图' : `第 ${index + 1} 张`}</span><button type="button" className="image-delete-button" disabled={!image.id || imageBusy || image.id.startsWith('pending-')} onClick={() => void deleteImage(image)}>删除图片</button></div></article>)}</div> : <div className="image-manager-empty"><b>还没有车型图片</b><span>配置 TOS 后可点击“添加图片”上传多张展示图。</span></div>}</section></div>}
        </> : <div className="empty"><b>选择一个车型开始编辑</b><span>右侧会模拟小程序车型详情页，所有空白位置都可以直接填写。</span></div>}
      </section>
    </section>
  </div>
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
