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
    proxy: {
      // BE-08：上传接口（OSS 适配层 local mock）返回相对 URL /uploads/...，
      // 开发态由 vite 代理到后端静态目录，图片预览无需拼后端 origin；
      // 生产态由部署侧反向代理统一转发（与 /api 同源约定一致）
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
