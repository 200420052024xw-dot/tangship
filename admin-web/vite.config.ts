import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 独立部署到 CloudBase 静态托管:根域名访问,所有静态资源走 '/'
// 如需继续走 NestJS /admin/ 集成部署,把 base 改回 '/admin/'
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: '../server/dist/public/admin',
    emptyOutDir: false,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})