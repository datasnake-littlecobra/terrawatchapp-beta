<script setup lang="ts">
// TerraWatch — Phase 9.16 Overview tab.
//
// Single-page operational dashboard: hero counters + recent activity
// pointers. Each counter explains itself in plain text so a newbie
// can read top-to-bottom and orient.

import { onMounted, ref } from 'vue'
import NarrativeCard from './components/NarrativeCard.vue'
import Card from '@/ui/Card.vue'
import { fetchOverviewCounters, type OverviewCounters } from '@/services/opsConsole'

const counters = ref<OverviewCounters | null>(null)
const loading = ref(true)
const errorMsg = ref<string | null>(null)

async function load() {
  try {
    counters.value = await fetchOverviewCounters()
    errorMsg.value = null
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Counters failed'
  } finally {
    loading.value = false
  }
}
onMounted(load)

function fmtNum(n: number | undefined | null): string {
  if (n == null) return '—'
  return n.toLocaleString()
}
</script>

<template>
  <div class="space-y-5">
    <NarrativeCard
      eyebrow="Ops Console · Overview"
      title="At-a-glance operational state"
      body="The single page that answers 'is the platform healthy and busy right now?'. Each tile rolls up data from a different table or RPC. Click through to the relevant tab below for the detail. If you're walking a buyer through the operations side, start here, then move tab-by-tab from Devices → Streams → APIs → Monitoring → Insurance Impact."
      :links="[
        { to: '/admin/console/devices', label: 'See sensor fleet' },
        { to: '/admin/console/monitor', label: 'See ingest health' },
        { to: '/admin/console/impact',  label: 'See insurance impact' },
      ]"
    />

    <p v-if="loading" class="text-ink-muted text-sm">Loading counters…</p>
    <p v-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>

    <!-- Fleet -->
    <section v-if="counters">
      <h3 class="text-[10px] uppercase tracking-widest text-ink-muted/60 mb-2">Fleet</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <Card padded>
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Total sensors</p>
          <p class="num text-2xl font-semibold text-ink-primary mt-1">{{ fmtNum(counters.totalSensors) }}</p>
          <p class="text-[10px] text-ink-muted/70 mt-0.5">Ocean + ground + air. Public + proprietary.</p>
        </Card>
        <Card padded>
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Ocean</p>
          <p class="num text-2xl font-semibold text-accent mt-1">{{ fmtNum(counters.oceanSensors) }}</p>
          <p class="text-[10px] text-ink-muted/70 mt-0.5">Buoys, submarine pressure nodes.</p>
        </Card>
        <Card padded>
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Ground</p>
          <p class="num text-2xl font-semibold text-accent mt-1">{{ fmtNum(counters.groundSensors) }}</p>
          <p class="text-[10px] text-ink-muted/70 mt-0.5">Met, air quality, soil.</p>
        </Card>
        <Card padded>
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Proprietary</p>
          <p class="num text-2xl font-semibold text-caution mt-1">{{ fmtNum(counters.proprietarySensors) }}</p>
          <p class="text-[10px] text-ink-muted/70 mt-0.5">DataSnake-deployed (subset of total).</p>
        </Card>
        <Card padded>
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Stale</p>
          <p
            class="num text-2xl font-semibold mt-1"
            :class="counters.staleSensors > 0 ? 'text-danger' : 'text-safe'"
          >{{ fmtNum(counters.staleSensors) }}</p>
          <p class="text-[10px] text-ink-muted/70 mt-0.5">No reading in last 60 min.</p>
        </Card>
      </div>
    </section>

    <!-- Throughput -->
    <section v-if="counters">
      <h3 class="text-[10px] uppercase tracking-widest text-ink-muted/60 mb-2">Throughput · 24h</h3>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card padded>
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Measurements ingested</p>
          <p class="num text-2xl font-semibold text-ink-primary mt-1">{{ fmtNum(counters.measurements24h) }}</p>
          <p class="text-[10px] text-ink-muted/70 mt-0.5">Last 24 hours, all sensors combined.</p>
        </Card>
        <Card padded>
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">API requests</p>
          <p class="num text-2xl font-semibold text-accent mt-1">{{ fmtNum(counters.apiRequests24h) }}</p>
          <p class="text-[10px] text-ink-muted/70 mt-0.5">/insurance-risk-verdict, last 24 h.</p>
        </Card>
        <Card padded>
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">API errors</p>
          <p
            class="num text-2xl font-semibold mt-1"
            :class="counters.apiErrors24h > 0 ? 'text-caution' : 'text-safe'"
          >{{ fmtNum(counters.apiErrors24h) }}</p>
          <p class="text-[10px] text-ink-muted/70 mt-0.5">4xx + 5xx responses, last 24 h.</p>
        </Card>
        <Card padded>
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Ingest failing</p>
          <p
            class="num text-2xl font-semibold mt-1"
            :class="counters.ingestFailing > 0 ? 'text-danger' : 'text-safe'"
          >{{ fmtNum(counters.ingestFailing) }}</p>
          <p class="text-[10px] text-ink-muted/70 mt-0.5">Sources with current status = failing.</p>
        </Card>
      </div>
    </section>

    <!-- Commercial -->
    <section v-if="counters">
      <h3 class="text-[10px] uppercase tracking-widest text-ink-muted/60 mb-2">Commercial</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        <Card padded>
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Active API keys</p>
          <p class="num text-2xl font-semibold text-ink-primary mt-1">{{ fmtNum(counters.activeApiKeys) }}</p>
          <p class="text-[10px] text-ink-muted/70 mt-0.5">Risk API integrations live right now.</p>
        </Card>
        <Card padded>
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Tenants</p>
          <p class="num text-2xl font-semibold text-ink-primary mt-1">{{ fmtNum(counters.tenants) }}</p>
          <p class="text-[10px] text-ink-muted/70 mt-0.5">Onboarded insurers / MGAs.</p>
        </Card>
        <Card padded>
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Policies uploaded</p>
          <p class="num text-2xl font-semibold text-ink-primary mt-1">{{ fmtNum(counters.policies) }}</p>
          <p class="text-[10px] text-ink-muted/70 mt-0.5">Across all tenants.</p>
        </Card>
      </div>
    </section>

    <p class="text-ink-muted/60 text-xs max-w-3xl">
      <strong class="text-ink-muted">How to read this page:</strong>
      Fleet = the hardware. Throughput = whether the hardware is
      actively feeding data into the system. Commercial = whether
      that data is reaching paying integrations and tenant accounts.
      All three rows green = healthy revenue-producing platform.
      Any red = next tab to investigate is named in the tile copy.
    </p>
  </div>
</template>
