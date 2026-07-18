export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationStyle: 'custom', navigationBarTitleText: '地址簿' })
  : { navigationStyle: 'custom', navigationBarTitleText: '地址簿' }
