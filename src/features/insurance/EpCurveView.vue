<script setup lang="ts">
// TerraWatch / DataSnake — Module 3: EP Curve + Premium Impact.
//
// Side-by-side EP curve: legacy CAT-model baseline vs DataSnake-enhanced
// (sensor-data-prior). At each return period, the gap is the modeled
// loss reduction — and downstream, the premium-pricing improvement.

import { computed, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, MarkAreaComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import Card from '@/ui/Card.vue'
import InsuranceTabStrip from './components/InsuranceTabStrip.vue'
import DemoBadge from './components/DemoBadge.vue'
import MetricInfoPanel from './components/MetricInfoPanel.vue'
import { useMeta } from '@/composables/useMeta'
import { EP_CURVES, fmtUsd } from '@/data/insurance-mock'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, MarkAreaComponent])

useMeta(() => ({
  title:       'EP Curves — Insurance Intelligence',
  description: 'Loss-exceedance curves: legacy CAT model baseline vs DataSnake sensor-enhanced. The gap at 1-in-100yr is the premium-pricing improvement.',
}))

type CurveKey = keyof typeof EP_CURVES
const peril = ref<CurveKey>('combined')

const PERIL_OPTIONS: Array<{ key: CurveKey; label: string }> = [
  { key: 'combined', label: 'Combined' },
  { key: 'flood',    label: 'Flood' },
  { key: 'seismic',  label: 'Seismic' },
  { key: 'wind',     label: 'Wind' },
]

const curve = computed(() => EP_CURVES[peril.value])

const oneInHundred = computed(() => curve.value.find((p) => p.return_period === 100))

const totalSavingPv = computed(() => {
  // Quick-and-honest expected-loss saving over the curve. For a $/yr
  // figure, weight each return period by its annual probability (1/RP).
  return curve.value.reduce((s, p) => s + p.saving / p.return_period, 0) * 1e9
})

const epOption = computed(() => ({
  backgroundColor: 'transparent',
  grid: { left: 56, right: 24, top: 36, bottom: 50 },
  legend: {
    top: 0, textStyle: { color: '#8A97B1' },
    data: ['Baseline (legacy CAT model)', 'DataSnake-enhanced (sensor priors)'],
  },
  tooltip: {
    trigger: 'axis',
    formatter: (p: Array<{ axisValueLabel: string; data: number; seriesName: string; color: string }>) => {
      if (!p.length) return ''
      const rp = p[0]!.axisValueLabel
      const rows = p.map((row) =>
        `<div style="display:flex;align-items:center;gap:8px;">
           <span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${row.color}"></span>
           <span>${row.seriesName}: <b>$${row.data.toFixed(1)}B</b></span>
         </div>`,
      ).join('')
      return `<div style="font-size:11px;">1-in-${rp}yr<br/>${rows}</div>`
    },
  },
  xAxis: {
    type: 'category',
    data: curve.value.map((p) => p.return_period),
    name: 'Return period (yr)',
    nameLocation: 'middle', nameGap: 32,
    nameTextStyle: { color: '#8A97B1', fontSize: 10 },
    axisLabel: { color: '#8A97B1' },
    axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
  },
  yAxis: {
    type: 'value',
    name: 'Loss ($B)',
    nameLocation: 'middle', nameGap: 40,
    nameTextStyle: { color: '#8A97B1', fontSize: 10 },
    axisLabel: { color: '#8A97B1', formatter: (v: number) => '$' + v + 'B' },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
  },
  series: [
    {
      name: 'Baseline (legacy CAT model)', type: 'line',
      data: curve.value.map((p) => p.baseline_loss),
      smooth: true, symbol: 'circle', symbolSize: 7,
      lineStyle: { color: '#FF6B6B', width: 2 },
      itemStyle: { color: '#FF6B6B' },
      areaStyle: { color: '#FF6B6B', opacity: 0.05 },
    },
    {
      name: 'DataSnake-enhanced (sensor priors)', type: 'line',
      data: curve.value.map((p) => p.sensor_loss),
      smooth: true, symbol: 'circle', symbolSize: 7,
      lineStyle: { color: '#3FA9F5', width: 2 },
      itemStyle: { color: '#3FA9F5' },
      areaStyle: { color: '#3FA9F5', opacity: 0.08 },
      markLine: {
        silent: true,
        symbol: 'none',
        label: {
          color: '#3FA9F5',
          formatter: '1-in-100yr',
          position: 'insideEndTop',
          fontSize: 10,
        },
        lineStyle: { color: '#3FA9F5', type: 'dashed', width: 1 },
        data: [{ xAxis: 100 }],
      },
    },
  ],
}))
</script>

