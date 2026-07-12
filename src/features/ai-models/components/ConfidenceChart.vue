<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { InferenceResult } from '@/types/aiModels'

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent])

const props = defineProps<{ results: InferenceResult[] }>()

const option = computed(() => {
  const byClass = new Map<string, number>()
  for (const r of props.results) {
    const prev = byClass.get(r.detectedClass) ?? 0
    byClass.set(r.detectedClass, Math.max(prev, r.confidence))
  }
  const entries = [...byClass.entries()].sort((a, b) => b[1] - a[1])

  return {
    backgroundColor: 'transparent',
    animation: false,
    grid: { top: 8, bottom: 28, left: 130, right: 50 },
    xAxis: {
      type: 'value',
      max: 1,
      axisLine:  { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      axisLabel: {
        color:     '#64748b',
        fontSize:  10,
        formatter: (v: number) => `${Math.round(v * 100)}%`,
      },
    },
    yAxis: {
      type:      'category',
      data:      entries.map(e => e[0]),
      axisLine:  { show: false },
      axisTick:  { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    tooltip: {
      trigger:   'item',
      formatter: (p: { name: string; value: number }) =>
        `${p.name}: <strong>${(p.value * 100).toFixed(1)}%</strong>`,
    },
    series: [{
      type: 'bar',
      data: entries.map(e => ({
        value:     e[1],
        itemStyle: { color: '#6366f1', borderRadius: [0, 3, 3, 0] },
      })),
      barMaxWidth: 20,
      label: {
        show:      true,
        position:  'right',
        color:     '#94a3b8',
        fontSize:  10,
        formatter: (p: { value: number }) => `${(p.value * 100).toFixed(0)}%`,
      },
    }],
  }
})
</script>

<template>
  <div>
    <p v-if="!results.length" class="text-ink-muted text-sm text-center py-8">
      No inference results yet.
    </p>
    <VChart
      v-else
      :option="option"
      :autoresize="true"
      class="h-52"
    />
  </div>
</template>
