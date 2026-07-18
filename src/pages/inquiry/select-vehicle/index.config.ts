export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '选择车型' })
  : { navigationBarTitleText: '选择车型' }
