<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MeasurementPoint, SourceTier } from '@/types/measurement'

// Phase 9.6 — tabular companion to the chart. Sortable, paginated, with
// CSV export. Sits on the same screen as the chart (chart on top, table
// below) — never a tab switch. Both surfaces always show the same data
// set so investors / operations users can flip between trend and exact
// values at a glance.

const props = defineProps<{
  series: MeasurementPoint[]
  parameterLabel: string
  unit: string
  sensorName: string
  sourceTier: SourceTier
}>()

type SortKey = 'time' | 'value'
const sortKey = ref<SortKey>('time')
const sortDesc = ref(true)
const visible = ref(50)

const sorted = computed(() => {
  const list = props.series.slice()
  list.sort((a, b) => {
    const dir = sortDesc.value ? -1 : 1
    if (sortKey.value === 'time') return dir * (a.observedAt.getTime() - b.observedAt.getTime())
    return dir * (a.value - b.value)
  })
  return list
})
const displayed = computed(() => sorted.value.slice(0, visible.value))

function toggleSort(k: SortKey) {
  if (sortKey.value === k) sortDesc.value = !sortDesc.value
  else { sortKey.value = k; sortDesc.value = true }
}

function fmtTime(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

function tierBadge(): string {
  return props.sourceTier === 'public' ? 'NDBC' : 'DS'
}

// Client-side CSV. Generates from the currently sorted+sliced view —
// matches what the user is looking at, not the raw fetch.
function exportCsv() {
  const rows = sorted.value
  const header = ['time_utc', 'parameter', 'value', 'unit', 'sensor', 'source']
  const safe = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([
      r.observedAt.toISOString(),
      safe(props.parameterLabel),
      r.value.toString(),
      r.unit,
      safe(props.sensorName),
      tierBadge(),
    ].join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `terrawatch-${props.sensorName.replace(/\W+/g, '-').toLowerCase()}-${props.parameterLabel.replace(/\W+/g, '-').toLowerCase()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="bg-surface-1 border border-white/5 rounded-xl overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-white/5">
      <div>
        <h3 class="text-sm font-semibold text-ink-primary">Recent measurements</h3>
        <p class="text-xs text-ink-muted mt-0.5">
          {{ sorted.length }} observations · {{ parameterLabel }}
          <span class="ml-2 text-[10px] font-semibold tracking-wider text-ink-muted/60">{{ tierBadge() }}</span>
        </p>
      </div>
      <button
        class="flex items-center gap-1.5 h-8 px-3 rounded-md border border-white/10 text-xs
               text-ink-muted hover:text-ink-primary hover:border-white/20 transition-colors"
        :disabled="!sorted.length"
        @click="exportCsv"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" class="w-3.5 h-3.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        CSV
      </button>
    </div>

    <!-- Empty state -->
    <p v-if="!sorted.length" class="text-ink-muted text-sm px-4 py-8 text-center">
      No measurements in this window yet.
    </p>

    <!-- Desktop table -->
    <div v-else class="hidden sm:block">
      <table class="w-full text-sm">
        <thead class="text-left text-xs text-ink-muted/70 uppercase tracking-wider">
          <tr class="border-b border-white/5">
            <th class="px-4 py-2 cursor-pointer hover:text-ink-primary" @click="toggleSort('time')">
              Time UTC
              <span v-if="sortKey === 'time'" class="ml-1">{{ sortDesc ? '↓' : '↑' }}</span>
            </th>
            <th class="px-4 py-2">Parameter</th>
            <th class="px-4 py-2 cursor-pointer hover:text-ink-primary text-right" @click="toggleSort('value')">
              Value
              <span v-if="sortKey === 'value'" class="ml-1">{{ sortDesc ? '↓' : '↑' }}</span>
            </th>
            <th class="px-4 py-2">Unit</th>
            <th class="px-4 py-2">Source</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in displayed" :key="r.observedAt.getTime()" class="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]">
            <td class="px-4 py-2 num text-ink-primary text-xs">{{ fmtTime(r.observedAt) }}</td>
            <td class="px-4 py-2 text-ink-muted text-sm">{{ parameterLabel }}</td>
            <td class="px-4 py-2 num text-right text-ink-primary tabular-nums">{{ r.value.toFixed(2) }}</td>
            <td class="px-4 py-2 text-ink-muted text-sm">{{ r.unit }}</td>
            <td class="px-4 py-2">
              <span class="text-[10px] font-semibold tracking-wider"
                    :class="sourceTier === 'public' ? 'text-accent/80' : 'text-safe/80'">
                {{ tierBadge() }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile card list -->
    <ul v-if="sorted.length" class="sm:hidden divide-y divide-white/5">
      <li v-for="r in displayed" :key="r.observedAt.getTime()" class="px-4 py-3 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="num text-xs text-ink-muted">{{ fmtTime(r.observedAt) }}</p>
          <p class="text-sm text-ink-muted">{{ parameterLabel }}</p>
        </div>
        <div class="text-right">
          <p class="num text-base text-ink-primary tabular-nums font-medium">{{ r.value.toFixed(2) }} <span class="text-xs text-ink-muted">{{ r.unit }}</span></p>
          <p class="text-[10px] font-semibold tracking-wider mt-0.5"
             :class="sourceTier === 'public' ? 'text-accent/80' : 'text-safe/80'">
            {{ tierBadge() }}
          </p>
        </div>
      </li>
    </ul>

    <!-- Show more -->
    <div v-if="visible < sorted.length" class="px-4 py-3 border-t border-white/5">
      <button
        class="text-xs text-accent hover:underline"
        @click="visible += 50"
      >
        Show more ({{ sorted.length - visible }} remaining)
      </button>
    </div>
  </div>
</template>
