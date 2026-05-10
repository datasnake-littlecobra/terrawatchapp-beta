<script setup lang="ts">
// TerraWatch — Phase 9.12.1: top-of-page tab strip for the Insurance
// Intelligence section. Shared across all /insurance/* routes.

import { useRoute } from 'vue-router'

const route = useRoute()

interface Tab { to: string; label: string; short?: string }
const tabs: Tab[] = [
  { to: '/insurance',            label: 'Overview',         short: 'Overview' },
  { to: '/insurance/verdict',    label: 'Risk Verdict',     short: 'Verdict' },
  { to: '/insurance/map',        label: 'Command Center',   short: 'Map' },
  { to: '/insurance/ep-curves',  label: 'EP Curves',        short: 'EP' },
  { to: '/insurance/parametric', label: 'Parametric',       short: 'Parametric' },
  { to: '/insurance/portfolio',  label: 'Portfolio',        short: 'Portfolio' },
  { to: '/insurance/claims',     label: 'Claims',           short: 'Claims' },
]

function isActive(to: string): boolean {
  return to === '/insurance' ? route.path === '/insurance' : route.path.startsWith(to)
}
</script>

<template>
  <nav class="border-b border-white/5 bg-surface-0/80 backdrop-blur sticky top-0 z-20">
    <div class="max-w-6xl mx-auto px-2 sm:px-4">
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
            <span class="sm:hidden">{{ t.short ?? t.label }}</span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </nav>
</template>
