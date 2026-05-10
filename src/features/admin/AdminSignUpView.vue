<script setup lang="ts">
// TerraWatch — Phase 9.8 follow-up: friction-free admin signup.
//
// Two flows handled here:
//
// 1. NEW ADMIN — visitor is anonymous. Form collects email + password +
//    admin code. We call the supabase/functions/signup-admin edge
//    function which creates the auth user with email_confirm=true (no
//    inbox round-trip), validates the admin code server-side, and sets
//    user_profiles.role='admin' atomically. On success we sign the user
//    in with their just-created credentials and route to /admin/blog.
//
// 2. PROMOTE EXISTING — visitor is already signed in but not admin
//    (typically arrives here from AdminLayout's "promote with admin
//    code" CTA). We call the redeem_admin_code RPC to flip the role.
//
// The two-step legacy flow (sign up via supabase.auth then redeem)
// breaks when Supabase email confirmation is on, because the user can't
// get a JWT until they click the email — which they often don't get
// because Supabase free-tier email is unreliable. The new flow bypasses
// all of that.

import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import { useAuthStore } from '@/stores/auth'
import { signupAdmin, AdminSignupError } from '@/services/adminSignup'

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
        codeError.value = 'Admin signup code is required.'
        return
      }

      // Single-call: create + promote, no email confirmation needed.
      try {
        await signupAdmin({ email: e, password: p, code: code.value.trim() })
      } catch (err) {
        if (err instanceof AdminSignupError) {
          if (err.status === 403) {
            codeError.value = 'Invalid admin signup code. Contact whoever shared the link.'
            return
          }
          localError.value = err.message
          return
        }
        throw err
      }

      // Sign in with the just-created credentials so the user lands on
      // /admin/blog already authenticated.
      await auth.signInWithPassword(e, p)
      success.value = true
      setTimeout(() => router.replace('/admin/blog'), 600)
      return
    }

    // mode === 'promote': existing logged-in user wants admin role.
    const ok = await auth.redeemAdminCode(code.value.trim())
    if (!ok) {
      codeError.value = 'Invalid admin signup code. Contact whoever shared the link.'
      return
    }
    success.value = true
    setTimeout(() => router.replace('/admin/blog'), 600)
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
          Create an admin account using your email + password + the shared admin signup code.
          You'll be signed in immediately — no email confirmation needed for admin signups.
        </template>
        <template v-else>
          You're signed in as <span class="text-ink-primary">{{ auth.email }}</span>.
          Enter the admin signup code to grant this account admin privileges.
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
          <span class="text-ink-muted text-xs tracking-widest uppercase">Admin signup code</span>
          <input
            v-model="code"
            type="text"
            required
            autocomplete="off"
            placeholder="The shared code you set in Supabase Vault"
            class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-12 px-3 text-base font-mono"
          />
          <span class="text-[10px] text-ink-muted/60 mt-1 block">
            Set once in Supabase SQL Editor:
            <code>select vault.create_secret('your-code', 'admin_signup_code');</code>
            See DEPLOY.md → "Admin role + blog admin UI" for full setup.
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
      — admin accounts log in via the regular sign-in surface too (same credentials).
    </p>
  </div>
</template>
