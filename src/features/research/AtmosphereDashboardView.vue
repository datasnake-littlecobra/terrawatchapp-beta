<script setup lang="ts">
// TerraWatch — Phase 9.11: atmosphere research dashboard.
// Surfaces what the public-data baseline can answer about air quality,
// heat, and wildfire smoke. The DataSnake fleet gap callout calls out
// the geographic + frequency holes the proprietary tier targets.

import { computed, onMounted, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, VisualMapComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import Card from '@/ui/Card.vue'
import AnalyticsScaffold from './AnalyticsScaffold.vue'
import GapCallout from './GapCallout.vue'
import {
  fetchResearchCounters,
  fetchAqTopStations,
  fetchHeatAdvisories,
  fetchActiveWildfires,
  type AqStation,
  type HeatAdvisoryRollup,
  type ActiveWildfire,
  type ResearchCounters,
} from '@/services/research'

use([CanvasRenderer, BarChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, VisualMapComponent])

const counters = ref<ResearchCounters | null>(null)
const aqStations = ref<AqStation[]>([])
const heatRows = ref<HeatAdvisoryRollup[]>([])
const wildfires = ref<ActiveWildfire[]>([])
const loading = ref(true)
const errorMsg = ref<string | null>(null)

onMounted(async () => {
  try {
    const [c, aq, heat, fires] = await Promise.all([
      fetchResearchCounters(),
      fetchAqTopStations(7, 30),
      fetchHeatAdvisories(),
      fetchActiveWildfires(150),
    ])
    counters.value = c
    aqStations.value = aq
    heatRows.value = heat
    wildfires.value = fires
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to load.'
  } finally {
    loading.value = false
  }
})

const heroCounters = computed(() => {
  if (!counters.value) return []
  const c = counters.value
  return [
    { label: 'AQ stations (24h)',    value: c.aqStations24h.toLocaleString() },
    { label: 'Countries (7d)',       value: c.aqCountries7d.toLocaleString() },
    {
      label: 'Max PM2.5 (24h)',
      value: c.aqMaxPm25_24h ? c.aqMaxPm25_24h.toFixed(0) : '—',
      unit:  'µg/m³',
      tone:  c.aqMaxPm25_24h >= 150 ? 'danger' as const
           : c.aqMaxPm25_24h >= 55  ? 'caution' as const
           : 'safe' as const,
    },
    { label: 'Active wildfires (14d)', value: c.wildfiresActive14d.toLocaleString() },
  ]
})

// AQI bar chart (top stations by latest PM2.5)
const aqOption = computed(() => {
  const sorted = [...aqStations.value].sort((a, b) => b.pm25 - a.pm25).slice(0, 20)
  return {
    backgroundColor: 'transparent',
    grid: { left: 130, right: 30, top: 10, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (p: Array<{ data: number; name: string }>) => {
        const point = p[0]
        if (!point) return ''
        const stn = sorted.find((s) => s.stationName === point.name)
        return `<b>${point.name}</b><br/>${point.data.toFixed(1)} µg/m³ PM2.5${stn?.country ? `<br/>${stn.country}` : ''}`
      },
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#8A97B1' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      name: 'µg/m³',
      nameLocation: 'middle',
      nameGap: 24,
      nameTextStyle: { color: '#8A97B1', fontSize: 10 },
    },
    yAxis: {
      type: 'category',
      data: sorted.map((s) => s.stationName).reverse(),
      axisLabel: { color: '#8A97B1', fontSize: 11, width: 120, overflow: 'truncate' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    visualMap: {
      show: false,
      min: 0, max: 250, dimension: 0,
      inRange: {
        color: ['#3DDC97', '#F5B74A', '#FF6B6B'],
      },
    },
    series: [{
      type: 'bar',
      data: sorted.map((s) => s.pm25).reverse(),
      barWidth: 12,
      itemStyle: { borderRadius: [0, 4, 4, 0] },
    }],
  }
})

// Wildfire scatter (lat/lon, sized by recency)
const fireMapOption = computed(() => {
  const points = wildfires.value
    .filter((w) => w.lat != null && w.lon != null)
    .map((w) => {
      const ageH = (Date.now() - w.occurredAt.getTime()) / 3600000
      return {
        name: w.title,
        value: [w.lon, w.lat, Math.max(4, 14 - Math.log2(ageH + 1) * 2), w.country],
      }
    })
  return {
    backgroundColor: 'transparent',
    grid: { left: 40, right: 16, top: 10, bottom: 30 },
    tooltip: {
      trigger: 'item',
      formatter: (p: { name: string; value: [number, number, number, string] }) =>
        `<b>${p.name}</b><br/>${p.value[3] || ''}<br/>${p.value[1].toFixed(2)}, ${p.value[0].toFixed(2)}`,
    },
    xAxis: {
      type: 'value', min: -180, max: 180,
      axisLabel: { color: '#8A97B1' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      name: 'Longitude', nameLocation: 'middle', nameGap: 24,
      nameTextStyle: { color: '#8A97B1', fontSize: 10 },
    },
    yAxis: {
      type: 'value', min: -90, max: 90,
      axisLabel: { color: '#8A97B1' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [{
      type: 'scatter',
      symbolSize: (val: number[]) => val[2],
      data: points,
      itemStyle: {
        color: 'rgba(245, 113, 74, 0.7)',
        borderColor: 'rgba(245, 113, 74, 1)',
      },
    }],
  }
})

function severityClass(s: string): string {
  if (s === 'danger')  return 'text-danger'
  if (s === 'caution') return 'text-caution'
  return 'text-safe'
}
</script>

<template>
  <AnalyticsScaffold
    domain="atmosphere"
    title="Atmosphere"
    subtitle="What public air-quality, heat, and wildfire data tell us right now — and where DataSnake fleet sensors would close the gaps."
    :counters="heroCounters"
    :sources="['OpenAQ PM2.5', 'NWS heat advisories', 'NASA EONET wildfires']"
  >
    <p v-if="loading" class="text-ink-muted text-sm">Loading…</p>
    <p v-else-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>

    <template v-else>
      <!-- AQI top stations -->
      <Card padded>
        <div class="flex items-baseline justify-between mb-2">
          <h2 class="text-base font-semibold text-ink-primary">Latest PM2.5 — top 20 reporting stations (last 7 days)</h2>
          <span class="text-[10px] uppercase tracking-wider text-ink-muted/70">µg/m³</span>
        </div>
        <p v-if="!aqStations.length" class="text-ink-muted text-sm">
          No air-quality data flowing yet. See DEPLOY.md → "Air-quality showing zero rows?"
        </p>
        <VChart v-else :option="aqOption" autoresize style="height: 460px;" />
        <p class="text-[10px] text-ink-muted/60 mt-2">
          Color band — green &lt;55 µg/m³ (US EPA "Moderate"), amber 55-150 ("Unhealthy for sensitive"),
          red &gt;150 ("Unhealthy" or worse).
        </p>
      </Card>

      <!-- Heat advisories table + wildfire scatter side-by-side on desktop -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card padded>
          <h2 class="text-base font-semibold text-ink-primary mb-3">Active heat events (last 7 days)</h2>
          <p v-if="!heatRows.length" class="text-ink-muted text-sm">
            No active heat advisories. Heat events fire seasonally (US summer); empty here is
            the right answer right now.
          </p>
          <ul v-else class="divide-y divide-white/5 text-sm">
            <li v-for="r in heatRows" :key="r.region" class="py-2 flex items-center justify-between">
              <div>
                <p class="text-ink-primary">{{ r.region || 'Unspecified' }}</p>
                <p class="text-[10px] text-ink-muted/60">{{ r.latest.toLocaleDateString() }}</p>
              </div>
              <div class="text-right">
                <p class="num text-ink-primary">{{ r.count }}</p>
                <p class="text-[10px] uppercase tracking-wider" :class="severityClass(r.mostSevere)">
                  {{ r.mostSevere }}
                </p>
              </div>
            </li>
          </ul>
        </Card>

        <Card padded>
          <h2 class="text-base font-semibold text-ink-primary mb-3">Active wildfires (last 14 days)</h2>
          <p v-if="!wildfires.length" class="text-ink-muted text-sm">
            No active fires from EONET in the lookback window.
          </p>
          <VChart v-else :option="fireMapOption" autoresize style="height: 320px;" />
          <p class="text-[10px] text-ink-muted/60 mt-2">
            Each point = one EONET-tracked fire event. Larger dot = more recent. Drag the chart
            to inspect tooltips.
          </p>
        </Card>
      </div>

      <GapCallout
        domain="atmosphere"
        headline="OpenAQ covers ~14,000 fixed stations — concentrated in the global north. DataSnake portable PM2.5 nodes target the 60%+ of human-inhabited area without any reading."
        body="Public station density is excellent in the US, EU, and East Asia, sparse in Africa, South America, and most of South Asia. Wildfire-smoke transport (visible in the panel above) crosses ocean and continental scales but receiving-end air quality is only resolved where stations exist. DataSnake's portable units ship to high-population, low-coverage corridors first."
        :stats="[
          { label: 'Public stations (24h)',  value: counters?.aqStations24h.toLocaleString() ?? '—' },
          { label: 'Countries reporting (7d)', value: counters?.aqCountries7d.toLocaleString() ?? '—' },
          { label: 'Sub-Saharan Africa coverage gap', value: '~75%', unit: 'pop. uncovered' },
          { label: 'South Asia rural coverage gap', value: '~80%', unit: 'pop. uncovered' },
        ]"
        :bullets="[
          'Phase 1: 50 portable PM2.5 + temp/humidity nodes deployed in Mumbai, Lagos, Jakarta, Manila — paired with EONET smoke plumes for arrival-time validation.',
          'Phase 2: paired CO2 + NO2 channels for traffic-corridor monitoring (no public network covers this at neighborhood scale).',
          'Phase 3: ~5,000 nodes globally; partner with city sustainability offices on policy-grade reports.',
        ]"
      />
    </template>
  </AnalyticsScaffold>
</template>
