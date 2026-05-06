<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import type { MeasurementPoint } from '@/types/measurement'

// Tree-shaken ECharts setup — only the bits we need. Total bundle impact
// is closer to 150KB gzipped than the 300KB advertised on echarts.org.
use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
])

const props = defineProps<{
  series: MeasurementPoint[]
  parameterLabel: string
  unit: string
  loading?: boolean
}>()

const chartRef = shallowRef<InstanceType<typeof VChart> | null>(null)

// Build ECharts option. The min/max envelope is only meaningful when the
// RPC returned hourly aggregates (>36h windows) — for raw resolution they
// equal the point value, so we suppress the band.
const option = computed(() => {
  const data = props.series.map((p) => [p.observedAt.getTime(), p.value])
  const hasEnvelope = props.series.some((p) => p.minValue !== p.value || p.maxValue !== p.value)
  const minBand = hasEnvelope ? props.series.map((p) => [p.observedAt.getTime(), p.minValue]) : []
  const maxBand = hasEnvelope ? props.series.map((p) => [p.observedAt.getTime(), p.maxValue]) : []

  return {
    backgroundColor: 'transparent',
    grid: { left: 48, right: 16, top: 24, bottom: 56 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1A2540',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#E6EDF7' },
      formatter: (params: { axisValue: number; data: [number, number]; seriesName: string }[]) => {
        const first = params[0]
        if (!first) return ''
        const t = new Date(first.axisValue)
        const stamp = t.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
        const main = params.find((p) => p.seriesName === props.parameterLabel)
        if (!main) return ''
        return `${stamp}<br/><strong>${main.data[1].toFixed(2)} ${props.unit}</strong>`
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
    dataZoom: [
      { type: 'inside', filterMode: 'none' },
      {
        type: 'slider',
        height: 20,
        bottom: 8,
        backgroundColor: 'rgba(255,255,255,0.02)',
        fillerColor: 'rgba(63,169,245,0.15)',
        borderColor: 'rgba(255,255,255,0.05)',
        handleStyle: { color: '#3FA9F5', borderColor: '#3FA9F5' },
        textStyle: { color: '#8A97B1', fontSize: 10 },
      },
    ],
    series: [
      ...(hasEnvelope ? [
        // min/max envelope rendered as a translucent band — gives a sense
        // of intra-hour variability for downsampled views.
        {
          name: 'min',
          type: 'line',
          data: minBand,
          showSymbol: false,
          lineStyle: { width: 0 },
          stack: 'envelope',
          areaStyle: { color: 'transparent' },
          tooltip: { show: false },
        },
        {
          name: 'max',
          type: 'line',
          data: maxBand.map((p, i) => {
            const lo = minBand[i]?.[1] ?? 0
            return [p[0], (p[1] as number) - (lo as number)]
          }),
          showSymbol: false,
          lineStyle: { width: 0 },
          stack: 'envelope',
          areaStyle: { color: 'rgba(63,169,245,0.12)' },
          tooltip: { show: false },
        },
      ] : []),
      {
        name: props.parameterLabel,
        type: 'line',
        data,
        showSymbol: false,
        smooth: 0.2,
        lineStyle: { color: '#3FA9F5', width: 2 },
        emphasis: { focus: 'series' },
      },
    ],
  }
})
</script>

<template>
  <div class="relative w-full h-72 sm:h-96 bg-surface-1 rounded-xl border border-white/5 overflow-hidden">
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center text-ink-muted text-sm z-10 bg-surface-1/60 backdrop-blur-sm">
      Loading time series…
    </div>
    <div v-if="!loading && !series.length" class="absolute inset-0 flex items-center justify-center text-ink-muted text-sm">
      No measurements in this window
    </div>
    <VChart
      v-if="series.length"
      ref="chartRef"
      :option="option"
      autoresize
      class="w-full h-full"
    />
  </div>
</template>
