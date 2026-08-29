<script setup lang="ts">
// TerraWatch — Phase 11: Location Risk stat header.
import { computed } from 'vue'
import type { FeedEvent } from '@/types/dataSource'
import type { Place } from '@/services/geocode'
import Card from '@/ui/Card.vue'
import Stat from '@/ui/Stat.vue'
import SeverityChip from '@/ui/SeverityChip.vue'

const props = defineProps<{
  events: FeedEvent[]
  place: Place
  radiusKm: number
}>()

const count = computed(() => props.events.length)

const dateRange = computed(() => {
  if (props.events.length === 0) return null
  const times = props.events.map((e) => e.timestamp.getTime())
  return { earliest: new Date(Math.min(...times)), latest: new Date(Math.max(...times)) }
})

function fmtYear(d: Date) {
  return d.getFullYear().toString()
}

function capitalize(s: string) {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s
}

const dominantKind = computed(() => {
  const counts = new Map<string, number>()
  for (const e of props.events) {
    const key = e.category ?? e.kind
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best: [string, number] | null = null
  for (const entry of counts.entries()) {
    if (!best || entry[1] > best[1]) best = entry
  }
  return best ? capitalize(best[0]) : '—'
})

const severityCounts = computed(() => {
  const c = { danger: 0, caution: 0, safe: 0 }
  for (const e of props.events) c[e.severity]++
  return c
})
</script>

<template>
  <Card padded>
    <div class="flex items-start justify-between gap-3 mb-4 flex-wrap">
      <div>
        <p class="text-ink-muted text-xs uppercase tracking-widest">Disaster history</p>
        <h2 class="text-lg font-semibold text-ink-primary mt-1">
          {{ place.name }}<span v-if="place.admin1">, {{ place.admin1 }}</span>, {{ place.country }}
        </h2>
      </div>
      <SeverityChip
        v-if="severityCounts.danger > 0"
        severity="danger"
        :label="`${severityCounts.danger} EXTREME`"
      />
      <SeverityChip
        v-else-if="severityCounts.caution > 0"
        severity="caution"
        :label="`${severityCounts.caution} WARNING`"
      />
      <SeverityChip v-else severity="safe" label="NO EXTREME EVENTS" />
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Stat label="Events found" :value="String(count)" :hint="`within ${radiusKm}km`" />
      <Stat
        v-if="dateRange"
        label="Date range"
        :value="`${fmtYear(dateRange.earliest)}–${fmtYear(dateRange.latest)}`"
        hint="tracked history"
      />
      <Stat label="Most common" :value="dominantKind" />
      <Stat label="Extreme events" :value="String(severityCounts.danger)" hint="danger severity" />
    </div>
  </Card>
</template>
