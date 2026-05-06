<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import { useAuthStore } from '@/stores/auth'
import { en } from '@/i18n/en'

// Phase 10: triple-mode sign-in. The default is email+password (lowest
// friction for return users). 'magic' falls back to the OTP link flow we
// shipped in Phase 7. 'reset' is the forgot-password sub-flow. Google
// OAuth sits above all three as a one-click option that handles new and
// returning users transparently.

type Mode = 'password' | 'magic' | 'reset'
type Variant = 'signIn' | 'signUp'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const mode = ref<Mode>('password')
const variant = ref<Variant>('signIn')

const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const submitting = ref(false)
const localError = ref<string | null>(null)

// Post-submit success states ------------------------------------------------
const magicSent = ref(false)
const confirmEmailSent = ref(false)
const resetSent = ref(false)

const title = computed(() => {
  if (mode.value === 'reset') return en.auth.resetTitle
  return en.auth.title
})
const subtitle = computed(() => {
  if (mode.value === 'reset') return en.auth.resetSubtitle
  return en.auth.subtitle
})

async function withSubmitting(fn: () => Promise<void>) {
  if (submitting.value) return
  submitting.value = true
  localError.value = null
  try {
    await fn()
  } catch (error) {
    localError.value = error instanceof Error ? error.message : en.common.error
  } finally {
    submitting.value = false
  }
}

async function submitMagic() {
  await withSubmitting(async () => {
    if (!email.value.trim()) return
    await auth.signInWithEmail(email.value.trim())
    magicSent.value = true
  })
}

async function submitPassword() {
  await withSubmitting(async () => {
    const e = email.value.trim()
    const p = password.value
    if (!e || !p) return
    if (variant.value === 'signUp') {
      if (p.length < 8) {
        localError.value = en.auth.pwTooShort
        return
      }
      if (p !== passwordConfirm.value) {
        localError.value = en.auth.pwMismatch
        return
      }
      const { requiresConfirmation } = await auth.signUpWithPassword(e, p)
      if (requiresConfirmation) {
        confirmEmailSent.value = true
        return
      }
      goNext()
    } else {
      await auth.signInWithPassword(e, p)
      goNext()
    }
  })
}

async function submitGoogle() {
  await withSubmitting(async () => {
    await auth.signInWithGoogle()
    // No goNext() — browser navigates away to Google.
  })
}

async function submitReset() {
  await withSubmitting(async () => {
    if (!email.value.trim()) return
    await auth.resetPasswordForEmail(email.value.trim())
    resetSent.value = true
  })
}

function goNext() {
  const next = typeof route.query.next === 'string' ? route.query.next : '/'
  void router.push(next)
}

function goBack() {
  goNext()
}

function switchMode(m: Mode) {
  mode.value = m
  localError.value = null
  magicSent.value = false
  confirmEmailSent.value = false
  resetSent.value = false
}

function switchVariant(v: Variant) {
  variant.value = v
  localError.value = null
  password.value = ''
  passwordConfirm.value = ''
}
</script>

