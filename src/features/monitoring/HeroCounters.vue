<script setup lang="ts">
import { computed } from 'vue'
import type { MonitoringStats, SourceTier, Domain } from '@/types/measurement'

// The audience-framing rule: lead with scale, not the chart. These counters
// turn "we have a buoy chart" into "we monitor 1,547 sensors generating
// 142,000 observations per day." Same data — very different story.

const props = defineProps<{
  stats: MonitoringStats[]
  domain: Domain
  sourceTier: 'all' | SourceTier
}>()

const filtered = computed(() => {
  let s = props.stats.filter((x) => x.domain === props.domain)
  if (props.sourceTier !== 'all') {
    s = s.filter((x) => x.sourceTier === props.sourceTier)
  }
  return s
})

const totals = computed(() => {
  let activeSensors = 0
  let obs24h = 0
  let fresh = 0
  let latest: Date | null = null
  for (const r of filtered.value) {
    activeSensors += r.activeSensors
    obs24h += r.obsLast24h
    fresh += r.freshSensors
    if (r.latestObservation && (!latest || r.latestObservation > latest)) {
      latest = r.latestObservation
    }
  }
  return { activeSensors, obs24h, fresh, latest }
})

function nfmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function ageMin(d: Date | null): string {
  if (!d) return '—'
  const m = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60_000))
  if (m < 1)  return 'live'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
    <div class="bg-surface-1 border border-white/5 rounded-xl p-4">
      <p class="text-[10px] tracking-widest uppercase text-ink-muted/70 mb-1">Active sensors</p>
      <p class="num text-2xl sm:text-3xl font-semibold text-ink-primary">{{ nfmt(totals.activeSensors) }}</p>
      <p class="text-xs text-ink-muted mt-0.5">across {{ filtered.length }} {{ filtered.length === 1 ? 'tier' : 'tiers' }}</p>
    </div>

    <div class="bg-surface-1 border border-white/5 rounded-xl p-4">
      <p class="text-[10px] tracking-widest uppercase text-ink-muted/70 mb-1">Observations · 24h</p>
      <p class="num text-2xl sm:text-3xl font-semibold text-ink-primary">{{ nfmt(totals.obs24h) }}</p>
      <p class="text-xs text-ink-muted mt-0.5">measurements ingested</p>
    </div>

    <div class="bg-surface-1 border border-white/5 rounded-xl p-4">
      <p class="text-[10px] tracking-widest uppercase text-ink-muted/70 mb-1">Fresh · 6h</p>
      <p class="num text-2xl sm:text-3xl font-semibold text-ink-primary">{{ nfmt(totals.fresh) }}</p>
      <p class="text-xs text-ink-muted mt-0.5">sensors reporting now</p>
    </div>

    <div class="bg-surface-1 border border-white/5 rounded-xl p-4">
      <p class="text-[10px] tracking-widest uppercase text-ink-muted/70 mb-1">Latest data</p>
      <p class="num text-2xl sm:text-3xl font-semibold text-ink-primary">{{ ageMin(totals.latest) }}</p>
      <p class="text-xs text-ink-muted mt-0.5">most-recent observation</p>
    </div>
  </div>
</template>
