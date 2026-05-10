<script setup lang="ts">
// TerraWatch — Phase 9.12: live cross-reference of active events to
// high-risk counties. Validates the static FEMA NRI index against
// what's happening right now via our existing events pipeline.

import type { ActiveThreat } from '@/services/insurance'
import Card from '@/ui/Card.vue'

defineProps<{
  threats:  ActiveThreat[]
  loading?: boolean
  // The min-risk filter passed to the RPC; surfaced in the empty-state
  // copy so partners understand what "high-risk" means here.
  minRisk?: number
}>()

function timeAgo(d: Date): string {
  const ms = Date.now() - d.getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}

function severityClass(s: string): string {
  if (s === 'danger')  return 'border-danger/40 text-danger bg-danger/10'
  if (s === 'caution') return 'border-caution/40 text-caution bg-caution/10'
  return 'border-safe/40 text-safe bg-safe/10'
}
</script>

<template>
  <Card padded>
    <div class="flex items-baseline justify-between gap-3 mb-3">
      <h2 class="text-base font-semibold text-ink-primary">
        Active threats in high-risk markets
      </h2>
      <span class="text-[10px] uppercase tracking-widest text-ink-muted/60">
        Last 24 h · NRI risk ≥ {{ minRisk ?? 80 }}
      </span>
    </div>

    <p class="text-ink-muted text-sm mb-3">
      Real-time validation that the static risk index correlates with
      what's happening today. Each row matches an elevated event to the
      highest-risk county in the same state.
    </p>

    <p v-if="loading" class="text-ink-muted text-sm">Loading…</p>
    <p v-else-if="!threats.length" class="text-ink-muted text-sm">
      No elevated events in your high-risk markets right now.
    </p>

    <ul v-else class="divide-y divide-white/5 text-sm">
      <li
        v-for="t in threats"
        :key="t.eventId"
        class="py-2.5 grid grid-cols-1 sm:grid-cols-[88px_1fr_auto] gap-x-3 gap-y-1 items-baseline"
      >
        <span
          class="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border font-semibold inline-block w-fit"
          :class="severityClass(t.severity)"
        >{{ t.severity }}</span>
        <div class="min-w-0">
          <p class="text-ink-primary truncate">{{ t.title }}</p>
          <p class="text-ink-muted text-xs">
            <span class="text-ink-muted/80">{{ t.matchedState }}</span>
            <span class="text-ink-muted/40 mx-1">·</span>
            {{ t.category }}
            <span class="text-ink-muted/40 mx-1">·</span>
            FIPS {{ t.matchedCountyFips }}
            <span class="text-ink-muted/40 mx-1">·</span>
            risk {{ t.matchedRiskScore.toFixed(0) }}
          </p>
        </div>
        <span class="text-xs text-ink-muted whitespace-nowrap">{{ timeAgo(t.occurredAt) }}</span>
      </li>
    </ul>
  </Card>
</template>
