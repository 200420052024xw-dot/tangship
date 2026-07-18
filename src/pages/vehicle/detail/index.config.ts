export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationStyle: 'custom', navigationBarTitleText: '车型详情' })
  : { navigationStyle: 'custom', navigationBarTitleText: '车型详情' }
