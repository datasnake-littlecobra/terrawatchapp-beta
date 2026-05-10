<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import { useAuthStore } from '@/stores/auth'
import { en } from '@/i18n/en'

// Phase 10: password-reset landing page. Supabase's resetPasswordForEmail
// sends a recovery link that lands here with a temporary session — we just
// need to call updateUser({ password }) once the user picks a new one.
//
// If the user lands here without a session (link expired, direct URL),
// kick them back to the sign-in page with an error.

const auth = useAuthStore()
const router = useRouter()

const password = ref('')
const passwordConfirm = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)
const success = ref(false)
const ready = ref(false)

onMounted(async () => {
  // Wait for the auth store to hydrate. The recovery link drops a session
  // into the SDK that the store picks up via onAuthStateChange.
  await auth.init()
  if (!auth.isAuthed) {
    error.value = en.auth.callbackNoSession
  }
  ready.value = true
})

async function submit() {
  if (submitting.value) return
  error.value = null

  if (password.value.length < 8) {
    error.value = en.auth.pwTooShort
    return
  }
  if (password.value !== passwordConfirm.value) {
    error.value = en.auth.pwMismatch
    return
  }

  submitting.value = true
  try {
    await auth.updatePassword(password.value)
    success.value = true
    setTimeout(() => void router.replace('/'), 800)
  } catch (e) {
    error.value = e instanceof Error ? e.message : en.common.error
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-md px-5 pt-10 pb-24">
    <header class="mb-6">
      <p class="text-ink-muted text-xs tracking-widest uppercase">{{ en.auth.header }}</p>
      <h1 class="text-2xl font-semibold mt-1">{{ en.auth.resetTitle }}</h1>
      <p class="text-ink-muted text-sm mt-2">{{ en.auth.resetSubtitle }}</p>
    </header>

    <Card padded elevated>
      <p v-if="!ready" class="text-ink-muted text-sm">{{ en.common.loading }}</p>

      <p v-else-if="success" class="text-safe">{{ en.auth.resetSuccess }}</p>

      <template v-else-if="!auth.isAuthed">
        <p class="text-danger text-sm">{{ error ?? en.auth.callbackNoSession }}</p>
        <RouterLink to="/auth/sign-in" class="text-accent text-sm mt-3 inline-block">
          {{ en.auth.tryAgain }}
        </RouterLink>
      </template>

      <form v-else class="space-y-3" @submit.prevent="submit">
        <label class="block">
          <span class="text-ink-muted text-xs tracking-widest uppercase">New password</span>
          <input
            v-model="password"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
            :placeholder="en.auth.passwordPlaceholder"
            class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-12 px-3 text-base"
          />
        </label>
        <label class="block">
          <span class="text-ink-muted text-xs tracking-widest uppercase">Confirm password</span>
          <input
            v-model="passwordConfirm"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
            :placeholder="en.auth.passwordPlaceholder"
            class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-12 px-3 text-base"
          />
        </label>
        <Button type="submit" variant="primary" size="lg" block :disabled="submitting">
          {{ submitting ? en.common.loading : en.auth.resetCta }}
        </Button>
        <p v-if="error" class="text-danger text-sm">{{ error }}</p>
      </form>
    </Card>
  </div>
</template>
