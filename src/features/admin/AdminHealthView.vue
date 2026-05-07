<script setup lang="ts">
// TerraWatch — Phase 9.10: ingest health dashboard.
// Visible only to admins. Shows latest status per ingest source, with
// 24h / 7d row counts and a 7-day trend strip per source.

import { computed, onMounted, ref } from 'vue'
import Card from '@/ui/Card.vue'
import {
  fetchHealthSummary,
  fetchHealthTrend,
  type HealthSummaryRow,
  type HealthTrendPoint,
  type HealthStatus,
} from '@/services/health'

const summary = ref<HealthSummaryRow[]>([])
const trend = ref<HealthTrendPoint[]>([])
const loading = ref(true)
const errorMsg = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    const [s, t] = await Promise.all([fetchHealthSummary(), fetchHealthTrend(168)])
    summary.value = s
    trend.value = t
    errorMsg.value = null
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to load.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

// Group trend points by source then by hour bucket. Returns the dominant
// status per bucket (priority: failing > degraded > healthy > unknown).
const trendBySource = computed(() => {
  const map = new Map<string, Array<{ bucket: Date; status: HealthStatus }>>()
  // Build {source: {bucketIso: counts}}
  const grouped = new Map<string, Map<string, Map<HealthStatus, number>>>()
  for (const p of trend.value) {
    const key = p.bucket.toISOString()
    if (!grouped.has(p.source)) grouped.set(p.source, new Map())
    const bucketMap = grouped.get(p.source)!
    if (!bucketMap.has(key)) bucketMap.set(key, new Map())
    const counts = bucketMap.get(key)!
    counts.set(p.status, (counts.get(p.status) ?? 0) + p.cnt)
  }
  const priority: HealthStatus[] = ['failing', 'degraded', 'healthy', 'unknown']
  for (const [source, bucketMap] of grouped) {
    const points: Array<{ bucket: Date; status: HealthStatus }> = []
    for (const [iso, counts] of bucketMap) {
      let dominant: HealthStatus = 'unknown'
      for (const status of priority) {
        if (counts.has(status)) { dominant = status; break }
      }
      points.push({ bucket: new Date(iso), status: dominant })
    }
    points.sort((a, b) => a.bucket.getTime() - b.bucket.getTime())
    map.set(source, points)
  }
  return map
})

const counts = computed(() => {
  let healthy = 0, degraded = 0, failing = 0
  for (const r of summary.value) {
    if (r.latestStatus === 'healthy') healthy++
    else if (r.latestStatus === 'degraded') degraded++
    else if (r.latestStatus === 'failing') failing++
  }
  return { healthy, degraded, failing }
})

function statusClass(s: HealthStatus): string {
  if (s === 'healthy')  return 'border-safe/40    text-safe    bg-safe/5'
  if (s === 'degraded') return 'border-caution/40 text-caution bg-caution/5'
  if (s === 'failing')  return 'border-danger/40  text-danger  bg-danger/5'
  return 'border-white/10 text-ink-muted'
}

function dotClass(s: HealthStatus): string {
  if (s === 'healthy')  return 'bg-safe'
  if (s === 'degraded') return 'bg-caution'
  if (s === 'failing')  return 'bg-danger'
  return 'bg-ink-muted/40'
}

function fmtRel(d: Date | null): string {
  if (!d) return '—'
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 60 * 24) return `${Math.round(diffMin / 60)}h ago`
  return `${Math.round(diffMin / 60 / 24)}d ago`
}

