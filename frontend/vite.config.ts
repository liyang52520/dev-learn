import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // 生产可挂在子路径（如 /dev-learn/）；本地开发保持根路径。
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [
    react(),
    {
      // public/disguise 是独立静态页；开发服务器不会给目录补 index.html，会落到 SPA 404。
      name: 'disguise-index',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const url = req.url?.split('?')[0]
          if (url === '/disguise' || url === '/disguise/') {
            req.url = '/disguise/index.html'
          }
          next()
        })
      },
    },
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/images': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      // 只代理证据截图，不要吞掉 /study 这个前端路由
      '^/study/.*\\.(?:png|jpe?g|webp|gif|svg)$': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
})
