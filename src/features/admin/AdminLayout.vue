<script setup lang="ts">
// TerraWatch — Phase 9.8: gate component for admin routes.
//
// Wraps the admin views and enforces auth + isAdmin. Anonymous visitors
// are redirected to /auth/sign-in?next=<original>; authed-but-not-admin
// users see a "not authorized" panel with a link to /admin/sign-up. We
// don't redirect non-admins to a generic page — better to be honest about
// where they are and give them a clear next step.

import { onMounted, watchEffect } from 'vue'
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

// If we're already known to be unauthed when the layout mounts, send to
// sign-in immediately. Once authed, the watcher below handles role
// transitions (e.g. fresh redeem of admin code).
watchEffect(() => {
  if (auth.adminLoaded && auth.status === 'anonymous') {
    void router.replace({
      path: '/auth/sign-in',
      query: { next: route.fullPath },
    })
  }
})
</script>

<template>
  <div class="min-h-[60vh]">
    <!-- Loading: auth/admin-flag still resolving -->
    <p v-if="!auth.adminLoaded" class="text-ink-muted text-sm max-w-md mx-auto px-4 py-12">
      Checking access…
    </p>

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
          to="/admin/sign-up"
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