<template>
  <div>
    <InsuranceTabStrip />

    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header class="flex items-start justify-between gap-3 mb-5">
        <div>
          <p class="text-ink-muted text-xs tracking-widest uppercase">Module · EP Curves</p>
          <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
            Loss-exceedance: legacy vs sensor-enhanced
          </h1>
          <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-2xl">
            The CFO conversation: at every return period, how much does
            DataSnake's real-time data tighten the modeled loss? At 1-in-
            100yr that's typically a 20-25% reduction — large enough to
            move premium pricing measurably.
          </p>
        </div>
        <DemoBadge class="hidden sm:inline-flex" />
      </header>

      <!-- Peril selector -->
      <div class="flex flex-wrap items-center gap-1.5 mb-4">
        <span class="text-[10px] uppercase tracking-widest text-ink-muted/60 mr-1">Peril:</span>
        <button
          v-for="o in PERIL_OPTIONS"
          :key="o.key"
          class="text-xs px-3 py-1.5 rounded-full border transition-colors"
          :class="peril === o.key
            ? 'border-accent bg-accent/15 text-accent'
            : 'border-white/10 text-ink-muted hover:text-ink-primary hover:border-white/20'"
          @click="peril = o.key"
        >{{ o.label }}</button>
      </div>

      <!-- Chart -->
      <Card padded>
        <VChart :option="epOption" autoresize style="height: 380px;" />
        <MetricInfoPanel id="ep-curves.main-chart" />
      </Card>

      <!-- Annotation callout -->
      <Card padded class="mt-3 border-accent/30 bg-accent/[0.04]">
        <div class="flex items-start gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
               class="w-5 h-5 text-accent shrink-0 mt-0.5">
            <path d="M3 12h4l2-7 4 14 2-7h6"/>
          </svg>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-ink-primary">
              At 1-in-100yr, sensor priors reduce modeled loss by
              <span class="text-accent num">${{ oneInHundred?.saving.toFixed(1) ?? '—' }}B</span>.
            </h3>
            <p class="text-ink-muted text-sm mt-1">
              Annualized expected-loss saving across the full curve:
              <span class="text-ink-primary num">{{ fmtUsd(totalSavingPv) }}</span>
              per year — passes through to premium-pricing accuracy and
              capital-charge reductions.
            </p>
          </div>
        </div>
        <MetricInfoPanel id="ep-curves.callout" />
      </Card>

      <!-- Detail table -->
      <Card padded class="mt-3">
        <h2 class="text-base font-semibold text-ink-primary mb-3">Return-period detail</h2>
        <div class="overflow-x-auto -mx-3">
          <table class="w-full text-sm border-collapse min-w-[560px]">
            <thead>
              <tr class="text-[10px] uppercase tracking-widest text-ink-muted/60">
                <th class="text-left py-2 px-3">Return period</th>
                <th class="text-right py-2 px-3">Baseline ($B)</th>
                <th class="text-right py-2 px-3">DataSnake ($B)</th>
                <th class="text-right py-2 px-3">Saving</th>
                <th class="text-right py-2 px-3">Δ %</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              <tr v-for="p in curve" :key="p.return_period" class="text-ink-primary">
                <td class="py-2 px-3">1-in-{{ p.return_period }}yr</td>
                <td class="py-2 px-3 num text-right">${{ p.baseline_loss.toFixed(1) }}B</td>
                <td class="py-2 px-3 num text-right text-accent">${{ p.sensor_loss.toFixed(1) }}B</td>
                <td class="py-2 px-3 num text-right text-safe">+${{ p.saving.toFixed(1) }}B</td>
                <td class="py-2 px-3 num text-right text-safe">
                  −{{ ((p.saving / p.baseline_loss) * 100).toFixed(0) }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <MetricInfoPanel id="ep-curves.detail-table" />
      </Card>

      <p class="text-ink-muted/60 text-xs mt-5 max-w-3xl">
        <strong class="text-ink-muted">Methodology:</strong>
        Baseline runs a standard NEHRP/RMS-class CAT model with
        public-data priors (USGS catalog, NOAA SLR). Sensor-enhanced
        injects DataSnake submarine-pressure + ground-motion + met
        priors into the same model — narrowing the variance band at
        each return period because we replace catalog-inferred
        intensities with directly-measured ones. Sensor data does not
        reduce inherent hazard frequency, only the model's modeled
        uncertainty.
      </p>
    </div>
  </div>
</template>
