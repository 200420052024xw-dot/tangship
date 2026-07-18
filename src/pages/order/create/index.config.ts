export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationStyle: 'custom', navigationBarTitleText: '下单' })
  : { navigationStyle: 'custom', navigationBarTitleText: '下单' }
