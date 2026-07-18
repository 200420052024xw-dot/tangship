import { PropsWithChildren } from 'react';
import Taro, { useLaunch } from '@tarojs/taro';
import { LucideTaroProvider } from 'lucide-react-taro';
import '@/app.css';
import { Toaster } from '@/components/ui/toast';
import { bootstrapIdentity } from '@/services/consumer-api';
import { exchangeAdminSession } from '@/services/admin-api';
import { Preset } from './presets';

const App = ({ children }: PropsWithChildren) => {
  useLaunch(() => { void bootstrapIdentity().then(async identity => { if ('adminAccess' in identity && identity.adminAccess) { await exchangeAdminSession(); await Taro.reLaunch({ url: '/pages-admin/dashboard/index' }) } }).catch(reason => { void Taro.showToast({ title: reason instanceof Error ? reason.message : '身份初始化失败', icon: 'none' }) }) })
  return (
    <LucideTaroProvider defaultColor="#000" defaultSize={24}>
      <Preset>{children}</Preset>
      <Toaster />
    </LucideTaroProvider>
  );
};

export default App;
