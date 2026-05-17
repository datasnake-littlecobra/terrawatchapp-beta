<script setup lang="ts">
// TerraWatch — Phase 9.16: tab strip for /admin/console.
//
// Six tabs. Sticky top, scrolls horizontally on mobile. Mirrors
// the InsuranceTabStrip pattern so the navigation feels consistent.

import { useRoute } from 'vue-router'

const route = useRoute()

interface Tab { to: string; label: string; short: string }

const tabs: Tab[] = [
  { to: '/admin/console/overview', label: 'Overview',         short: 'Overview' },
  { to: '/admin/console/devices',  label: 'Devices',          short: 'Devices' },
  { to: '/admin/console/streams',  label: 'Streams',          short: 'Streams' },
  { to: '/admin/console/apis',     label: 'APIs',             short: 'APIs' },
  { to: '/admin/console/monitor',  label: 'Monitoring',       short: 'Monitor' },
  { to: '/admin/console/impact',   label: 'Insurance Impact', short: 'Impact' },
]

function isActive(to: string): boolean {
  return route.path === to || route.path.startsWith(to + '/')
}
</script>

<template>
  <nav class="border-b border-white/5 bg-surface-0/80 backdrop-blur sticky top-0 z-20">
    <div class="max-w-7xl mx-auto px-2 sm:px-4">
      <ul class="flex items-stretch gap-0.5 overflow-x-auto scrollbar-thin -mx-1 px-1">
        <li v-for="t in tabs" :key="t.to">
          <RouterLink
            :to="t.to"
            class="inline-flex items-center px-3 sm:px-4 h-12 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
            :class="isActive(t.to)
              ? 'border-accent text-accent'
              : 'border-transparent text-ink-muted hover:text-ink-primary hover:border-white/10'"
          >
            <span class="hidden sm:inline">{{ t.label }}</span>
            <span class="sm:hidden">{{ t.short }}</span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </nav>
</template>
