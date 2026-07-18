export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationStyle: 'custom', navigationBarTitleText: '编辑地址' })
  : { navigationStyle: 'custom', navigationBarTitleText: '编辑地址' }
