import { Image, Text, View } from '@tarojs/components'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { adminRequest, adminUploadFile, getAdminInfo } from '@/services/admin-api'
import { useSWR } from '@/stores/data-cache'
import { Plus, Trash2, Star, ChevronRight } from 'lucide-react-taro'

type VehicleImage = { id: string; url: string; objectKey: string; isPrimary: boolean; sortOrder: number }
type Vehicle = { id: string; name: string; fullName: string; enabled: boolean; sortOrder: number; serviceMode: string; imageItems?: VehicleImage[] }
type PricingInfo = Record<string, any>

const isSuperAdmin = () => getAdminInfo()?.role === 'super_admin'

export default function AdminSettings() {
  const role = getAdminInfo()?.role
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const { data: vehicles, loading: loadingVehicles, error: vehiclesError, refresh: refreshVehicles } = useSWR<Vehicle[]>(
    'admin-vehicles', async () => {
      const result = await adminRequest<Vehicle[]>({ url: '/api/admin/operations/vehicles' })
      return result || []
    }, 'session'
  )

  const { data: pricing, loading: loadingPricing, error: pricingError } = useSWR<PricingInfo>(
    'admin-pricing', async () => {
      return await adminRequest<PricingInfo>({ url: '/api/admin/operations/pricing' })
    }, 'session'
  )

  const error = vehiclesError || pricingError
  const vehicleList = vehicles || []

  /** 上传图片到 TOS，然后关联到车型 */
  const handleAddImage = async (vehicleId: string) => {
    if (!isSuperAdmin()) {
      Taro.showToast({ title: '仅超级管理员可操作', icon: 'none' })
      return
    }
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      const tempFilePath = res.tempFilePaths[0]
      setUploading(true)
      Taro.showLoading({ title: '上传中...' })

      // Step 1: 上传文件到 TOS
      const uploadResult = await adminUploadFile({
        url: '/api/admin/operations/upload',
        filePath: tempFilePath,
        name: 'file',
      })
      console.log('[AdminSettings] upload result:', uploadResult)

      // Step 2: 关联图片到车型
      await adminRequest({
        url: `/api/admin/operations/vehicles/${vehicleId}/images`,
        method: 'POST',
        data: {
          url: uploadResult.url,
          objectKey: uploadResult.objectKey,
          isPrimary: false,
          sortOrder: 0,
        },
      })

      Taro.hideLoading()
      Taro.showToast({ title: '图片已添加', icon: 'success' })
      refreshVehicles()
    } catch (err: any) {
      Taro.hideLoading()
      Taro.showToast({ title: err?.message || '上传失败', icon: 'none' })
    } finally {
      setUploading(false)
    }
  }

  /** 删除车型图片 */
  const handleDeleteImage = async (vehicleId: string, imageId: string) => {
    if (!isSuperAdmin()) return
    try {
      await adminRequest({
        url: `/api/admin/operations/vehicles/${vehicleId}/images/${imageId}`,
        method: 'DELETE',
      })
      Taro.showToast({ title: '已删除', icon: 'success' })
      refreshVehicles()
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '删除失败', icon: 'none' })
    }
  }

  /** 设为主图 */
  const handleSetPrimary = async (vehicleId: string, imageId: string, url: string, objectKey: string) => {
    if (!isSuperAdmin()) return
    try {
      // 先删除旧图再重新添加为主图
      await adminRequest({
        url: `/api/admin/operations/vehicles/${vehicleId}/images/${imageId}`,
        method: 'DELETE',
      })
      await adminRequest({
        url: `/api/admin/operations/vehicles/${vehicleId}/images`,
        method: 'POST',
        data: { url, objectKey, isPrimary: true, sortOrder: 0 },
      })
      Taro.showToast({ title: '已设为主图', icon: 'success' })
      refreshVehicles()
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '操作失败', icon: 'none' })
    }
  }

  /** 切换上架/下架 */
  const handleToggleEnabled = async (vehicle: Vehicle) => {
    if (!isSuperAdmin()) {
      Taro.showToast({ title: '仅超级管理员可操作', icon: 'none' })
      return
    }
    try {
      await adminRequest({
        url: `/api/admin/operations/vehicles/${vehicle.id}`,
        method: 'PUT',
        data: { ...vehicle, enabled: !vehicle.enabled },
      })
      Taro.showToast({ title: vehicle.enabled ? '已下架' : '已上架', icon: 'success' })
      refreshVehicles()
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '操作失败', icon: 'none' })
    }
  }

  const toggleExpand = (id: string) => setExpandedId(expandedId === id ? null : id)

  return (
    <View className="min-h-screen bg-slate-50 p-4 space-y-3">
      <Card><CardContent className="p-4">
        <Text className="block text-lg font-semibold">运营设置</Text>
        <Text className="block mt-1 text-sm text-slate-500">当前角色：{role}</Text>
      </CardContent></Card>

      {error && <Text className="block text-red-600">{error?.message || String(error)}</Text>}

      {/* 车型管理 */}
      <Card><CardContent className="p-4 space-y-2">
        <Text className="block font-semibold">车型管理</Text>
        <Text className="block text-xs text-slate-400">点击车型展开图片管理</Text>
        {loadingVehicles ? (
          <View className="space-y-3 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={i} className="flex justify-between py-2">
                <View className="space-y-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-32" />
                </View>
                <Skeleton className="h-5 w-12 rounded-full" />
              </View>
            ))}
          </View>
        ) : vehicleList.length > 0 ? (
          vehicleList.map(vehicle => (
            <View key={vehicle.id}>
              {/* 车型行 */}
              <View
                className="flex items-center justify-between border-b border-slate-100 py-2"
                onClick={() => toggleExpand(vehicle.id)}
              >
                <View className="flex-1">
                  <Text className="block text-sm">{vehicle.name}</Text>
                  <Text className="block text-xs text-slate-500">{vehicle.fullName}</Text>
                </View>
                <View className="flex items-center gap-2">
                  <Badge variant={vehicle.enabled ? 'default' : 'secondary'}>
                    {vehicle.enabled ? '已上架' : '已下架'}
                  </Badge>
                  <ChevronRight size={16} color="#94a3b8" />
                </View>
              </View>

              {/* 展开的图片管理区 */}
              {expandedId === vehicle.id && (
                <View className="bg-slate-50 rounded-lg p-3 mt-1 mb-2 space-y-3">
                  {/* 上架开关 */}
                  {isSuperAdmin() && (
                    <View className="flex items-center justify-between">
                      <Text className="block text-sm text-slate-700">上架状态</Text>
                      <Switch
                        checked={vehicle.enabled}
                        onCheckedChange={() => handleToggleEnabled(vehicle)}
                      />
                    </View>
                  )}

                  {/* 图片列表 */}
                  <View>
                    <Text className="block text-sm font-medium text-slate-700 mb-2">车型图片 ({vehicle.imageItems?.length || 0})</Text>
                    <View className="flex flex-wrap gap-2">
                      {/* 现有图片 */}
                      {(vehicle.imageItems || []).map(img => (
                        <View key={img.id} className="relative">
                          <Image
                            className="rounded-lg border border-slate-200"
                            style={{ width: '72px', height: '72px' }}
                            mode="aspectFill"
                            src={img.url}
                          />
                          {/* 主图标记 */}
                          {img.isPrimary && (
                            <View className="absolute top-0 left-0 bg-blue-600 rounded-tl-lg rounded-br-sm px-1">
                              <Star size={10} color="#fff" />
                            </View>
                          )}
                          {/* 操作按钮 */}
                          {isSuperAdmin() && (
                            <View className="absolute -top-1 -right-1 flex gap-0.5">
                              {!img.isPrimary && (
                                <View
                                  className="bg-blue-500 rounded-full p-1"
                                  onClick={() => handleSetPrimary(vehicle.id, img.id, img.url, img.objectKey)}
                                >
                                  <Star size={10} color="#fff" />
                                </View>
                              )}
                              <View
                                className="bg-red-500 rounded-full p-1"
                                onClick={() => handleDeleteImage(vehicle.id, img.id)}
                              >
                                <Trash2 size={10} color="#fff" />
                              </View>
                            </View>
                          )}
                        </View>
                      ))}
                      {/* 添加图片按钮 */}
                      {isSuperAdmin() && (
                        <View
                          className="flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white"
                          style={{ width: '72px', height: '72px' }}
                          onClick={() => !uploading && handleAddImage(vehicle.id)}
                        >
                          <Plus size={20} color="#94a3b8" />
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              )}
            </View>
          ))
        ) : (
          <Text className="block text-sm text-slate-400">暂无车型数据</Text>
        )}
      </CardContent></Card>

      {/* 计费版本 */}
      <Card><CardContent className="p-4">
        <Text className="block font-semibold">计费版本</Text>
        {loadingPricing ? (
          <View className="mt-2 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </View>
        ) : (
          <>
            <Text className="block mt-2 text-sm">已发布：{pricing?.published?.version ?? '暂无'}</Text>
            <Text className="block mt-1 text-sm">草稿：{pricing?.draft?.version ?? '暂无'}</Text>
          </>
        )}
      </CardContent></Card>
    </View>
  )
}
