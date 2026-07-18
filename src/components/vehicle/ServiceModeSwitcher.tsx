import { Text, View } from '@tarojs/components'
import type { FC } from 'react'
import { Calendar, Car, Package } from 'lucide-react-taro'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { VehicleMode } from '@/types/vehicle'

export type ServiceMode = Extract<VehicleMode, 'single' | 'monthly' | 'rental'>
interface Props { value: ServiceMode; onChange: (next: ServiceMode) => void }
export const ServiceModeSwitcher: FC<Props> = ({ value, onChange }) => (
  <View className="sticky top-0 z-50 bg-white shadow-sm">
    <Tabs value={value} onValueChange={v => onChange(v as ServiceMode)} className="w-full">
      <TabsList className="w-full h-12 bg-slate-50 rounded-none p-0 flex">
        <TabsTrigger value="single" className="flex-1 h-12 rounded-none">
          <View className="flex flex-col items-center gap-1"><Package size={18} color={value === 'single' ? '#2088D8' : '#94A3B8'} /><Text className="block text-xs font-medium">按趟结算</Text></View>
        </TabsTrigger>
        <TabsTrigger value="monthly" className="flex-1 h-12 rounded-none">
          <View className="flex flex-col items-center gap-1"><Calendar size={18} color={value === 'monthly' ? '#2088D8' : '#94A3B8'} /><Text className="block text-xs font-medium">包月专线</Text></View>
        </TabsTrigger>
        <TabsTrigger value="rental" className="flex-1 h-12 rounded-none">
          <View className="flex flex-col items-center gap-1"><Car size={18} color={value === 'rental' ? '#2088D8' : '#94A3B8'} /><Text className="block text-xs font-medium">租购服务</Text></View>
        </TabsTrigger>
      </TabsList>
      <View className="relative h-1 bg-slate-100"><View className="absolute h-1 bg-blue-600 rounded-full transition-all duration-300" style={{ width: '33.33%', left: value === 'single' ? '0%' : value === 'monthly' ? '33.33%' : '66.66%' }} /></View>
    </Tabs>
  </View>
)
