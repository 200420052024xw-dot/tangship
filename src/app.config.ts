export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/orders/index',
    'pages/profile/index',
    'pages/address/list/index',
    'pages/address/edit/index',
    'pages/vehicle/detail/index',
    'pages/order/create/index',
    'pages/order/confirm/index',
    'pages/order/detail/index',
    'pages/inquiry/monthly/index',
    'pages/inquiry/rental/index',
    'pages/inquiry/select-vehicle/index'
  ],
  subPackages: [{
    root: 'pages-admin',
    pages: ['dashboard/index', 'orders/index', 'order-detail/index', 'reviews/index', 'inquiries/index', 'notifications/index', 'settings/index']
  }],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '唐小识无人配送',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F8FAFB'
  },
  permission: {
    'scope.userLocation': {
      desc: '用于选择配送地址'
    }
  },
  requiredPrivateInfos: ['chooseLocation', 'getLocation'],
  tabBar: {
    color: '#94A3B8',
    selectedColor: '#2088D8',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '下单',
        iconPath: './assets/tabbar/package.png',
        selectedIconPath: './assets/tabbar/package-active.png'
      },
      {
        pagePath: 'pages/orders/index',
        text: '订单',
        iconPath: './assets/tabbar/clipboard-list.png',
        selectedIconPath: './assets/tabbar/clipboard-list-active.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: './assets/tabbar/user.png',
        selectedIconPath: './assets/tabbar/user-active.png'
      }
    ]
  }
})
