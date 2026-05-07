<script setup lang="ts">
// TerraWatch — Phase 9.11: ocean research dashboard.
// Sibling to /monitoring/ocean (operational view). This one is the
// science-narrative surface: SST distribution today, wave-height
// distribution today, basin coverage map, gap callout for the proprietary
// submarine fleet.

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
  fetchBuoySstLatest,
  fetchWaveDistribution,
  type BuoySst,
  type WaveBucket,
  type ResearchCounters,
} from '@/services/research'

use([CanvasRenderer, BarChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, VisualMapComponent])

const counters = ref<ResearchCounters | null>(null)
const sst = ref<BuoySst[]>([])
const waves = ref<WaveBucket[]>([])
const loading = ref(true)
const errorMsg = ref<string | null>(null)

onMounted(async () => {
  try {
    const [c, s, w] = await Promise.all([
      fetchResearchCounters(),
      fetchBuoySstLatest(24),
      fetchWaveDistribution(24),
    ])
    counters.value = c
    sst.value = s
    waves.value = w
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
    { label: 'Buoys reporting (24h)', value: c.buoysReporting24h.toLocaleString() },
    { label: 'Measurements (24h)',    value: c.measurements24h.toLocaleString() },
    { label: 'SST samples now',       value: sst.value.length.toLocaleString() },
    {
      label: 'Median SST',
      value: sst.value.length ? medianSst(sst.value).toFixed(1) : '—',
      unit:  '°C',
    },
  ]
})

function medianSst(rows: BuoySst[]): number {
  const vals = rows.map((r) => r.sstC).sort((a, b) => a - b)
  const m = vals.length >> 1
  return vals.length % 2 ? (vals[m] ?? 0) : ((vals[m - 1] ?? 0) + (vals[m] ?? 0)) / 2
}

// SST scatter (lon/lat colored by temperature)
const sstMapOption = computed(() => {
  const points = sst.value
    .filter((s) => s.lat != null && s.lon != null)
    .map((s) => ({
      name: s.sensorName,
      value: [s.lon, s.lat, s.sstC],
    }))
  return {
    backgroundColor: 'transparent',
    grid: { left: 40, right: 16, top: 10, bottom: 30 },
    tooltip: {
      trigger: 'item',
      formatter: (p: { name: string; value: [number, number, number] }) =>
        `<b>${p.name}</b><br/>${p.value[2].toFixed(1)}°C SST<br/>${p.value[1].toFixed(2)}, ${p.value[0].toFixed(2)}`,
    },
    visualMap: {
      min: 0, max: 32, dimension: 2,
      orient: 'horizontal', left: 'center', bottom: 0,
      text: ['warm', 'cold'],
      textStyle: { color: '#8A97B1', fontSize: 10 },
      itemWidth: 10, itemHeight: 90,
      inRange: { color: ['#3FA9F5', '#3DDC97', '#F5B74A', '#FF6B6B'] },
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
      symbolSize: 6,
      data: points,
    }],
  }
})

