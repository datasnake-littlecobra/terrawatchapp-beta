<script setup lang="ts">
// TerraWatch — Phase 9.12: top-N counties for a single hazard.
// Used three times on the Insurance dashboard (flood, wildfire, hurricane).

import type { CountyHazardRow } from '@/services/insurance'
import Card from '@/ui/Card.vue'

defineProps<{
  title:    string
  rows:     CountyHazardRow[]
  loading?: boolean
  // If provided, clicking a row emits 'select' with the county_fips.
}>()

const emit = defineEmits<{
  (e: 'select', countyFips: string): void
}>()

function fmtMillions(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '—'
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(0)}K`
  return `$${usd.toFixed(0)}`
}
</script>

<template>
  <Card padded>
    <h3 class="text-sm font-semibold text-ink-primary mb-3">{{ title }}</h3>
    <p v-if="loading" class="text-ink-muted text-sm">Loading…</p>
    <p v-else-if="!rows.length" class="text-ink-muted text-sm">
      No data yet. Run the FEMA NRI seed.
    </p>
    <ol v-else class="text-sm space-y-1.5">
      <li
        v-for="(r, i) in rows"
        :key="r.countyFips"
        class="flex items-baseline gap-2"
      >
        <span class="text-ink-muted/60 num text-xs w-5 shrink-0">{{ i + 1 }}.</span>
        <button
          class="flex-1 min-w-0 text-left flex items-baseline gap-2 group hover:text-accent transition-colors"
          @click="emit('select', r.countyFips)"
        >
          <span class="text-ink-primary truncate flex-1">
            {{ r.countyName }},
            <span class="text-ink-muted">{{ r.state }}</span>
          </span>
          <span class="num text-ink-primary text-xs shrink-0 tabular-nums">
            {{ fmtMillions(r.ealUsd) }}
          </span>
        </button>
      </li>
    </ol>
  </Card>
</template>
