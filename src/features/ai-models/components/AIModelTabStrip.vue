<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

interface Tab { to: string; label: string; short?: string }
const tabs: Tab[] = [
  { to: '/ai-models',                     label: 'Overview',      short: 'Overview' },
  { to: '/ai-models/pipeline-detection',  label: 'Pipeline',      short: 'Pipeline' },
  { to: '/ai-models/oil-spill',           label: 'Oil Spill',     short: 'Oil' },
  { to: '/ai-models/seismic-insar',       label: 'Seismic InSAR', short: 'InSAR' },
  { to: '/ai-models/marine-biota',        label: 'Marine Biota',  short: 'Biota' },
  { to: '/ai-models/glossary',            label: 'Glossary',      short: 'Glossary' },
]

function isActive(to: string): boolean {
  return to === '/ai-models'
    ? route.path === '/ai-models'
    : route.path.startsWith(to)
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
