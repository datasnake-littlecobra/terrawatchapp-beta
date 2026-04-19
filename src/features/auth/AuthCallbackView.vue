<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/services/supabase'
import { en } from '@/i18n/en'

const auth = useAuthStore()
const router = useRouter()
const status = ref<'working' | 'ok' | 'error'>('working')
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  if (!supabase) {
    status.value = 'error'
    errorMessage.value = en.auth.notConfigured
    return
  }
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    auth.setSession(data.session)
    if (data.session) {
      status.value = 'ok'
      setTimeout(() => void router.replace('/'), 400)
    } else {
      status.value = 'error'
      errorMessage.value = en.auth.callbackNoSession
    }
  } catch (e) {
    status.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : en.common.error
  }
})
</script>

<template>
  <div class="mx-auto w-full max-w-md px-5 pt-16 text-center">
    <p v-if="status === 'working'" class="text-ink-muted">{{ en.auth.finishingSignIn }}</p>
    <p v-else-if="status === 'ok'" class="text-safe">{{ en.auth.signedIn }}</p>
    <div v-else>
      <p class="text-danger">{{ errorMessage ?? en.common.error }}</p>
      <RouterLink to="/auth/sign-in" class="text-accent text-sm mt-3 inline-block">
        {{ en.auth.tryAgain }}
      </RouterLink>
    </div>
  </div>
</template>
