<script setup lang="ts">
// TerraWatch — Phase 9.13.2: dual-axis comparative chart for two
// parameters of the same sensor. Mirrors the user's datapreview
// "Comparative Analysis: Temperature vs Humidity" screenshot.

import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { ComparePoint, CorrelationSummary } from '@/services/sensorPipeline'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const props = defineProps<{
  points:      ComparePoint[]
  labelA:      string
  labelB:      string
  unitA:       string
  unitB:       string
  correlation: CorrelationSummary | null
  loading?:    boolean
}>()

const option = computed(() => {
  const a = props.points.map((p) => [p.observedAt.getTime(), p.valueA])
  const b = props.points.map((p) => [p.observedAt.getTime(), p.valueB])
  return {
    backgroundColor: 'transparent',
    grid: { left: 48, right: 56, top: 30, bottom: 32 },
    legend: {
      top: 4, right: 16,
      textStyle: { color: '#8A97B1', fontSize: 11 },
      data: [props.labelA, props.labelB],
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1A2540',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#E6EDF7' },
      formatter: (params: Array<{ axisValue: number; seriesName: string; data: [number, number] }>) => {
        const t = params[0] ? new Date(params[0].axisValue).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : ''
        const lines = params.map((p) => {
          const u = p.seriesName === props.labelA ? props.unitA : props.unitB
          return `${p.seriesName}: <strong>${p.data[1].toFixed(2)} ${u}</strong>`
        })
        return `${t}<br/>${lines.join('<br/>')}`
      },
    },
    xAxis: {
      type: 'time',
      axisLabel: { color: '#8A97B1', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: props.unitA,
        position: 'left',
        nameTextStyle: { color: '#FF6B6B', fontSize: 11 },
        axisLabel: { color: '#8A97B1', fontSize: 11 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        scale: true,
      },
      {
        type: 'value',
        name: props.unitB,
        position: 'right',
        nameTextStyle: { color: '#3FA9F5', fontSize: 11 },
        axisLabel: { color: '#8A97B1', fontSize: 11 },
        axisLine: { show: false },
        splitLine: { show: false },
        scale: true,
      },
    ],
    series: [
      {
        name: props.labelA,
        type: 'line',
        yAxisIndex: 0,
        data: a,
        showSymbol: false,
        smooth: 0.2,
        lineStyle: { color: '#FF6B6B', width: 2 },
      },
      {
        name: props.labelB,
        type: 'line',
        yAxisIndex: 1,
        data: b,
        showSymbol: false,
        smooth: 0.2,
        lineStyle: { color: '#3FA9F5', width: 2 },
      },
    ],
  }
})

function describeR(r: number | null): string {
  if (r == null) return '—'
  const a = Math.abs(r)
  if (a < 0.1)   return 'no correlation'
  if (a < 0.3)   return 'weak'
  if (a < 0.5)   return 'moderate'
  if (a < 0.7)   return 'strong'
  return 'very strong'
}

const sign = computed(() => {
  const r = props.correlation?.pearsonR
  if (r == null) return ''
  return r > 0 ? 'positive' : 'negative'
})
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-3">
    <div class="relative w-full h-64 sm:h-80 bg-surface-1 rounded-xl border border-white/5 overflow-hidden">
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center text-ink-muted text-sm z-10 bg-surface-1/60 backdrop-blur-sm">
        Loading…
      </div>
      <div v-if="!loading && !points.length" class="absolute inset-0 flex items-center justify-center text-ink-muted text-sm">
        No paired measurements in this window
      </div>
      <VChart v-if="points.length" :option="option" autoresize class="w-full h-full" />
    </div>

    <!-- Correlation summary tile -->
    <div class="rounded-xl border border-white/5 bg-surface-1 p-4 flex flex-col justify-between">
      <div>
        <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">Pearson r</p>
        <p class="text-3xl font-semibold num text-ink-primary mt-1">
          {{ correlation?.pearsonR != null ? correlation.pearsonR.toFixed(2) : '—' }}
        </p>
        <p class="text-xs text-ink-muted mt-1">
          <template v-if="correlation?.pearsonR != null">
            {{ sign }} · {{ describeR(correlation.pearsonR) }}
          </template>
          <template v-else>
            insufficient samples
          </template>
        </p>
      </div>
      <div class="mt-3 pt-3 border-t border-white/5">
        <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">Samples</p>
        <p class="num text-base text-ink-primary mt-0.5">
          {{ correlation?.nSamples.toLocaleString() ?? '—' }}
        </p>
      </div>
      <p class="text-[10px] text-ink-muted/60 mt-3 leading-snug">
        Pearson r is a unitless correlation coefficient between
        <span class="text-ink-muted">{{ labelA }}</span>
        and
        <span class="text-ink-muted">{{ labelB }}</span>,
        computed on hourly-aligned pairs over the selected window.
      </p>
    </div>
  </div>
</template>
