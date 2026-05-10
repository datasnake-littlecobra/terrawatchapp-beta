<script setup lang="ts">
// TerraWatch — Phase 9.11: seismic & volcanic-hazard research dashboard.
// Magnitude-frequency (Gutenberg-Richter) plot from the last 90 days
// of USGS quakes, top regions, volcano alert timeline, gap callout for
// proprietary ground-motion sensors.

import { computed, onMounted, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import Card from '@/ui/Card.vue'
import AnalyticsScaffold from './AnalyticsScaffold.vue'
import GapCallout from './GapCallout.vue'
import {
  fetchResearchCounters,
  fetchQuakeMagFreq,
  fetchQuakeTopRegions,
  fetchVolcanoTimeline,
  type MagFreqBin,
  type QuakeRegion,
  type VolcanoEvent,
  type ResearchCounters,
} from '@/services/research'

use([CanvasRenderer, BarChart, LineChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent])

const counters = ref<ResearchCounters | null>(null)
const magFreq = ref<MagFreqBin[]>([])
const regions = ref<QuakeRegion[]>([])
const volcanoes = ref<VolcanoEvent[]>([])
const loading = ref(true)
const errorMsg = ref<string | null>(null)

onMounted(async () => {
  try {
    const [c, m, r, v] = await Promise.all([
      fetchResearchCounters(),
      fetchQuakeMagFreq(90, 0.5),
      fetchQuakeTopRegions(30, 10),
      fetchVolcanoTimeline(90),
    ])
    counters.value = c
    magFreq.value = m
    regions.value = r
    volcanoes.value = v
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
    { label: 'M5+ earthquakes (30d)', value: c.quakesM5_30d.toLocaleString() },
    {
      label: 'Days since last M7+',
      value: c.daysSinceM7 >= 9999 ? '∞' : Math.round(c.daysSinceM7).toString(),
      tone:  c.daysSinceM7 < 30 ? 'danger' as const
           : c.daysSinceM7 < 90 ? 'caution' as const
           : 'safe' as const,
    },
    { label: 'Active volcanoes (30d)', value: c.volcanoesActive30d.toLocaleString() },
    { label: 'Mag bins resolved (90d)', value: magFreq.value.length.toString() },
  ]
})

// Gutenberg–Richter — log-scale Y axis, magnitude X axis
const grOption = computed(() => {
  // Cumulative version: at each bin, count = number of events ≥ that magnitude.
  const sorted = [...magFreq.value].sort((a, b) => a.magBin - b.magBin)
  const cumulative: Array<[number, number]> = []
  let total = sorted.reduce((s, b) => s + b.cnt, 0)
  for (const b of sorted) {
    cumulative.push([b.magBin, total])
    total -= b.cnt
  }
  return {
    backgroundColor: 'transparent',
    grid: { left: 60, right: 16, top: 16, bottom: 50 },
    tooltip: {
      trigger: 'axis',
      formatter: (p: Array<{ data: [number, number]; seriesName: string }>) => {
        const point = p[0]
        if (!point) return ''
        return `M${point.data[0].toFixed(1)}+<br/><b>${point.data[1].toLocaleString()}</b> events (last 90d)`
      },
    },
    xAxis: {
      type: 'value',
      name: 'Magnitude (≥)',
      nameLocation: 'middle', nameGap: 30,
      nameTextStyle: { color: '#8A97B1', fontSize: 10 },
      axisLabel: { color: '#8A97B1' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    yAxis: {
      type: 'log',
      name: 'Cumulative events',
      nameLocation: 'middle', nameGap: 40,
      nameTextStyle: { color: '#8A97B1', fontSize: 10 },
      axisLabel: { color: '#8A97B1' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [{
      name: 'cumulative',
      type: 'line',
      symbol: 'circle', symbolSize: 8,
      data: cumulative,
      itemStyle: { color: '#3FA9F5' },
      lineStyle: { color: '#3FA9F5', width: 2 },
      areaStyle: { color: 'rgba(63, 169, 245, 0.08)' },
    }],
  }
})

// Volcano timeline — events on a date axis, by source
const volcanoOption = computed(() => {
  const palette: Record<string, string> = {
    'usgs.volcanoes':  '#3FA9F5',
    'smithsonian.gvp': '#B46BFF',
    'gdacs.alerts':    '#F5B74A',
  }
  const grouped = new Map<string, Array<[number, number, string]>>()
  for (const v of volcanoes.value) {
    const key = v.source
    if (!grouped.has(key)) grouped.set(key, [])
    const sevY = v.severity === 'danger' ? 3 : v.severity === 'caution' ? 2 : 1
    grouped.get(key)!.push([v.occurredAt.getTime(), sevY, v.volcanoName])
  }
  const series = Array.from(grouped.entries()).map(([source, data]) => ({
    name: source, type: 'scatter' as const, symbolSize: 9,
    data,
    itemStyle: { color: palette[source] ?? '#8A97B1' },
  }))
  return {
    backgroundColor: 'transparent',
    grid: { left: 90, right: 16, top: 30, bottom: 36 },
    tooltip: {
      trigger: 'item',
      formatter: (p: { data: [number, number, string]; seriesName: string }) => {
        const date = new Date(p.data[0]).toLocaleDateString()
        const sev = p.data[1] === 3 ? 'danger' : p.data[1] === 2 ? 'caution' : 'advisory'
        return `<b>${p.data[2]}</b><br/>${date}<br/>${sev}<br/><span style="opacity:.6">${p.seriesName}</span>`
      },
    },
    legend: { textStyle: { color: '#8A97B1' }, top: 0 },
    xAxis: {
      type: 'time',
      axisLabel: { color: '#8A97B1' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    yAxis: {
      type: 'category',
      data: ['advisory', 'caution', 'danger'],
      axisLabel: { color: '#8A97B1' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    series,
  }
})
</script>

<template>
  <AnalyticsScaffold
    domain="seismic"
    title="Seismic & volcanic hazard"
    subtitle="What 90 days of public seismic + volcanic data say about regional rates and active unrest. The Gutenberg–Richter slope below tells you what magnitude to expect at what frequency in your basin."
    :counters="heroCounters"
    :sources="['USGS earthquakes', 'USGS HANS volcanoes', 'Smithsonian GVP', 'GDACS multi-hazard']"
  >
    <p v-if="loading" class="text-ink-muted text-sm">Loading…</p>
    <p v-else-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>

    <template v-else>
      <!-- Gutenberg-Richter -->
      <Card padded>
        <h2 class="text-base font-semibold text-ink-primary mb-1">
          Magnitude–frequency distribution (Gutenberg–Richter, last 90 days, M≥2.5)
        </h2>
        <p class="text-ink-muted text-sm mb-3">
          Cumulative events at or above each magnitude. The slope of this line on a log axis
          is the <em>b-value</em> — a near-universal feature of regional seismicity around 1.0.
          Deviations indicate localized stress states or aftershock sequences.
        </p>
        <p v-if="!magFreq.length" class="text-ink-muted text-sm">
          No earthquake data in the lookback window. Check the ingest health dashboard.
        </p>
        <VChart v-else :option="grOption" autoresize style="height: 360px;" />
      </Card>

      <!-- Top regions + Volcano timeline -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card padded>
          <h2 class="text-base font-semibold text-ink-primary mb-3">Most-active regions (30d)</h2>
          <p v-if="!regions.length" class="text-ink-muted text-sm">No data.</p>
          <ul v-else class="divide-y divide-white/5 text-sm">
            <li v-for="r in regions" :key="r.region" class="py-2 flex items-center justify-between">
              <p class="text-ink-primary truncate flex-1 pr-3">{{ r.region }}</p>
              <div class="text-right">
                <p class="num text-ink-primary">{{ r.count }}</p>
                <p class="text-[10px] text-ink-muted">max M{{ r.maxMag.toFixed(1) }}</p>
              </div>
            </li>
          </ul>
        </Card>

        <Card padded>
          <h2 class="text-base font-semibold text-ink-primary mb-3">Volcano alerts (last 90d)</h2>
          <p v-if="!volcanoes.length" class="text-ink-muted text-sm">
            No volcano alerts in the lookback window.
          </p>
          <VChart v-else :option="volcanoOption" autoresize style="height: 280px;" />
          <p class="text-[10px] text-ink-muted/60 mt-2">
            Y-axis = severity tier (Smithsonian color codes simplified). Each dot is one
            advisory bulletin; clusters indicate sustained unrest.
          </p>
        </Card>
      </div>

      <GapCallout
        domain="seismic"
        headline="USGS + GDACS resolve M2.5+ globally where seismometers exist. ~80% of the developing world has no permanent broadband station within 200 km. DataSnake portable ground-motion units target the rate-resolution gap."
        body="Seismicity is resolved well in the US, Japan, EU, and Chile — and unevenly elsewhere. The b-value plot above is reliable for high-station-density regions; for the rest of the world, the catalog is sparse below M4.5, hiding the smaller-event structure that gives weeks-to-months of foreshock context. DataSnake's compact ground-motion units are designed for rapid deployment to under-instrumented basins after operator request."
        :stats="[
          { label: 'M5+ events (30d)', value: counters?.quakesM5_30d.toLocaleString() ?? '—' },
          { label: 'Permanent seismometers (global)', value: '~5,000' },
          { label: 'Coverage gap (developing world, M3+)', value: '~80%' },
          { label: 'Active volcanoes monitored continuously', value: '~50', unit: 'of ~1,500 globally' },
        ]"
        :bullets="[
          'Phase 1: 20-unit pilot deployment with academic partners in Indonesia + Philippines (Mayon-class events fundamentally drove this product).',
          'Phase 2: ground-motion + tilt + InSAR-correlated nodes around active volcanic complexes (Smithsonian-aligned target list).',
          'Phase 3: long-tail coverage for under-monitored intraplate basins; rapid-deploy kits for emergency response.',
        ]"
      />
    </template>
  </AnalyticsScaffold>
</template>
