import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './app/App.vue'
import { router } from './app/router'
import { useAuthStore } from './stores/auth'
import './app/styles.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// Initialize auth before mount so protected UIs render the right state on first paint.
void useAuthStore(pinia).init()

app.mount('#app')
