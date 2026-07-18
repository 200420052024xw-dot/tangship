export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '唐小识无人配送',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black',
      backgroundColor: '#F8FAFB',
    })
  : {
      navigationBarTitleText: '唐小识无人配送',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black',
      backgroundColor: '#F8FAFB',
    }