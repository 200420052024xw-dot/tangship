export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '唐小识无人配送',
      backgroundColor: '#F8FAFB',
    })
  : {
      navigationBarTitleText: '唐小识无人配送',
      backgroundColor: '#F8FAFB',
    }
