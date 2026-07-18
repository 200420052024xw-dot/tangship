export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '我的订单',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black',
      backgroundColor: '#F8FAFB',
    })
  : {
      navigationBarTitleText: '我的订单',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black',
      backgroundColor: '#F8FAFB',
    }