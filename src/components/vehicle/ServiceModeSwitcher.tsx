import { Text, View } from '@tarojs/components'
import type { FC } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { VehicleMode } from '@/types/vehicle'

export type ServiceMode = Extract<VehicleMode, 'single' | 'monthly' | 'rental'>
interface Props { value: ServiceMode; onChange: (next: ServiceMode) => void }
export const ServiceModeSwitcher: FC<Props> = ({ value, onChange }) => (
  <View className="bg-white">
    <Tabs value={value} onValueChange={v => onChange(v as ServiceMode)} className="w-full">
      <TabsList className="flex h-12 w-full rounded-xl bg-slate-100 p-1">
        <TabsTrigger value="single" className="h-10 flex-1 rounded-lg">
          <Text className="block text-sm font-medium">按趟配送</Text>
        </TabsTrigger>
        <TabsTrigger value="monthly" className="h-10 flex-1 rounded-lg">
          <Text className="block text-sm font-medium">包月专线</Text>
        </TabsTrigger>
        <TabsTrigger value="rental" className="h-10 flex-1 rounded-lg">
          <Text className="block text-sm font-medium">租购服务</Text>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  </View>
)
