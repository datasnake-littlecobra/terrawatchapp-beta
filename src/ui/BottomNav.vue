<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { computed } from 'vue'
import { en } from '@/i18n/en'

const route = useRoute()
const items = [
  { to: '/', key: 'home', label: en.nav.home, icon: 'home', matchPrefix: false },
  { to: '/explore', key: 'explore', label: en.nav.explore, icon: 'map', matchPrefix: true },
  { to: '/travel', key: 'travel', label: en.nav.travel, icon: 'compass', matchPrefix: true },
  { to: '/bookmarks', key: 'bookmarks', label: 'Saved', icon: 'star', matchPrefix: true },
  { to: '/settings', key: 'more', label: en.nav.more, icon: 'more', matchPrefix: true },
] as const

const active = computed(() => route.path)

function isActive(item: (typeof items)[number]): boolean {
  if (!item.matchPrefix) return active.value === item.to
  return active.value === item.to || active.value.startsWith(`${item.to}/`)
}
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
          :class="isActive(item) ? 'text-accent' : ''"
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
              <template v-else-if="item.icon === 'star'">
                <path d="m12 3 2.9 6 6.6 1-4.8 4.6 1.2 6.6L12 18l-5.9 3.2 1.2-6.6L2.5 10l6.6-1L12 3Z" />
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