<template>
  <div class="mx-auto w-full max-w-md px-5 pt-10 pb-24">
    <header class="mb-6">
      <p class="text-ink-muted text-xs tracking-widest uppercase">{{ en.auth.header }}</p>
      <h1 class="text-2xl font-semibold mt-1">{{ title }}</h1>
      <p class="text-ink-muted text-sm mt-2">{{ subtitle }}</p>
    </header>

    <Card padded elevated>
      <!-- Not configured -->
      <p v-if="!auth.configured" class="text-ink-muted text-sm">
        {{ en.auth.notConfigured }}
      </p>

      <!-- Magic-link sent confirmation -->
      <template v-else-if="magicSent">
        <p class="font-medium">{{ en.auth.checkInbox }}</p>
        <p class="text-ink-muted text-sm mt-2">{{ en.auth.checkInboxBody(email) }}</p>
        <Button variant="ghost" size="sm" class="mt-4" @click="goBack">{{ en.auth.back }}</Button>
      </template>

      <!-- Sign-up confirmation -->
      <template v-else-if="confirmEmailSent">
        <p class="font-medium">{{ en.auth.confirmEmailTitle }}</p>
        <p class="text-ink-muted text-sm mt-2">{{ en.auth.confirmEmailBody(email) }}</p>
        <Button variant="ghost" size="sm" class="mt-4" @click="goBack">{{ en.auth.back }}</Button>
      </template>

      <!-- Reset link sent -->
      <template v-else-if="resetSent">
        <p class="font-medium">{{ en.auth.resetSentTitle }}</p>
        <p class="text-ink-muted text-sm mt-2">{{ en.auth.resetSentBody(email) }}</p>
        <Button variant="ghost" size="sm" class="mt-4" @click="switchMode('password')">{{ en.auth.back }}</Button>
      </template>

      <!-- Reset request mode (entering email for reset link) -->
      <template v-else-if="mode === 'reset'">
        <form class="space-y-3" @submit.prevent="submitReset">
          <label class="block">
            <span class="text-ink-muted text-xs tracking-widest uppercase">{{ en.auth.emailLabel }}</span>
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              :placeholder="en.auth.emailPlaceholder"
              class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-12 px-3 text-base"
            />
          </label>
          <Button type="submit" variant="primary" size="lg" block :disabled="submitting">
            {{ submitting ? en.common.loading : en.auth.sendLink }}
          </Button>
          <p v-if="localError" class="text-danger text-sm">{{ localError }}</p>
          <button
            type="button"
            class="block w-full text-center text-sm text-ink-muted hover:text-ink-primary mt-2"
            @click="switchMode('password')"
          >{{ en.auth.back }}</button>
        </form>
      </template>

      <!-- Default sign-in / sign-up screen -->
      <template v-else>
        <!-- Variant tabs (sign in / sign up) -->
        <div class="grid grid-cols-2 gap-1 p-0.5 rounded-lg border border-white/10 bg-surface-0 mb-5">
          <button
            class="h-8 rounded-md text-xs font-medium transition-colors"
            :class="variant === 'signIn' ? 'bg-accent/20 text-accent' : 'text-ink-muted hover:text-ink-primary'"
            @click="switchVariant('signIn')"
          >{{ en.auth.signIn }}</button>
          <button
            class="h-8 rounded-md text-xs font-medium transition-colors"
            :class="variant === 'signUp' ? 'bg-accent/20 text-accent' : 'text-ink-muted hover:text-ink-primary'"
            @click="switchVariant('signUp')"
          >{{ en.auth.signUp }}</button>
        </div>

        <!-- Google OAuth button -->
        <button
          type="button"
          class="w-full h-12 rounded-xl border border-white/10 bg-surface-0 hover:bg-surface-2
                 flex items-center justify-center gap-3 text-sm font-medium text-ink-primary transition-colors"
          :disabled="submitting"
          @click="submitGoogle"
        >
          <!-- Google "G" mark — brand-compliant simplified glyph -->
          <svg viewBox="0 0 24 24" class="w-4 h-4" aria-hidden="true">
            <path fill="#4285F4" d="M21.35 11.1H12v2.86h5.35c-.23 1.4-1.65 4.1-5.35 4.1-3.22 0-5.84-2.66-5.84-5.94S8.78 6.18 12 6.18c1.83 0 3.06.78 3.76 1.45l2.57-2.5C16.7 3.6 14.55 2.7 12 2.7 6.94 2.7 2.85 6.78 2.85 12s4.09 9.3 9.15 9.3c5.28 0 8.78-3.71 8.78-8.93 0-.6-.06-1.05-.13-1.27Z"/>
          </svg>
          {{ en.auth.continueWithGoogle }}
        </button>

        <!-- Divider -->
        <div class="flex items-center gap-3 my-5">
          <div class="flex-1 h-px bg-white/10"></div>
          <span class="text-[10px] uppercase tracking-widest text-ink-muted/60">{{ en.auth.or }}</span>
          <div class="flex-1 h-px bg-white/10"></div>
        </div>

        <!-- Password form (default) -->
        <form v-if="mode === 'password'" class="space-y-3" @submit.prevent="submitPassword">
          <label class="block">
            <span class="text-ink-muted text-xs tracking-widest uppercase">{{ en.auth.emailLabel }}</span>
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              :placeholder="en.auth.emailPlaceholder"
              class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-12 px-3 text-base"
            />
          </label>
          <label class="block">
            <span class="text-ink-muted text-xs tracking-widest uppercase">{{ en.auth.passwordLabel }}</span>
            <input
              v-model="password"
              type="password"
              required
              minlength="8"
              :autocomplete="variant === 'signIn' ? 'current-password' : 'new-password'"
              :placeholder="en.auth.passwordPlaceholder"
              class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-12 px-3 text-base"
            />
          </label>
          <label v-if="variant === 'signUp'" class="block">
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
            <span v-if="submitting">{{ en.common.loading }}</span>
            <span v-else>{{ variant === 'signIn' ? en.auth.signInPassword : en.auth.createAccount }}</span>
          </Button>
          <p v-if="localError" class="text-danger text-sm">{{ localError }}</p>

          <div class="flex items-center justify-between mt-2 text-xs">
            <button
              v-if="variant === 'signIn'"
              type="button"
              class="text-ink-muted hover:text-ink-primary"
              @click="switchMode('reset')"
            >{{ en.auth.forgotPassword }}</button>
            <span v-else></span>
            <button
              type="button"
              class="text-ink-muted hover:text-ink-primary"
              @click="switchMode('magic')"
            >{{ en.auth.useMagicLink }}</button>
          </div>
        </form>

        <!-- Magic link form (alternate) -->
        <form v-else-if="mode === 'magic'" class="space-y-3" @submit.prevent="submitMagic">
          <label class="block">
            <span class="text-ink-muted text-xs tracking-widest uppercase">{{ en.auth.emailLabel }}</span>
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              :placeholder="en.auth.emailPlaceholder"
              class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-12 px-3 text-base"
            />
          </label>
          <Button type="submit" variant="primary" size="lg" block :disabled="submitting">
            {{ submitting ? en.common.loading : en.auth.sendLink }}
          </Button>
          <p v-if="localError" class="text-danger text-sm">{{ localError }}</p>
          <button
            type="button"
            class="block w-full text-center text-sm text-ink-muted hover:text-ink-primary mt-2"
            @click="switchMode('password')"
          >{{ en.auth.usePassword }}</button>
        </form>
      </template>
    </Card>

    <p class="text-ink-muted text-xs mt-6 leading-relaxed">{{ en.auth.privacy }}</p>
  </div>
</template>