function fmtNum(n: number): string {
  return n.toLocaleString()
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8">
    <header class="flex items-start justify-between gap-3 mb-6">
      <div>
        <p class="text-ink-muted text-xs tracking-widest uppercase">Admin · Health</p>
        <h1 class="text-2xl sm:text-3xl font-semibold mt-1">Ingest health</h1>
        <p class="text-ink-muted text-sm mt-1">
          Latest status per source, refreshed every 30 minutes by
          <code>compute_health_snapshot()</code>. Trend strip shows the last 7 days.
        </p>
      </div>
      <button
        type="button"
        class="h-9 px-3 rounded-lg border border-white/10 text-xs text-ink-primary hover:bg-white/5 transition-colors"
        @click="load"
      >Refresh</button>
    </header>

    <!-- Summary chips -->
    <div class="grid grid-cols-3 gap-3 mb-5">
      <Card padded>
        <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Healthy</p>
        <p class="text-2xl font-semibold text-safe num">{{ counts.healthy }}</p>
      </Card>
      <Card padded>
        <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Degraded</p>
        <p class="text-2xl font-semibold text-caution num">{{ counts.degraded }}</p>
      </Card>
      <Card padded>
        <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Failing</p>
        <p class="text-2xl font-semibold text-danger num">{{ counts.failing }}</p>
      </Card>
    </div>

    <Card padded>
      <p v-if="loading" class="text-ink-muted text-sm">Loading…</p>
      <p v-else-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>
      <p v-else-if="!summary.length" class="text-ink-muted text-sm">
        No snapshots yet. Run <code>select public.compute_health_snapshot();</code> in
        Supabase SQL Editor or wait for the next 30-minute cron tick.
      </p>

      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-[10px] uppercase tracking-wider text-ink-muted/70 border-b border-white/5">
            <th class="text-left py-2 font-medium">Source</th>
            <th class="text-left py-2 font-medium">Status</th>
            <th class="text-right py-2 font-medium">24h rows</th>
            <th class="text-right py-2 font-medium">7d rows</th>
            <th class="text-right py-2 font-medium">Last event</th>
            <th class="text-right py-2 font-medium hidden sm:table-cell">Snapshot</th>
            <th class="text-right py-2 font-medium hidden md:table-cell">7-day trend</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in summary"
            :key="r.source"
            class="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
          >
            <td class="py-3 pr-2">
              <p class="font-medium text-ink-primary">{{ r.source }}</p>
              <p v-if="r.details && (r.details as Record<string, unknown>).job"
                 class="text-[10px] text-ink-muted/60 font-mono mt-0.5">
                {{ (r.details as Record<string, unknown>).job }}
              </p>
            </td>
            <td class="py-3 pr-2">
              <span
                class="inline-block text-[10px] uppercase tracking-wider font-semibold border rounded px-1.5 py-0.5"
                :class="statusClass(r.latestStatus)"
              >{{ r.latestStatus }}</span>
            </td>
            <td class="py-3 pr-2 text-right num">{{ fmtNum(r.rows24h) }}</td>
            <td class="py-3 pr-2 text-right num text-ink-muted">{{ fmtNum(r.rows7d) }}</td>
            <td class="py-3 pr-2 text-right num text-xs text-ink-muted">{{ fmtRel(r.lastEventAt) }}</td>
            <td class="py-3 pr-2 text-right num text-xs text-ink-muted/70 hidden sm:table-cell">
              {{ fmtRel(r.latestTakenAt) }}
            </td>
            <td class="py-3 pr-2 text-right hidden md:table-cell">
              <div class="inline-flex gap-px">
                <span
                  v-for="(p, i) in (trendBySource.get(r.source) ?? []).slice(-48)"
                  :key="i"
                  class="w-1 h-3 rounded-sm"
                  :class="dotClass(p.status)"
                  :title="`${p.status} @ ${p.bucket.toLocaleString()}`"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </Card>

    <p class="text-ink-muted/60 text-xs mt-6 leading-relaxed">
      Classification: <span class="text-safe">healthy</span> = cron green AND rows in last 24h ·
      <span class="text-caution">degraded</span> = cron failed OR no rows in 24h ·
      <span class="text-danger">failing</span> = no cron run in last 4h.
      <code>compute_health_snapshot()</code> runs every 30 minutes.
    </p>
  </div>
</template>
