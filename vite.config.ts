// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue() // 必须添加这个插件来处理 .vue 文件
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  base: '/',
  server: {
    // 开发时把 /api 转发到本机 Laravel 后端（若后端未启动，前端会自动降级为本地存储）
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:12226',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
