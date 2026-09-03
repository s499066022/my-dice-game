// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { initEcho } from './api/reverb'

// 初始化 Laravel Reverb 长连接（无后端/未配置时优雅降级为本地存储）
initEcho()

const app = createApp(App)
app.use(router)
app.use(ElementPlus)
app.mount('#app')