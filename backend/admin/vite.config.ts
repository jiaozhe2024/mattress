import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// 开发端口固定 8080：后端 CORS 白名单只放行 localhost:3000 / localhost:8080
// （3000 已被本机其他服务占用，见 BE-03 sprint_output）
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 8080,
  },
})
