import { createApp } from 'vue'
import { createPinia } from 'pinia' // 1. 引入 Pinia
import './style.css'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia() // 2. 创建实例

app.use(pinia) // 3. 插件注册
app.mount('#app')