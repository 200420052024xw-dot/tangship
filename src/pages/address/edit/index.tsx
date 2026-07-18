/**
 * 地址编辑页(新增/编辑)
 *
 * 字段结构:
 * - 联系人 + 手机号
 * - 地图选点(POI + 经纬度)
 * - 楼栋/楼层/房间号
 * - 标签 + 默认地址 + usageType
 *
 * 路由参数:
 * - id: 编辑模式时传入地址 id
 * - usage: 'sender' | 'receiver' | 'both'
 * - select: '1' — 选择模式,保存后通过 EventChannel 回传给下单页
 */

import { View, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'
import type { FC } from 'react'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Card, CardContent } from '@/components/ui/card'
import { MapPin, Pencil, ArrowLeft, TriangleAlert } from 'lucide-react-taro'
import type { Address, AddressUsage, AddressLabel } from '@/types/address'
import { useAddressStore, createEmptyAddress } from '@/stores/address'
import { isValidPhone, isNonEmptyString, isValidCoordinate, isWithinLength } from '@/utils/validators'

const TAG_OPTIONS: { value: AddressLabel; label: string }[] = [
  { value: '家', label: '家' },
  { value: '公司', label: '公司' },
  { value: '仓库', label: '仓库' },
  { value: '其他', label: '其他' },
]

/** 小程序端判断(微信 + 抖音) */
const isMiniApp = ([Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT] as string[]).includes(Taro.getEnv())

