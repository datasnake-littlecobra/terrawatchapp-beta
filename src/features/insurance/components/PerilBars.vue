<script setup lang="ts">
// Five-peril breakdown: each peril gets a 0-10 horizontal bar coloured
// by intensity. Used on the Risk Verdict centerpiece + portfolio cards.

import type { Peril } from '@/data/insurance-mock'

const props = defineProps<{
  perils: Record<Peril, number>
}>()

interface Row { key: Peril; label: string; icon: string }
const rows: Row[] = [
  { key: 'flood',    label: 'Flood',       icon: 'flood' },
  { key: 'seismic',  label: 'Seismic',     icon: 'seismic' },
  { key: 'wind',     label: 'Wind',        icon: 'wind' },
  { key: 'wildfire', label: 'Wildfire',    icon: 'wildfire' },
  { key: 'surge',    label: 'Storm Surge', icon: 'surge' },
]

function barColor(v: number): string {
  if (v >= 7) return '#FF6B6B'
  if (v >= 4) return '#F5B74A'
  if (v >= 1) return '#3DDC97'
  return '#3FA9F5'
}
function pctWidth(v: number): string {
  return `${Math.max(0, Math.min(100, v * 10))}%`
}
</script>

<template>
  <ul class="space-y-2">
    <li v-for="r in rows" :key="r.key" class="grid grid-cols-[88px_1fr_36px] items-center gap-3">
      <div class="flex items-center gap-2 text-ink-muted text-xs">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
             stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 shrink-0">
          <template v-if="r.icon === 'flood'">
            <path d="M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0M5 9l2-5 4 4 3-3 5 5"/>
          </template>
          <template v-else-if="r.icon === 'seismic'">
            <path d="M3 12h3l2-7 4 14 2-7 2 4 5 0"/>
          </template>
          <template v-else-if="r.icon === 'wind'">
            <path d="M3 8h13a3 3 0 1 0-3-3M3 12h17a3 3 0 1 1-3 3M3 16h11"/>
          </template>
          <template v-else-if="r.icon === 'wildfire'">
            <path d="M12 3s4 5 4 9a4 4 0 1 1-8 0c0-2 1-4 4-9Z"/>
            <path d="M9 14a3 3 0 1 0 6 0"/>
          </template>
          <template v-else-if="r.icon === 'surge'">
            <path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>
            <path d="M5 13c2-2 4-2 7 0s5 2 7 0"/>
            <path d="M8 8c2-1 4-1 6 0"/>
          </template>
        </svg>
        <span>{{ r.label }}</span>
      </div>
      <div class="h-2 rounded-full bg-white/5 overflow-hidden relative">
        <div
          class="h-full rounded-full"
          :style="{ width: pctWidth(props.perils[r.key]), background: barColor(props.perils[r.key]) }"
        />
      </div>
      <span class="num text-xs text-ink-primary tabular-nums text-right">
        {{ props.perils[r.key].toFixed(1) }}
      </span>
    </li>
  </ul>
</template>
