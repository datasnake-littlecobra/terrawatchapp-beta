<script setup lang="ts">
// TerraWatch — Phase 9.8: admin signup surface.
//
// Two flows handled here:
//
// 1. New admin signup — collects email + password + admin code. Creates
//    a Supabase user, then immediately calls redeem_admin_code(code) to
//    promote them. If the code is wrong, we DO leave a regular user
//    account behind (the signup itself succeeded); we surface that
//    clearly so the user can retry the redeem with a different code, or
//    just sign out.
//
// 2. Promote existing account — user is already signed in but not admin
//    (landed here from AdminLayout's "promote with admin code" CTA). We
//    skip the signup step, just call redeem_admin_code(code).
//
// After successful redeem, we route to /admin/blog.

import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const code = ref('')

const submitting = ref(false)
const localError = ref<string | null>(null)
const codeError = ref<string | null>(null)
const success = ref(false)

const mode = computed<'signup' | 'promote'>(() => (auth.isAuthed ? 'promote' : 'signup'))

async function submit() {
  if (submitting.value) return
  submitting.value = true
  localError.value = null
  codeError.value = null
  try {
    if (mode.value === 'signup') {
      const e = email.value.trim()
      const p = password.value
      if (!e || !p) {
        localError.value = 'Email and password are required.'
        return
      }
      if (p.length < 8) {
        localError.value = 'Password must be at least 8 characters.'
        return
      }
      if (p !== passwordConfirm.value) {
        localError.value = "Passwords don't match."
        return
      }
      if (!code.value.trim()) {
        codeError.value = 'Admin code is required.'
        return
      }
      const { requiresConfirmation } = await auth.signUpWithPassword(e, p)
      if (requiresConfirmation) {
        // Account exists but not signed-in yet (email confirm enabled in
        // Supabase Auth settings). The redeem RPC needs an authed JWT,
        // so we surface the situation honestly.
        localError.value =
          'Account created. Please confirm your email, then sign in and revisit /admin/sign-up to redeem the admin code.'
        return
      }
    }

    const ok = await auth.redeemAdminCode(code.value.trim())
    if (!ok) {
      codeError.value = 'Invalid admin code. Contact the admin who shared the link.'
      return
    }
    success.value = true
    setTimeout(() => router.replace('/admin/blog'), 800)
  } catch (e) {
    localError.value = e instanceof Error ? e.message : 'Sign-up failed.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-md px-5 pt-10 pb-24">
    <header class="mb-6">
      <p class="text-ink-muted text-xs tracking-widest uppercase">Admin</p>
      <h1 class="text-2xl font-semibold mt-1">
        {{ mode === 'signup' ? 'Admin sign-up' : 'Promote account to admin' }}
      </h1>
      <p class="text-ink-muted text-sm mt-2">
        <template v-if="mode === 'signup'">
          Create an admin account. After signup, you'll be able to publish, hide, and edit blog
          posts from inside the app.
        </template>
        <template v-else>
          You're signed in as <span class="text-ink-primary">{{ auth.email }}</span>.
          Enter the admin code to promote this account.
        </template>
      </p>
    </header>

    <Card padded elevated>
      <p v-if="!auth.configured" class="text-ink-muted text-sm">
        Accounts aren't configured for this build.
      </p>

      <template v-else-if="success">
        <p class="font-medium">You're an admin.</p>
        <p class="text-ink-muted text-sm mt-2">Redirecting to the admin blog dashboard…</p>
      </template>

      <form v-else class="space-y-3" @submit.prevent="submit">
        <template v-if="mode === 'signup'">
          <label class="block">
            <span class="text-ink-muted text-xs tracking-widest uppercase">Email</span>
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="you@example.com"
              class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-12 px-3 text-base"
            />
          </label>
          <label class="block">
            <span class="text-ink-muted text-xs tracking-widest uppercase">Password</span>
            <input
              v-model="password"
              type="password"
              required
              minlength="8"
              autocomplete="new-password"
              placeholder="At least 8 characters"
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
              placeholder="Repeat password"
              class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-12 px-3 text-base"
            />
          </label>
        </template>

        <label class="block">
          <span class="text-ink-muted text-xs tracking-widest uppercase">Admin code</span>
          <input
            v-model="code"
            type="text"
            required
            autocomplete="off"
            placeholder="Shared admin signup code"
            class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-12 px-3 text-base font-mono"
          />
          <span class="text-[10px] text-ink-muted/60 mt-1 block">
            Stored once in Supabase Vault as <code>admin_signup_code</code>. Rotate by updating
            the Vault row.
          </span>
        </label>

        <Button type="submit" variant="primary" size="lg" block :disabled="submitting">
          <span v-if="submitting">Working…</span>
          <span v-else>{{ mode === 'signup' ? 'Create admin account' : 'Promote account' }}</span>
        </Button>

        <p v-if="localError" class="text-danger text-sm">{{ localError }}</p>
        <p v-if="codeError" class="text-danger text-sm">{{ codeError }}</p>
      </form>
    </Card>

    <p v-if="mode === 'signup'" class="text-ink-muted text-xs mt-4">
      Already an admin?
      <RouterLink to="/auth/sign-in" class="text-accent">Sign in</RouterLink>
      — admin accounts log in via the regular sign-in surface too.
    </p>
  </div>
</template>
