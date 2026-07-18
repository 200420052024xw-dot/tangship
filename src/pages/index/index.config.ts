export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationStyle: 'custom',
      backgroundColor: '#F8FAFB',
    })
  : {
      navigationStyle: 'custom',
      backgroundColor: '#F8FAFB',
    }