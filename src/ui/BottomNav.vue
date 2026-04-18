<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { computed } from 'vue'
import { en } from '@/i18n/en'

const route = useRoute()
const items = [
  { to: '/', key: 'home', label: en.nav.home, icon: 'home' },
  { to: '/explore', key: 'explore', label: en.nav.explore, icon: 'map' },
  { to: '/travel', key: 'travel', label: en.nav.travel, icon: 'compass' },
  { to: '/alerts', key: 'alerts', label: en.nav.alerts, icon: 'bell' },
  { to: '/settings', key: 'more', label: en.nav.more, icon: 'more' },
] as const

const active = computed(() => route.path)
</script>

<template>
  <nav
    class="fixed bottom-0 inset-x-0 z-40 border-t border-white/5 bg-surface-0/90 backdrop-blur
           pb-[env(safe-area-inset-bottom)]"
    role="navigation"
    aria-label="Primary"
  >
    <ul class="grid grid-cols-5 max-w-xl mx-auto">
      <li v-for="item in items" :key="item.key" class="text-center">
        <RouterLink
          :to="item.to"
          class="flex flex-col items-center justify-center py-3 text-[11px] tracking-wide
                 text-ink-muted hover:text-ink-primary transition-colors"
          :class="
            (item.to === '/' ? active === '/' : active.startsWith(item.to))
              ? 'text-accent'
              : ''
          "
        >
          <span class="block w-6 h-6 mb-1" :aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round" class="w-full h-full">
              <template v-if="item.icon === 'home'">
                <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v12h14V9" />
              </template>
              <template v-else-if="item.icon === 'map'">
                <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z" /><path d="M9 3v16" /><path d="M15 5v16" />
              </template>
              <template v-else-if="item.icon === 'compass'">
                <circle cx="12" cy="12" r="9" /><path d="m15 9-4 2-2 4 4-2 2-4Z" />
              </template>
              <template v-else-if="item.icon === 'bell'">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8Z" /><path d="M10 21a2 2 0 0 0 4 0" />
              </template>
              <template v-else>
                <circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" />
              </template>
            </svg>
          </span>
          {{ item.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
