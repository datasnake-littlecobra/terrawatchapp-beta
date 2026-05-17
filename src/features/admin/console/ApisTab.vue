<script setup lang="ts">
// TerraWatch — Phase 9.16 APIs tab.
//
// Wraps the existing AdminApiKeysView content + adds an aggregate
// "call volume + endpoint health" panel reading the new
// api_request_log + api_call_volume_7d views (migration 0035).

import { computed, onMounted, ref } from 'vue'
import NarrativeCard from './components/NarrativeCard.vue'
import Card from '@/ui/Card.vue'
import {
  fetchApiCallVolume7d,
  fetchApiRequestLogSummary,
  type ApiVolumeRow,
  type RequestLogSummary,
} from '@/services/opsConsole'
import AdminApiKeysView from '@/features/admin/AdminApiKeysView.vue'

const volume = ref<ApiVolumeRow[]>([])
const summary = ref<RequestLogSummary | null>(null)
const loading = ref(true)
const errorMsg = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    [volume.value, summary.value] = await Promise.all([
      fetchApiCallVolume7d(),
      fetchApiRequestLogSummary(),
    ])
    errorMsg.value = null
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Load failed'
  } finally {
    loading.value = false
  }
}
onMounted(load)

// Roll up volume to per-day totals (sum across keys) for a tiny sparkline.
const perDayTotals = computed(() => {
  const map = new Map<string, number>()
  for (const r of volume.value) map.set(r.day, (map.get(r.day) ?? 0) + r.count)
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
})

const grandTotal = computed(() => perDayTotals.value.reduce((s, [, n]) => s + n, 0))

function fmtDate(iso: string): string {
  return iso.slice(5)  // 'MM-DD'
}
</script>

<template>
  <div class="space-y-5">
    <NarrativeCard
      eyebrow="Ops Console · APIs"
      title="Risk API key management + request health"
      body="Issue, list, and revoke Insurance Risk API keys. Watch per-day request volume and 24h error rate. When a tenant's usage approaches their daily limit for several days in a row, that's the moment to schedule a tier-up call."
      :links="[{ to: '/insurance/api', label: 'Public API docs' }]"
    />

    <!-- Aggregate panels (NEW) -->
    <div class="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">
      <Card padded>
        <h3 class="text-sm font-semibold text-ink-primary mb-2">Daily request volume — last 7 days</h3>
        <p v-if="loading" class="text-ink-muted text-sm">Loading…</p>
        <p v-else-if="!perDayTotals.length" class="text-ink-muted text-sm">
          No requests in the last 7 days. As the Risk API gets traffic,
          per-day counts will appear here.
        </p>
        <div v-else>
          <p class="text-ink-muted text-xs mb-3">
            Total: <span class="num text-ink-primary">{{ grandTotal.toLocaleString() }}</span> requests across all active keys.
          </p>
          <div class="grid grid-cols-7 gap-1.5">
            <div v-for="([day, n]) in perDayTotals" :key="day" class="text-center">
              <div class="h-16 flex items-end">
                <div class="w-full rounded-t" :style="{
                  height: `${Math.max(4, (n / (Math.max(...perDayTotals.map((x) => x[1])) || 1)) * 60)}px`,
                  background: '#3FA9F5',
                }"></div>
              </div>
              <p class="text-[10px] num text-ink-muted mt-1">{{ fmtDate(day) }}</p>
              <p class="text-[10px] num text-ink-primary">{{ n.toLocaleString() }}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card padded>
        <h3 class="text-sm font-semibold text-ink-primary mb-2">Last 24 h</h3>
        <template v-if="summary">
          <div class="space-y-2 text-sm">
            <div class="flex items-baseline justify-between">
              <span class="text-ink-muted">Requests</span>
              <span class="num text-ink-primary font-semibold">{{ summary.total24h.toLocaleString() }}</span>
            </div>
            <div class="flex items-baseline justify-between">
              <span class="text-ink-muted">Errors (≥400)</span>
              <span
                class="num font-semibold"
                :class="summary.errors24h > 0 ? 'text-danger' : 'text-safe'"
              >{{ summary.errors24h.toLocaleString() }}</span>
            </div>
            <div class="flex items-baseline justify-between">
              <span class="text-ink-muted">Avg latency</span>
              <span class="num text-ink-primary font-semibold">
                {{ summary.avgLatency != null ? `${summary.avgLatency.toFixed(0)} ms` : '—' }}
              </span>
            </div>
            <div v-if="summary.perEndpoint.length" class="pt-2 mt-2 border-t border-white/5 text-xs">
              <p class="text-ink-muted/60 mb-1">By endpoint:</p>
              <p v-for="ep in summary.perEndpoint" :key="ep.endpoint" class="text-ink-primary">
                <code class="text-accent">{{ ep.endpoint }}</code>
                <span class="num text-ink-muted ml-1">{{ ep.count }}</span>
                <span v-if="ep.errors > 0" class="num text-danger ml-1">({{ ep.errors }} err)</span>
              </p>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <p v-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>

    <!-- Embedded keys admin (full existing view) -->
    <div class="rounded-2xl border border-white/5 bg-surface-1 p-1">
      <AdminApiKeysView />
    </div>
  </div>
</template>