// Wave-height distribution bar chart
const waveOption = computed(() => {
  return {
    backgroundColor: 'transparent',
    grid: { left: 50, right: 16, top: 16, bottom: 40 },
    tooltip: {
      trigger: 'axis',
      formatter: (p: Array<{ data: number; name: string }>) => {
        const point = p[0]
        if (!point) return ''
        const start = parseFloat(point.name)
        return `${start.toFixed(1)}–${(start + 0.5).toFixed(1)} m<br/><b>${point.data}</b> buoys`
      },
    },
    xAxis: {
      type: 'category',
      data: waves.value.map((w) => w.bucketM.toFixed(1)),
      axisLabel: { color: '#8A97B1' },
      name: 'Significant wave height (m)',
      nameLocation: 'middle', nameGap: 28,
      nameTextStyle: { color: '#8A97B1', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8A97B1' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      name: 'Buoys',
      nameTextStyle: { color: '#8A97B1', fontSize: 10 },
    },
    series: [{
      type: 'bar',
      data: waves.value.map((w) => w.cnt),
      barWidth: '70%',
      itemStyle: {
        color: 'rgba(63, 169, 245, 0.7)',
        borderColor: 'rgba(63, 169, 245, 1)',
        borderRadius: [4, 4, 0, 0],
      },
    }],
  }
})
</script>

<template>
  <AnalyticsScaffold
    domain="ocean"
    title="Ocean"
    subtitle="Sea-surface temperature distribution and wave-energy state across the global NDBC buoy network — refreshed hourly. The proprietary DataSnake submarine fleet extends below the surface."
    :counters="heroCounters"
    :sources="['NOAA NDBC buoys', 'NOAA SWPC (geomagnetic context)']"
  >
    <p v-if="loading" class="text-ink-muted text-sm">Loading…</p>
    <p v-else-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>

    <template v-else>
      <!-- SST coverage map -->
      <Card padded>
        <h2 class="text-base font-semibold text-ink-primary mb-2">
          Sea-surface temperature — latest reading per buoy (last 24h)
        </h2>
        <p v-if="!sst.length" class="text-ink-muted text-sm">
          No SST observations in the lookback window.
        </p>
        <VChart v-else :option="sstMapOption" autoresize style="height: 380px;" />
        <p class="text-[10px] text-ink-muted/60 mt-3">
          Each dot is one NDBC buoy with a fresh SST sample. The Pacific basin's
          near-empty mid-latitudes are an honest representation of the surface
          coverage gap — most of the planet's ocean has zero in-situ sensors today.
        </p>
      </Card>

      <!-- Wave height distribution -->
      <Card padded>
        <h2 class="text-base font-semibold text-ink-primary mb-2">
          Significant wave-height distribution (last 24h)
        </h2>
        <p v-if="!waves.length" class="text-ink-muted text-sm">
          No wave-height samples in the lookback window.
        </p>
        <VChart v-else :option="waveOption" autoresize style="height: 280px;" />
        <p class="text-[10px] text-ink-muted/60 mt-2">
          Buckets of 0.5m. Heavy right-tail (≥4m) typically tracks active storms in the
          Atlantic + East Pacific.
        </p>
      </Card>

      <GapCallout
        domain="ocean"
        headline="NDBC has ~1,500 surface buoys. The ocean is 361 million km². DataSnake's autonomous submarine fleet targets the abyssal + under-ice gaps that surface networks structurally cannot reach."
        body="Surface buoys answer surface-temperature, wave, wind, and atmospheric-pressure questions well. They cannot answer dissolved-oxygen profiles, deep-water current anomalies, sub-thermocline temperature gradients, or Arctic / Antarctic under-ice conditions. DataSnake's submersible fleet — initially a small swarm, scaling toward continental-shelf coverage — is engineered specifically for the data the surface fleet structurally can't generate."
        :stats="[
          { label: 'Surface buoys today', value: counters?.buoysReporting24h.toLocaleString() ?? '—' },
          { label: 'Ocean area covered', value: '<2%', unit: 'within 100 km of any sensor' },
          { label: 'Abyssal coverage', value: '~0.1%', unit: '>2,000m depth' },
          { label: 'Under-ice coverage', value: '~0%', unit: 'autonomous, year-round' },
        ]"
        :bullets="[
          'Phase 1: 5-unit pilot swarm in California Current + Gulf of Mexico — paired DO + temperature + current sensors, autonomous transit between fixed stations.',
          'Phase 2: 30 units across all major fishery + hypoxia hotspots; partner with NOAA Fisheries on real-time hypoxia warnings.',
          'Phase 3: under-ice payloads for Antarctic + Arctic year-round monitoring — currently the largest in-situ data desert on Earth.',
        ]"
      />
    </template>
  </AnalyticsScaffold>
</template>