const AddressEditPage: FC = () => {
  const router = Taro.getCurrentInstance().router
  const editId = router?.params?.id || ''
  const usageParam = (router?.params?.usage || 'both') as AddressUsage
  const selectMode = router?.params?.select === '1'
  const relayMode = router?.params?.relay === '1'

  const { addressList, loadAddresses, saveAddress } = useAddressStore()

  // 表单状态
  const [contactName, setContactName] = useState('')
  const [mobile, setMobile] = useState('')
  const [poiName, setPoiName] = useState('')
  const [formattedAddress, setFormattedAddress] = useState('')
  const [province, setProvince] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [detailAddress, setDetailAddress] = useState('')
  const [longitude, setLongitude] = useState(0)
  const [latitude, setLatitude] = useState(0)
  const [label, setLabel] = useState<AddressLabel>('其他')
  const [isDefault, setIsDefault] = useState(false)
  const [usageType, setUsageType] = useState<AddressUsage>(usageParam)
  const [mapPickerFailed, setMapPickerFailed] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAddresses().catch(() => undefined) }, [loadAddresses])

  // 编辑模式:预填
  useEffect(() => {
    if (!editId) return
    const existing = addressList.find(a => a.id === editId)
    if (!existing) return
    setContactName(existing.contactName)
    setMobile(existing.mobile)
    setPoiName(existing.poiName || '')
    setFormattedAddress(existing.formattedAddress || '')
    setProvince(existing.province || '')
    setCity(existing.city || '')
    setDistrict(existing.district || '')
    setDetailAddress(existing.detailAddress)
    setLongitude(existing.longitude)
    setLatitude(existing.latitude)
    setLabel(existing.label || '其他')
    setIsDefault(!!existing.isDefault)
    setUsageType(existing.usageType)
  }, [editId, addressList])

  const handleBack = () => Taro.navigateBack()

  /** 地图选点 */
  const handleChooseLocation = async () => {
    if (!isMiniApp) {
      // H5 端:让用户手填 POI/经纬度(经纬度非必填,但若有则必须有效)
      Taro.showToast({ title: '请手动填写地址与经纬度', icon: 'none' })
      return
    }
    try {
      const res = await Taro.chooseLocation({})
      if (!res || !res.name) return
      setPoiName(res.name)
      setFormattedAddress(res.address || '')
      setLatitude(Number(res.latitude) || 0)
      setLongitude(Number(res.longitude) || 0)
      // 尝试解析省市区
      const addr = (res.address || '') as string
      const provinceMatch = addr.match(/^(北京市|上海市|天津市|重庆市|河北省|山西省|辽宁省|吉林省|黑龙江省|江苏省|浙江省|安徽省|福建省|江西省|山东省|河南省|湖北省|湖南省|广东省|海南省|四川省|贵州省|云南省|陕西省|甘肃省|青海省|台湾省|内蒙古自治区|广西壮族自治区|西藏自治区|宁夏回族自治区|新疆维吾尔自治区|香港特别行政区|澳门特别行政区)/)
      setProvince(provinceMatch?.[1] || '')
      setMapPickerFailed(false)
    } catch (error: any) {
      // 用户取消或选点失败
      if (error?.errMsg?.includes('cancel')) return
      setMapPickerFailed(true)
      Taro.showToast({
        title: error?.errMsg || '地图选点失败,请手动填写',
        icon: 'none',
      })
    }
  }

  /** 表单校验 */
  const validate = (): string | null => {
    if (!isNonEmptyString(contactName)) return '请填写联系人'
    if (!isNonEmptyString(mobile)) return '请填写联系电话'
    if (!isValidPhone(mobile)) return '请填写正确的手机号或固定电话'
    if (!isMiniApp && !isValidCoordinate(longitude, latitude)) {
      // H5 端无地图选点能力,允许用户手填经纬度,若填写则必须有效
      if (longitude !== 0 || latitude !== 0) return '请填写有效的经纬度'
    }
    if (isMiniApp && !isValidCoordinate(longitude, latitude)) {
      return '请先在地图上选择位置'
    }
    if (!isNonEmptyString(detailAddress)) return '请填写楼栋/楼层/门牌号'
    if (!isWithinLength(detailAddress, 100)) return '详细地址不能超过 100 字'
    return null
  }

  const handleSave = async () => {
    const error = validate()
    if (error) {
      Taro.showToast({ title: error, icon: 'none' })
      return
    }

    const now = Date.now()
    const baseAddr: Address = editId
      ? (addressList.find(a => a.id === editId) || createEmptyAddress(usageType))
      : createEmptyAddress(usageType)

    const next: Address = {
      ...baseAddr,
      contactName: contactName.trim(),
      mobile: mobile.trim(),
      province: province || undefined,
      city: city || undefined,
      district: district || undefined,
      poiName: poiName.trim() || undefined,
      formattedAddress: formattedAddress.trim() || undefined,
      detailAddress: detailAddress.trim(),
      longitude: Number(longitude) || 0,
      latitude: Number(latitude) || 0,
      label,
      isDefault,
      usageType,
      updatedAt: now,
      createdAt: baseAddr.createdAt || now,
      id: baseAddr.id,
    }

    setSaving(true)
    let saved: Address
    try { saved = await saveAddress(next) } catch (saveError) { Taro.showToast({ title: saveError instanceof Error ? saveError.message : '保存失败', icon: 'none' }); setSaving(false); return }

    // 选择模式下,通过 EventChannel 回传给下单页
    if (selectMode) {
      const channel = Taro.getCurrentInstance()?.page?.getOpenerEventChannel?.()
      if (channel && typeof channel.emit === 'function') channel.emit('addressSelected', saved)
    }

    Taro.navigateBack({ delta: relayMode ? 2 : 1 })
  }

  return (
    <View className="min-h-screen bg-slate-50 pb-24">
      {/* 顶部标题 */}
      <View className="sticky top-0 z-10 bg-white border-b border-slate-100">
        <View className="flex items-center px-4 h-12">
          <View className="flex items-center gap-2" onClick={handleBack}>
            <ArrowLeft size={18} color="#1E293B" />
            <Text className="block text-base font-medium text-slate-800">
              {editId ? '编辑地址' : '新增地址'}
            </Text>
          </View>
        </View>
      </View>

      {/* 联系人 */}
      <Card className="mx-4 mt-3 mb-3">
        <CardContent className="p-4 space-y-3">
          <View>
            <Text className="block text-sm font-medium text-slate-700 mb-2">
              联系人 <Text className="text-red-500">*</Text>
            </Text>
            <View className="bg-slate-50 rounded-lg px-3 py-1">
              <Input
                className="w-full bg-transparent border-0 focus-within:ring-0 focus-within:border-0"
                placeholder="请输入联系人姓名"
                value={contactName}
                onInput={(e) => setContactName(e.detail.value)}
                maxlength={20}
              />
            </View>
          </View>
          <View>
            <Text className="block text-sm font-medium text-slate-700 mb-2">
              联系电话 <Text className="text-red-500">*</Text>
            </Text>
            <View className="bg-slate-50 rounded-lg px-3 py-1">
              <Input
                className="w-full bg-transparent border-0 focus-within:ring-0 focus-within:border-0"
                type="text"
                placeholder="手机号或固定电话"
                value={mobile}
                onInput={(e) => setMobile(e.detail.value)}
                maxlength={20}
              />
            </View>
            <Text className="block text-xs text-slate-400 mt-1">
              支持中国大陆手机号或固定电话(可带分机)
            </Text>
          </View>
        </CardContent>
      </Card>

      {/* 地图位置 */}
      <Card className="mx-4 mb-3">
        <CardContent className="p-4">
          <View className="flex items-center justify-between mb-3">
            <View className="flex items-center gap-2">
              <MapPin size={18} color="#2088D8" />
              <Text className="block text-base font-semibold text-slate-800">
                地图位置 <Text className="text-red-500">*</Text>
              </Text>
            </View>
            {isMiniApp && (
              <Button size="sm" onClick={handleChooseLocation}>
                <View className="flex items-center gap-1">
                  <Pencil size={14} color="#fff" />
                  <Text className="block text-sm">定位选点</Text>
                </View>
              </Button>
            )}
          </View>

          {poiName || formattedAddress ? (
            <View className="bg-blue-50 rounded-lg p-3">
              <Text className="block text-sm font-medium text-slate-800 mb-1">
                {poiName || formattedAddress}
              </Text>
              {formattedAddress && poiName !== formattedAddress && (
                <Text className="block text-xs text-slate-500">
                  {formattedAddress}
                </Text>
              )}
              <Text className="block text-xs text-slate-400 mt-1">
                经纬度: {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </Text>
            </View>
          ) : (
            <View className="bg-slate-100 rounded-lg p-4 flex items-center justify-center">
              <Text className="block text-sm text-slate-400">
                {isMiniApp ? '点击右上角"定位选点"获取位置' : '请手动填写 POI 与经纬度'}
              </Text>
            </View>
          )}

          {!isMiniApp && (
            <View className="mt-3 space-y-2">
              <Text className="block text-xs text-slate-500">手动填写(开发阶段)</Text>
              <View className="flex gap-2">
                <View className="flex-1 bg-slate-50 rounded-lg px-3 py-1">
                  <Input
                    className="w-full bg-transparent border-0 text-xs"
                    placeholder="POI 名称"
                    value={poiName}
                    onInput={(e) => setPoiName(e.detail.value)}
                  />
                </View>
              </View>
              <View className="flex gap-2">
                <View className="flex-1 bg-slate-50 rounded-lg px-3 py-1">
                  <Input
                    className="w-full bg-transparent border-0 text-xs"
                    placeholder="纬度"
                    type="number"
                    value={latitude ? String(latitude) : ''}
                    onInput={(e) => setLatitude(Number(e.detail.value) || 0)}
                  />
                </View>
                <View className="flex-1 bg-slate-50 rounded-lg px-3 py-1">
                  <Input
                    className="w-full bg-transparent border-0 text-xs"
                    placeholder="经度"
                    type="number"
                    value={longitude ? String(longitude) : ''}
                    onInput={(e) => setLongitude(Number(e.detail.value) || 0)}
                  />
                </View>
              </View>
              <View className="flex gap-2">
                <View className="flex-1 bg-slate-50 rounded-lg px-3 py-1">
                  <Input
                    className="w-full bg-transparent border-0 text-xs"
                    placeholder="省"
                    value={province}
                    onInput={(e) => setProvince(e.detail.value)}
                  />
                </View>
                <View className="flex-1 bg-slate-50 rounded-lg px-3 py-1">
                  <Input
                    className="w-full bg-transparent border-0 text-xs"
                    placeholder="市"
                    value={city}
                    onInput={(e) => setCity(e.detail.value)}
                  />
                </View>
                <View className="flex-1 bg-slate-50 rounded-lg px-3 py-1">
                  <Input
                    className="w-full bg-transparent border-0 text-xs"
                    placeholder="区"
                    value={district}
                    onInput={(e) => setDistrict(e.detail.value)}
                  />
                </View>
              </View>
            </View>
          )}

          {mapPickerFailed && (
            <View className="mt-3 bg-amber-50 rounded-lg p-3 flex items-start gap-2">
              <TriangleAlert size={14} color="#F59E0B" className="mt-1 shrink-0" />
              <Text className="block text-xs text-amber-700">
                地图选点未授权或失败,请确认已开启位置权限
              </Text>
            </View>
          )}
        </CardContent>
      </Card>

      {/* 详细门牌 */}
      <Card className="mx-4 mb-3">
        <CardContent className="p-4">
          <View>
            <Text className="block text-sm font-medium text-slate-700 mb-2">
              楼栋 / 楼层 / 门牌号 <Text className="text-red-500">*</Text>
            </Text>
            <View className="bg-slate-50 rounded-lg px-3 py-1">
              <Input
                className="w-full bg-transparent border-0 focus-within:ring-0 focus-within:border-0"
                placeholder="如:3 号楼 2 单元 801 室"
                value={detailAddress}
                onInput={(e) => setDetailAddress(e.detail.value)}
                maxlength={100}
              />
            </View>
            <Text className="block text-xs text-slate-400 mt-1">
              地图只能定位到 POI,门牌/楼层/房间号请手填
            </Text>
          </View>
        </CardContent>
      </Card>

      {/* 标签 + 默认 */}
      <Card className="mx-4 mb-3">
        <CardContent className="p-4 space-y-4">
          <View>
            <Text className="block text-sm font-medium text-slate-700 mb-2">地址标签</Text>
            <ToggleGroup
              type="single"
              value={label}
              onValueChange={(v) => {
                if (v && typeof v === 'string') setLabel(v as AddressLabel)
              }}
              className="flex-wrap gap-2"
            >
              {TAG_OPTIONS.map(opt => (
                <ToggleGroupItem
                  key={opt.value}
                  value={opt.value}
                  className="rounded-full px-4 py-1 text-sm"
                >
                  <Text className="block">{opt.label}</Text>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </View>

          <View>
            <Text className="block text-sm font-medium text-slate-700 mb-2">使用场景</Text>
            <ToggleGroup
              type="single"
              value={usageType}
              onValueChange={(v) => {
                if (v && typeof v === 'string') setUsageType(v as AddressUsage)
              }}
              className="flex-wrap gap-2"
            >
              <ToggleGroupItem value="sender" className="rounded-full px-4 py-1 text-sm">
                <Text className="block">寄件</Text>
              </ToggleGroupItem>
              <ToggleGroupItem value="receiver" className="rounded-full px-4 py-1 text-sm">
                <Text className="block">收件</Text>
              </ToggleGroupItem>
              <ToggleGroupItem value="both" className="rounded-full px-4 py-1 text-sm">
                <Text className="block">通用</Text>
              </ToggleGroupItem>
            </ToggleGroup>
          </View>

          <View className="flex items-center justify-between">
            <Text className="block text-sm font-medium text-slate-700">设为默认地址</Text>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </View>
        </CardContent>
      </Card>

      {/* 底部保存按钮(bottom:50 避开 TabBar,inline style 兼容 H5) */}
      <View
        style={{
          position: 'fixed',
          bottom: 50,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'row',
          padding: '12px 16px',
          backgroundColor: '#fff',
          borderTop: '1px solid #e5e5e5',
          zIndex: 100,
        }}
      >
        <Button
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
          disabled={saving}
          onClick={handleSave}
        >
          <Text className="block text-base">{saving ? '保存中…' : '保存地址'}</Text>
        </Button>
      </View>
    </View>
  )
}

export default AddressEditPage
