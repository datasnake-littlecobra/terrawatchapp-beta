<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { en } from '@/i18n/en'

const auth = useAuthStore()

const initials = computed(() => {
  const email = auth.email
  if (!email) return '?'
  const name = email.split('@')[0] ?? ''
  return (name[0] ?? '?').toUpperCase()
})
</script>

<template>
  <div v-if="auth.configured" class="flex items-center gap-2">
    <RouterLink
      v-if="!auth.isAuthed"
      to="/auth/sign-in"
      class="text-accent text-xs font-medium hover:underline"
    >
      {{ en.auth.signIn }}
    </RouterLink>
    <RouterLink
      v-else
      to="/bookmarks"
      class="flex items-center gap-2 text-ink-muted hover:text-ink-primary text-xs"
      :aria-label="auth.email ?? en.auth.account"
    >
      <span
        class="w-7 h-7 rounded-full bg-accent/20 border border-accent/40 text-accent
               flex items-center justify-center text-xs font-semibold"
      >
        {{ initials }}
      </span>
    </RouterLink>
  </div>
</template>
