<script setup lang="ts">
// TerraWatch — Phase 9.13.2: rolling z-score anomaly chart.
//
// Renders the time-series with a translucent rolling-mean ± 2σ band
// and flags any point where |z| > 2 as a red scatter dot. Reads from
// the measurements_anomalies RPC (migration 0029).

import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import type { AnomalyPoint } from '@/services/sensorPipeline'

use([CanvasRenderer, LineChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent])

const props = defineProps<{
  points:         AnomalyPoint[]
  parameterLabel: string
  unit:           string
  loading?:       boolean
}>()

const anomalyCount = computed(() => props.points.filter((p) => p.isAnomaly).length)

const option = computed(() => {
  const series = props.points.map((p) => [p.observedAt.getTime(), p.value])
  const band   = props.points.map((p) => {
    if (p.rollingMean == null || p.rollingStd == null) return [p.observedAt.getTime(), null, null]
    return [p.observedAt.getTime(), p.rollingMean - 2 * p.rollingStd, p.rollingMean + 2 * p.rollingStd]
  })
  const bandLow  = band.map((b) => [b[0], b[1]])
  const bandHigh = band.map((b, i) => {
    const lo = band[i]?.[1] ?? 0
    const hi = b[2] ?? 0
    return [b[0], lo == null || hi == null ? null : (hi as number) - (lo as number)]
  })
  const anomalies = props.points
    .filter((p) => p.isAnomaly)
    .map((p) => [p.observedAt.getTime(), p.value])

  return {
    backgroundColor: 'transparent',
    grid: { left: 48, right: 16, top: 28, bottom: 32 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1A2540',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#E6EDF7' },
      formatter: (params: Array<{ axisValue: number; data: unknown; seriesName: string }>) => {
        const first = params[0]
        if (!first) return ''
        const t = new Date(first.axisValue).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
        const main = params.find((p) => p.seriesName === props.parameterLabel)
        const val = main && Array.isArray(main.data) ? (main.data[1] as number).toFixed(2) : '—'
        return `${t}<br/><strong>${val} ${props.unit}</strong>`
      },
    },
    xAxis: {
      type: 'time',
      axisLabel: { color: '#8A97B1', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: props.unit,
      nameTextStyle: { color: '#8A97B1', fontSize: 11 },
      axisLabel: { color: '#8A97B1', fontSize: 11 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      scale: true,
    },
    series: [
      // Lower bound of the rolling mean ± 2σ band (invisible, stacks for the area)
      {
        name: 'band-low',
        type: 'line',
        data: bandLow,
        showSymbol: false,
        lineStyle: { width: 0 },
        stack: 'envelope',
        areaStyle: { color: 'transparent' },
        tooltip: { show: false },
      },
      // Upper bound delta — produces the translucent band
      {
        name: 'band-delta',
        type: 'line',
        data: bandHigh,
        showSymbol: false,
        lineStyle: { width: 0 },
        stack: 'envelope',
        areaStyle: { color: 'rgba(245, 183, 74, 0.10)' },
        tooltip: { show: false },
      },
      {
        name: props.parameterLabel,
        type: 'line',
        data: series,
        showSymbol: false,
        smooth: 0.2,
        lineStyle: { color: '#3FA9F5', width: 2 },
      },
      {
        name: 'anomalies',
        type: 'scatter',
        data: anomalies,
        symbolSize: 10,
        itemStyle: { color: '#FF6B6B', borderColor: '#0F1626', borderWidth: 1.5 },
        z: 10,
      },
    ],
  }
})
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-baseline justify-between gap-3">
      <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">
        Rolling 24h z-score · |z| &gt; 2 flagged
      </p>
      <p class="text-xs">
        <span
          class="num"
          :class="anomalyCount > 0 ? 'text-danger' : 'text-ink-muted'"
        >{{ anomalyCount }}</span>
        <span class="text-ink-muted"> anomalies in window</span>
      </p>
    </div>
    <div class="relative w-full h-64 sm:h-80 bg-surface-1 rounded-xl border border-white/5 overflow-hidden">
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center text-ink-muted text-sm z-10 bg-surface-1/60 backdrop-blur-sm">
        Loading…
      </div>
      <div v-if="!loading && !points.length" class="absolute inset-0 flex items-center justify-center text-ink-muted text-sm">
        No measurements in this window
      </div>
      <VChart v-if="points.length" :option="option" autoresize class="w-full h-full" />
    </div>
  </div>
</template>
