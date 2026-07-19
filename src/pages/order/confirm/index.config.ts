export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationStyle: 'custom', navigationBarTitleText: '核对下单信息' })
  : { navigationStyle: 'custom', navigationBarTitleText: '核对下单信息' }
