import { Text, View } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { adminRequest, getAdminInfo } from '@/services/admin-api'
import { useSWR } from '@/stores/data-cache'

type Vehicle = { id: string; name: string; fullName: string; enabled: boolean; sortOrder: number }
type PricingInfo = Record<string, any>

export default function AdminSettings() {
  const role = getAdminInfo()?.role

  // 使用 useSWR 缓存车型数据，session 类别（2 min TTL），避免每次打开都重新请求
  const { data: vehicles, loading: loadingVehicles, error: vehiclesError } = useSWR<Vehicle[]>(
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

  return (
    <View className="min-h-screen bg-slate-50 p-4 space-y-3">
      <Card><CardContent className="p-4">
        <Text className="block text-lg font-semibold">运营设置</Text>
        <Text className="block mt-1 text-sm text-slate-500">当前角色：{role}。修改车型、图片和发布计费规则仅限超级管理员。</Text>
      </CardContent></Card>

      {error && <Text className="block text-red-600">{error?.message || String(error)}</Text>}

      <Card><CardContent className="p-4 space-y-3">
        <Text className="block font-semibold">车型状态</Text>
        {loadingVehicles ? (
          <View className="space-y-3">
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
            <View key={vehicle.id} className="flex justify-between border-b border-slate-100 py-2">
              <View>
                <Text className="block text-sm">{vehicle.name}</Text>
                <Text className="block text-xs text-slate-500">{vehicle.fullName}</Text>
              </View>
              <Badge variant={vehicle.enabled ? 'default' : 'secondary'}>{vehicle.enabled ? '已上架' : '已下架'}</Badge>
            </View>
          ))
        ) : (
          <Text className="block text-sm text-slate-400">暂无车型数据</Text>
        )}
      </CardContent></Card>

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
        <Text className="block mt-3 text-xs text-slate-500">本页用于移动端查看配置；图片上传和复杂字段编辑继续在电脑网页后台完成，避免小程序误操作。</Text>
      </CardContent></Card>
    </View>
  )
}
