<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import { useAuthStore } from '@/stores/auth'
import { en } from '@/i18n/en'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const email = ref('')
const sent = ref(false)
const submitting = ref(false)
const localError = ref<string | null>(null)

async function submit() {
  if (!email.value.trim() || submitting.value) return
  submitting.value = true
  localError.value = null
  try {
    await auth.signInWithEmail(email.value.trim())
    sent.value = true
  } catch (error) {
    localError.value = error instanceof Error ? error.message : en.common.error
  } finally {
    submitting.value = false
  }
}

function goBack() {
  const next = typeof route.query.next === 'string' ? route.query.next : '/'
  void router.push(next)
}
</script>

<template>
  <div class="mx-auto w-full max-w-md px-5 pt-10 pb-24">
    <header class="mb-6">
      <p class="text-ink-muted text-xs tracking-widest uppercase">{{ en.auth.header }}</p>
      <h1 class="text-2xl font-semibold mt-1">{{ en.auth.title }}</h1>
      <p class="text-ink-muted text-sm mt-2">{{ en.auth.subtitle }}</p>
    </header>

    <Card padded elevated>
      <template v-if="!auth.configured">
        <p class="text-ink-muted text-sm">{{ en.auth.notConfigured }}</p>
      </template>

      <template v-else-if="sent">
        <p class="font-medium">{{ en.auth.checkInbox }}</p>
        <p class="text-ink-muted text-sm mt-2">{{ en.auth.checkInboxBody(email) }}</p>
        <Button variant="ghost" size="sm" class="mt-4" @click="goBack">{{ en.auth.back }}</Button>
      </template>

      <form v-else class="space-y-3" @submit.prevent="submit">
        <label class="block">
          <span class="text-ink-muted text-xs tracking-widest uppercase">
            {{ en.auth.emailLabel }}
          </span>
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            inputmode="email"
            :placeholder="en.auth.emailPlaceholder"
            class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-12 px-3 text-base"
          />
        </label>
        <Button type="submit" variant="primary" size="lg" block :disabled="submitting">
          {{ submitting ? en.common.loading : en.auth.sendLink }}
        </Button>
        <p v-if="localError" class="text-danger text-sm">{{ localError }}</p>
      </form>
    </Card>

    <p class="text-ink-muted text-xs mt-6 leading-relaxed">{{ en.auth.privacy }}</p>
  </div>
</template>
