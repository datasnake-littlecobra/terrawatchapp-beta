<script setup lang="ts">
// TerraWatch — Phase 9.8 / Phase 9.17.1.1: gate component for admin routes.
//
// Wraps the admin views and enforces auth + isAdmin.
//
// 9.17.1.1 update: anonymous visitors USED to be silently
// redirected to /auth/sign-in?next=<original>. That's correct for
// auth, but /auth/sign-in creates regular tenant accounts
// (role='user'), not admin accounts — so the user signs in,
// bounces back, sees "Admin access required", and now has to
// find /admin/sign-up. Dead-end UX for the bootstrap case.
// Instead we now render an explainer panel with TWO CTAs:
// "Sign in" (existing admin account) and "Create admin account"
// (bootstrap with the admin signup code from Vault).

import { onMounted } from 'vue'
import { RouterView, useRoute, useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Card from '@/ui/Card.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

onMounted(async () => {
  if (!auth.initialized) await auth.init()
  if (!auth.adminLoaded) await auth.loadAdminFlag()
})
</script>

<template>
  <div class="min-h-[60vh]">
    <!-- Loading: auth/admin-flag still resolving -->
    <p v-if="!auth.adminLoaded" class="text-ink-muted text-sm max-w-md mx-auto px-4 py-12">
      Checking access…
    </p>

    <!-- Anonymous (Phase 9.17.1.1): give both paths, don't silently redirect -->
    <div v-else-if="auth.status === 'anonymous'" class="max-w-md mx-auto px-4 py-12">
      <Card padded elevated>
        <p class="font-medium">Admin access required</p>
        <p class="text-ink-muted text-sm mt-2">
          This area is restricted to admins. If you already have an admin account,
          sign in. If you're bootstrapping the first admin or promoting a new one,
          you'll need the admin signup code (set once in Supabase Vault — see DEPLOY.md).
        </p>
        <div class="flex flex-col sm:flex-row gap-2 mt-4">
          <RouterLink
            :to="{ path: '/auth/sign-in', query: { next: route.fullPath } }"
            class="inline-flex h-10 px-4 items-center justify-center rounded-xl border border-white/10 text-ink-primary text-sm font-medium hover:bg-white/5 transition-colors"
          >
            Sign in (existing admin)
          </RouterLink>
          <RouterLink
            :to="{ path: '/admin/sign-up', query: { next: route.fullPath } }"
            class="inline-flex h-10 px-4 items-center justify-center rounded-xl bg-accent text-surface-0 text-sm font-medium hover:bg-accent-deep hover:text-ink-primary transition-colors"
          >
            Create admin account
          </RouterLink>
        </div>
      </Card>
    </div>

    <!-- Authed but not admin -->
    <div v-else-if="auth.isAuthed && !auth.isAdmin" class="max-w-md mx-auto px-4 py-12">
      <Card padded elevated>
        <p class="font-medium">Admin access required</p>
        <p class="text-ink-muted text-sm mt-2">
          You're signed in as <span class="text-ink-primary">{{ auth.email }}</span>, but this
          area is restricted to admins. If you have an admin signup code, you can promote this
          account.
        </p>
        <RouterLink
          :to="{ path: '/admin/sign-up', query: { next: route.fullPath } }"
          class="inline-flex h-10 px-4 mt-4 items-center justify-center rounded-xl bg-accent text-surface-0 text-sm font-medium hover:bg-accent-deep hover:text-ink-primary transition-colors"
        >
          Promote with admin code
        </RouterLink>
        <button
          type="button"
          class="block mt-3 text-xs text-ink-muted hover:text-ink-primary"
          @click="auth.signOut(); router.replace('/')"
        >
          Sign out
        </button>
      </Card>
    </div>

    <!-- Authorized -->
    <RouterView v-else-if="auth.isAdmin" />
  </div>
</template>

