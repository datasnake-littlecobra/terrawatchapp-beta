<script setup lang="ts">
// TerraWatch — Phase 9.18.0: a single use-case tile on the
// /weather-intelligence landing page. Clicking routes into the
// dedicated tab for that use case.

import { RouterLink } from 'vue-router'

defineProps<{
  to:           string
  number:       number      // 1..5
  title:        string
  oneLiner:     string
  realData:     string      // e.g. "NOAA Global Hourly + FEMA NRI"
  roi:          string      // e.g. "750:1"
  status:       'live' | 'partial' | 'planned'
}>()

const statusClass: Record<'live'|'partial'|'planned', string> = {
  live:    'border-safe/40    text-safe    bg-safe/[0.08]',
  partial: 'border-caution/40 text-caution bg-caution/[0.08]',
  planned: 'border-white/10   text-ink-muted bg-white/[0.02]',
}
const statusLabel: Record<'live'|'partial'|'planned', string> = {
  live:    'LIVE on real data',
  partial: 'PARTIAL — public data + computed proxies',
  planned: 'PLANNED',
}
</script>

<template>
  <RouterLink
    :to="to"
    class="block rounded-2xl border border-white/5 bg-surface-1 p-5 hover:border-accent/30 transition-colors group"
  >
    <div class="flex items-baseline justify-between gap-2 mb-2">
      <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">
        Use case {{ number }}
      </p>
      <span
        class="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border font-semibold"
        :class="statusClass[status]"
      >{{ statusLabel[status] }}</span>
    </div>
    <h3 class="text-base font-semibold text-ink-primary group-hover:text-accent transition-colors">
      {{ title }}
    </h3>
    <p class="text-ink-muted text-sm mt-2 leading-relaxed">{{ oneLiner }}</p>
    <div class="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-2">
      <div>
        <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">Data</p>
        <p class="text-xs text-ink-primary mt-0.5">{{ realData }}</p>
      </div>
      <div class="text-right">
        <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">ROI</p>
        <p class="text-xs num text-accent font-semibold mt-0.5">{{ roi }}</p>
      </div>
    </div>
  </RouterLink>
</template>
