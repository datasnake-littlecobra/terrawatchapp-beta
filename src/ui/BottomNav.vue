<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { useSidebar } from '@/composables/useSidebar'

const route   = useRoute()
const sidebar = useSidebar()

const items = [
  { to: '/',       label: 'Home',   icon: 'home'  },
  { to: '/events', label: 'Events', icon: 'globe' },
  { to: '/travel', label: 'Travel', icon: 'nav'   },
] as const

function isActive(to: string): boolean {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(to + '/')
}
</script>

<template>
  <nav
    class="fixed bottom-0 inset-x-0 z-40 border-t border-white/5 bg-surface-0/90 backdrop-blur
           pb-[env(safe-area-inset-bottom)]"
    role="navigation"
    aria-label="Primary"
  >
    <ul class="grid grid-cols-4 max-w-xl mx-auto">
      <li v-for="item in items" :key="item.to" class="text-center">
        <RouterLink
          :to="item.to"
          class="flex flex-col items-center justify-center py-3 text-[11px] tracking-wide transition-colors"
          :class="isActive(item.to) ? 'text-accent' : 'text-ink-muted hover:text-ink-primary'"
        >
          <span class="block w-6 h-6 mb-1" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round" class="w-full h-full">
              <template v-if="item.icon === 'home'">
                <path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v12h14V9"/>
              </template>
              <template v-else-if="item.icon === 'globe'">
                <circle cx="12" cy="12" r="9"/>
                <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>
              </template>
              <template v-else-if="item.icon === 'nav'">
                <polygon points="3,11 22,2 13,21 11,13 3,11"/>
              </template>
            </svg>
          </span>
          {{ item.label }}
        </RouterLink>
      </li>

      <!-- More → opens sidebar drawer -->
      <li class="text-center">
        <button
          class="w-full flex flex-col items-center justify-center py-3 text-[11px] tracking-wide transition-colors"
          :class="sidebar.isOpen.value ? 'text-accent' : 'text-ink-muted hover:text-ink-primary'"
          aria-label="Open menu"
          @click="sidebar.toggle()"
        >
          <span class="block w-6 h-6 mb-1" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" class="w-full h-full">
              <circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>
            </svg>
          </span>
          More
        </button>
      </li>
    </ul>
  </nav>
</template>
