<script setup lang="ts">
// TerraWatch — Phase 9.12: detail panel for a single county.
// Shows the four FEMA NRI composite scores, a per-hazard EAL bar chart
// across the spotlight perils, and a live "active threats in this state
// right now" callout that ties the static index to current activity.

import { computed } from 'vue'
import VChart from 'vue-echarts'
import Card from '@/ui/Card.vue'
import type { CountyDetail } from '@/services/insurance'

const props = defineProps<{
  detail:   CountyDetail | null
  loading?: boolean
}>()

function fmtUsd(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return '—'
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(0)}K`
  return `$${usd.toFixed(0)}`
}

function fmtScore(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toFixed(1)
}

const ratingTone = computed(() => {
  const r = props.detail?.riskRating?.toLowerCase() ?? ''
  if (r.includes('very high')) return 'danger'
  if (r.includes('relatively high') || r.includes('high')) return 'caution'
  return 'safe'
})

interface HazardDatum { name: string; value: number | null; tone: 'flood' | 'wildfire' | 'hurricane' | 'tornado' | 'earthquake' }

const hazardBars = computed<HazardDatum[]>(() => {
  const d = props.detail
  if (!d) return []
  const all: HazardDatum[] = [
    { name: 'Flood',      value: d.ealFlood,      tone: 'flood' },
    { name: 'Wildfire',   value: d.ealWildfire,   tone: 'wildfire' },
    { name: 'Hurricane',  value: d.ealHurricane,  tone: 'hurricane' },
    { name: 'Tornado',    value: d.ealTornado,    tone: 'tornado' },
    { name: 'Earthquake', value: d.ealEarthquake, tone: 'earthquake' },
  ]
  return all.filter((h) => h.value != null && h.value > 0)
})

const hazardOption = computed(() => {
  const palette: Record<HazardDatum['tone'], string> = {
    flood:      '#3FA9F5',
    wildfire:   '#F5B74A',
    hurricane:  '#B46BFF',
    tornado:    '#7EC9FF',
    earthquake: '#FF6B6B',
  }
  return {
    backgroundColor: 'transparent',
    grid: { left: 100, right: 24, top: 8, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      formatter: (p: Array<{ data: number; name: string }>) => {
        const point = p[0]
        if (!point) return ''
        return `<b>${point.name}</b><br/>EAL: ${fmtUsd(point.data)}`
      },
    },
    xAxis: {
      type: 'value',
      axisLabel: {
        color: '#8A97B1',
        formatter: (v: number) => fmtUsd(v),
      },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    yAxis: {
      type: 'category',
      data: hazardBars.value.map((h) => h.name),
      axisLabel: { color: '#8A97B1' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    series: [{
      type: 'bar',
      data: hazardBars.value.map((h) => ({
        value: h.value ?? 0,
        itemStyle: { color: palette[h.tone] },
      })),
      barWidth: 18,
    }],
  }
})
</script>

<template>
  <Card padded>
    <p v-if="loading" class="text-ink-muted text-sm">Loading county detail…</p>
    <p v-else-if="!detail" class="text-ink-muted text-sm">
      Select a county from the lists or charts above.
    </p>

    <template v-else>
      <!-- Header -->
      <div class="flex items-baseline justify-between gap-3 mb-4">
        <div class="min-w-0">
          <p class="text-[10px] uppercase tracking-widest text-ink-muted/70">
            County FIPS {{ detail.countyFips }}
          </p>
          <h2 class="text-lg sm:text-xl font-semibold text-ink-primary mt-0.5 truncate">
            {{ detail.countyName }}, {{ detail.state }}
          </h2>
          <p v-if="detail.population != null" class="text-ink-muted text-xs mt-0.5">
            Population: <span class="num text-ink-primary">{{ detail.population.toLocaleString() }}</span>
          </p>
        </div>
        <span
          v-if="detail.riskRating"
          class="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded border"
          :class="{
            'border-danger/40  text-danger  bg-danger/10':  ratingTone === 'danger',
            'border-caution/40 text-caution bg-caution/10': ratingTone === 'caution',
            'border-safe/40    text-safe    bg-safe/10':    ratingTone === 'safe',
          }"
        >
          {{ detail.riskRating }}
        </span>
      </div>

      <!-- Stat tiles -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div class="rounded-lg border border-white/5 bg-surface-0/60 p-3">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Risk score</p>
          <p class="text-xl font-semibold num text-ink-primary mt-0.5">
            {{ fmtScore(detail.riskScore) }}
          </p>
        </div>
        <div class="rounded-lg border border-white/5 bg-surface-0/60 p-3">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">EAL total</p>
          <p class="text-xl font-semibold num text-ink-primary mt-0.5">
            {{ fmtUsd(detail.expectedAnnualLossTotal) }}
          </p>
        </div>
        <div class="rounded-lg border border-white/5 bg-surface-0/60 p-3">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Soc. vulnerability</p>
          <p class="text-xl font-semibold num text-ink-primary mt-0.5">
            {{ fmtScore(detail.socialVulnerability) }}
          </p>
        </div>
        <div class="rounded-lg border border-white/5 bg-surface-0/60 p-3">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Comm. resilience</p>
          <p class="text-xl font-semibold num text-ink-primary mt-0.5">
            {{ fmtScore(detail.communityResilience) }}
          </p>
        </div>
      </div>

      <!-- Active threats note -->
      <div
        v-if="detail.activeThreats24h > 0"
        class="rounded-lg border border-caution/30 bg-caution/5 px-3 py-2.5 mb-4 flex items-start gap-2"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
             class="w-4 h-4 text-caution shrink-0 mt-0.5">
          <path d="m12 9 .01 4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        </svg>
        <p class="text-sm text-ink-primary">
          <span class="font-semibold num">{{ detail.activeThreats24h }}</span>
          active elevated event<span v-if="detail.activeThreats24h !== 1">s</span>
          across <span class="text-ink-muted">{{ detail.state }}</span> in the last 24h.
        </p>
      </div>

      <!-- Per-hazard EAL bar chart -->
      <div>
        <h3 class="text-sm font-semibold text-ink-primary mb-2">
          Expected annual loss by hazard
        </h3>
        <p v-if="!hazardBars.length" class="text-ink-muted text-sm">
          No spotlight-hazard EAL data for this county.
        </p>
        <VChart v-else :option="hazardOption" autoresize style="height: 220px;" />
      </div>
    </template>
  </Card>
</template>
