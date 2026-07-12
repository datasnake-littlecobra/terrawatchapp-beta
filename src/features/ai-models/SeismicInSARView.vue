<script setup lang="ts">
// TerraWatch — Phase 10.0: Seismic / InSAR deformation detection model page.
//
// ECharts HeatmapChart showing surface deformation magnitude from
// InSAR inference results. The heatmap is the "interferogram analog":
// blue=no deformation, yellow=moderate, red=high displacement.
// Axes are discretised lat/lon buckets from the inference log.

import { computed, onMounted, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { HeatmapChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import AIModelTabStrip from './components/AIModelTabStrip.vue'
import ConfidenceChart from './components/ConfidenceChart.vue'
import InferenceLogTable from './components/InferenceLogTable.vue'
import InferenceControls from './components/InferenceControls.vue'
import SqlPlayground from './components/SqlPlayground.vue'
import SqlInterpretationPanel from '@/features/weather-intelligence/components/SqlInterpretationPanel.vue'
import Card from '@/ui/Card.vue'
import { useMeta } from '@/composables/useMeta'
import { fetchInferenceResults } from '@/services/aiModels'
import type { InferenceResult } from '@/types/aiModels'

use([CanvasRenderer, HeatmapChart, GridComponent, TooltipComponent, VisualMapComponent])

useMeta(() => ({
  title:       'Seismic InSAR — AI/ML Intelligence',
  description: 'CNN+Transfer Learning model for InSAR surface deformation detection: subsidence, uplift, volcanic and seismic deformation events.',
}))

const MODEL_SLUG = 'seismic-insar'

const results         = ref<InferenceResult[]>([])
const filteredResults = ref<InferenceResult[]>([])
const loading         = ref(true)
const errorMsg        = ref<string | null>(null)

const SEISMIC_EXAMPLES = [
  {
    label: 'All events',
    sql: `select id, detected_class, confidence, lat, lon,
  metadata->>'max_displacement_cm' as displacement_cm,
  metadata->>'event_date'          as event_date,
  inferred_at
from public.model_inference_log
where model_slug = 'seismic-insar'
order by inferred_at desc
limit 20;`,
  },
  {
    label: 'High displacement (>10 cm)',
    sql: `select detected_class, confidence, lat, lon,
  (metadata->>'max_displacement_cm')::numeric as displacement_cm,
  metadata->>'event_date' as event_date
from public.model_inference_log
where model_slug = 'seismic-insar'
  and (metadata->>'max_displacement_cm')::numeric > 10
order by displacement_cm desc;`,
  },
  {
    label: 'Subsidence vs uplift',
    sql: `select detected_class,
  count(*) as events,
  round(avg((metadata->>'max_displacement_cm')::numeric)::numeric, 2) as avg_cm,
  round(max((metadata->>'max_displacement_cm')::numeric)::numeric, 2) as max_cm
from public.model_inference_log
where model_slug = 'seismic-insar'
  and detected_class in ('subsidence','uplift')
group by detected_class;`,
  },
  {
    label: 'Volcanic events',
    sql: `select id, lat, lon, confidence,
  (metadata->>'max_displacement_cm')::numeric as displacement_cm,
  metadata->>'event_date' as event_date
from public.model_inference_log
where model_slug  = 'seismic-insar'
  and detected_class = 'volcanic'
order by displacement_cm desc;`,
  },
]

onMounted(async () => {
  try {
    results.value = await fetchInferenceResults(MODEL_SLUG, 50)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to load.'
  } finally {
    loading.value = false
  }
})

// Build heatmap option from inference results.
// X = discretised longitude, Y = discretised latitude, Value = max_displacement_cm.
const heatmapOption = computed(() => {
  const rows = results.value.filter(r => r.lat != null && r.lon != null)
  if (!rows.length) return null

  // Round to 1 decimal to bucket nearby points
  const latSet  = new Set<string>()
  const lonSet  = new Set<string>()
  const cellMap = new Map<string, number>()

  for (const r of rows) {
    const latK = r.lat!.toFixed(1)
    const lonK = r.lon!.toFixed(1)
    latSet.add(latK)
    lonSet.add(lonK)
    const key = `${lonK}|${latK}`
    const disp = Math.abs(Number(r.metadata.max_displacement_cm ?? r.confidence * 20))
    cellMap.set(key, Math.max(cellMap.get(key) ?? 0, disp))
  }

  const lons = [...lonSet].sort((a, b) => Number(a) - Number(b))
  const lats = [...latSet].sort((a, b) => Number(a) - Number(b))

  const data: [number, number, number][] = []
  cellMap.forEach((val, key) => {
    const [lonK = '', latK = ''] = key.split('|')
    const xi = lons.indexOf(lonK)
    const yi = lats.indexOf(latK)
    if (xi >= 0 && yi >= 0) data.push([xi, yi, val])
  })

  const maxDisp = Math.max(...data.map(d => d[2]), 1)

  return {
    backgroundColor: 'transparent',
    animation:       false,
    grid:  { top: 30, bottom: 60, left: 60, right: 80 },
    xAxis: {
      type:      'category',
      data:      lons.map(l => `${l}°`),
      name:      'Longitude',
      nameLocation: 'middle',
      nameGap:   30,
      axisLabel: { color: '#64748b', fontSize: 9, rotate: 35 },
      axisTick:  { show: false },
      axisLine:  { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      splitLine: { show: false },
    },
    yAxis: {
      type:      'category',
      data:      lats.map(l => `${l}°`),
      name:      'Latitude',
      nameLocation: 'middle',
      nameGap:   45,
      axisLabel: { color: '#64748b', fontSize: 9 },
      axisTick:  { show: false },
      axisLine:  { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
    },
    visualMap: {
      min:         0,
      max:         maxDisp,
      calculable:  true,
      orient:      'vertical',
      right:       0,
      top:         'center',
      inRange: {
        // Blue → yellow → red (interferogram convention)
        color: ['#1d4ed8', '#06b6d4', '#22c55e', '#facc15', '#f97316', '#ef4444'],
      },
      textStyle: { color: '#64748b', fontSize: 9 },
    },
    tooltip: {
      formatter: (p: { data: [number, number, number] }) =>
        `Lon: ${lons[p.data[0]]}° · Lat: ${lats[p.data[1]]}°<br>Displacement: <strong>${p.data[2].toFixed(1)} cm</strong>`,
    },
    series: [{
      type:        'heatmap',
      data,
      emphasis: { itemStyle: { borderColor: '#fff', borderWidth: 1 } },
    }],
  }
})

const inferenceRpcSql = `select
  id,
  input_source,
  detected_class,
  confidence,
  lat,
  lon,
  metadata ->> 'max_displacement_cm' as displacement_cm,
  metadata ->> 'event_date'          as event_date
from public.model_inference_results(
  p_slug  := $1,
  p_limit := $2
);`
</script>

<template>
  <div>
    <AIModelTabStrip />

    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
      <!-- Header -->
      <header>
        <p class="text-ink-muted text-xs tracking-widest uppercase">Use case 3 · Tier 1</p>
        <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
          Seismic &amp; InSAR Deformation
        </h1>
        <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-3xl leading-relaxed">
          CNN + Transfer Learning model classifying InSAR interferograms into
          subsidence, uplift, volcanic, and seismic deformation events.
          Training data: SCS-GEO with GPS validation anchors.
          <span class="text-ink-muted/60">Published benchmark: 88.7% F1.</span>
        </p>
      </header>

      <!-- Model metadata row -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div v-for="(c, i) in [
          { label: 'Architecture', value: 'CNN + Transfer' },
          { label: 'Dataset',      value: 'SCS-GEO + GPS' },
          { label: 'Benchmark',    value: '88.7% F1' },
          { label: 'Status',       value: 'DEMO' },
        ]" :key="i" class="rounded-xl border border-white/5 bg-surface-1 p-3">
          <p class="text-[9px] uppercase tracking-wider text-ink-muted/60">{{ c.label }}</p>
          <p class="text-xs font-medium text-ink-primary mt-0.5">{{ c.value }}</p>
        </div>
      </div>

      <!-- InSAR heatmap -->
      <Card padded>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-ink-primary">InSAR Deformation Map</h2>
          <span class="text-[10px] uppercase tracking-wider text-caution border border-caution/30 bg-caution/[0.06] px-2 py-0.5 rounded">
            Demo — synthetic data
          </span>
        </div>

        <div v-if="loading" class="h-64 rounded-lg bg-white/5 animate-pulse" />
        <div v-else-if="!heatmapOption || !results.length"
             class="h-64 flex items-center justify-center text-ink-muted text-sm">
          No spatial inference results yet.
        </div>
        <VChart
          v-else
          :option="heatmapOption"
          :autoresize="true"
          class="h-72"
        />

        <p class="text-[10px] text-ink-muted/50 mt-2">
          Interferogram analog: colour ramp blue→yellow→red maps to surface displacement magnitude (cm).
          Each cell is one detected InSAR event bucketed to 0.1° lat/lon.
          Deformation class labels appear in the inference log below.
        </p>
      </Card>

      <!-- Input → Model → Output -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">Input → Model → Output</h2>
        <div class="grid grid-cols-3 gap-3 text-xs">
          <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3">
            <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mb-1">Input</p>
            <p class="text-ink-primary font-medium">Sentinel-1 InSAR</p>
            <p class="text-ink-muted mt-1">C-band interferograms · 12-day repeat · 20m resolution</p>
          </div>
          <div class="rounded-lg border border-accent/20 bg-accent/[0.04] p-3">
            <p class="text-[10px] uppercase tracking-wider text-accent/60 mb-1">Model</p>
            <p class="text-ink-primary font-medium">ResNet50 fine-tuned</p>
            <p class="text-ink-muted mt-1">SCS-GEO · 3,800 interferogram pairs + GPS validation</p>
            <p class="text-ink-muted/50 mt-1">88.7% F1 · 4-class classification</p>
          </div>
          <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3">
            <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mb-1">Output</p>
            <p class="text-ink-primary font-medium">Deformation event</p>
            <p class="text-ink-muted mt-1">Class + max_displacement_cm + lat/lon centroid</p>
          </div>
        </div>
      </Card>

      <!-- Interactive controls -->
      <InferenceControls
        v-if="!loading"
        :results="results"
        model-slug="seismic-insar"
        input-label="Sentinel-1 InSAR interferogram"
        @filtered="filteredResults = $event"
      />

      <!-- Confidence chart (filtered) -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">Detection Class Confidence</h2>
        <ConfidenceChart :results="filteredResults" />
      </Card>

      <!-- Inference log (filtered) -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">Inference Log</h2>
        <InferenceLogTable :results="filteredResults" />
      </Card>

      <!-- SQL playground -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">SQL Explorer</h2>
        <p class="text-xs text-ink-muted mb-3">
          Query surface deformation events — filter by displacement magnitude, class, or region.
        </p>
        <SqlPlayground model-slug="seismic-insar" :examples="SEISMIC_EXAMPLES" />
      </Card>

      <!-- Reproducible query panel -->
      <Card padded>
        <SqlInterpretationPanel
          :query="inferenceRpcSql"
          :params="['seismic-insar', 50]"
          source="model_inference_results()"
          caption="Extracts displacement magnitude from JSONB metadata alongside spatial coordinates for map rendering."
        />
      </Card>
    </div>
  </div>
</template>
