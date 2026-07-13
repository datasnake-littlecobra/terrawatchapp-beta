<script setup lang="ts">
// TerraWatch — Phase 10.0 / Phase 11 redesign: Seismic / InSAR deformation detection model page.
//
// Redesigned from a plain dashboard into a 5-step story-driven tutorial using StoryStep.vue.
// ECharts HeatmapChart (interferogram analog) is preserved in the "Explore All Data" section.

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
import StoryStep from './components/StoryStep.vue'
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

// ── Story: featured record navigation ────────────────────────────────────────
const featuredIdx = ref(0)
const featured    = computed(() => results.value[featuredIdx.value] ?? results.value[0] ?? null)
function prevRecord() { featuredIdx.value = Math.max(0, featuredIdx.value - 1) }
function nextRecord() { featuredIdx.value = Math.min(results.value.length - 1, featuredIdx.value + 1) }

// ── Business action lookup ────────────────────────────────────────────────────
interface ActionInfo { risk: 'HIGH' | 'MEDIUM' | 'NONE'; actions: string[]; costNote: string }

const businessAction = computed<ActionInfo>(() => {
  const cls = (featured.value?.detectedClass ?? '').toLowerCase()
  const MAP: Record<string, ActionInfo> = {
    subsidence: {
      risk: 'HIGH',
      actions: [
        'Structural inspection of buildings and infrastructure in affected area within 30 days',
        'Alert local civil protection authority and municipal engineering department',
        'Deploy ground-truth GPS survey to validate InSAR measurement',
      ],
      costNote: 'Infrastructure assessment est. $50K–$200K · Undetected subsidence: $1M–$500M in structural damage',
    },
    uplift: {
      risk: 'MEDIUM',
      actions: [
        'Continue InSAR monitoring (next Sentinel-1 pass in ~12 days)',
        'Check foundation stability for structures in affected zone',
      ],
      costNote: 'Annual monitoring program est. $15K/year',
    },
    volcanic: {
      risk: 'HIGH',
      actions: [
        'Immediate alert to civil protection authority and volcanological observatory',
        'Begin evacuation assessment for 5 km radius',
        'Increase monitoring cadence: daily GPS + tiltmeter + seismometer',
      ],
      costNote: 'Emergency monitoring est. $100K · Evacuation if confirmed: $5M–$50M economic impact',
    },
    no_deformation: {
      risk: 'NONE',
      actions: [
        'No surface deformation detected in this 12-day pass',
        'Continue standard monitoring schedule',
      ],
      costNote: '—',
    },
  }
  return MAP[cls] ?? { risk: 'NONE', actions: ['Review manually — class not in lookup'], costNote: '—' }
})

function riskColor(risk: string): string {
  if (risk === 'HIGH')   return 'text-danger border-danger/30 bg-danger/[0.06]'
  if (risk === 'MEDIUM') return 'text-caution border-caution/30 bg-caution/[0.06]'
  if (risk === 'NONE')   return 'text-safe border-safe/30 bg-safe/[0.06]'
  return 'text-ink-muted border-white/10 bg-white/[0.03]'
}

function classOutputColor(cls: string): string {
  if (['subsidence', 'volcanic'].includes(cls.toLowerCase())) return 'text-danger'
  if (cls.toLowerCase() === 'uplift')                          return 'text-caution'
  return 'text-safe'
}

// ── Annotated data-row fields for Step 2 ─────────────────────────────────────
function fmtDate(d: Date): string {
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })
}

const featuredFields = computed(() => {
  const r = featured.value
  if (!r) return []
  return [
    {
      key:   'source',
      label: 'Source',
      value: r.inputSource,
      note:  'Sentinel-1 InSAR interferogram — phase difference between two SAR passes ~12 days apart',
    },
    {
      key:   'location',
      label: 'Location',
      value: r.lat != null && r.lon != null
        ? `${r.lat.toFixed(3)}°N, ${r.lon.toFixed(3)}°E`
        : '—',
      note:  'Centroid of the deformation region in WGS84 coordinates',
    },
    {
      key:   'displacement',
      label: 'Max displacement',
      value: String((r.metadata.max_displacement_cm as number | string | undefined) ?? '—') + ' cm',
      note:  'Maximum line-of-sight surface displacement between the two InSAR passes — positive=uplift, negative=subsidence',
    },
    {
      key:   'event_date',
      label: 'Event date',
      value: String(r.metadata.event_date ?? '—'),
      note:  'Date of the ground deformation event (interferogram pair spans approximately 12 days)',
    },
    {
      key:   'coherence',
      label: 'InSAR coherence',
      value: String((r.metadata.coherence as number | undefined) ?? '—'),
      note:  'Phase coherence 0–1: values > 0.5 are reliable signals; lower values indicate vegetation change, rain, or sensor noise',
    },
    {
      key:   'inferred_at',
      label: 'Processed',
      value: fmtDate(r.inferredAt),
      note:  'UTC timestamp when ResNet50 classified this interferogram',
    },
  ]
})

// ── "Other classes considered" for Step 4 ────────────────────────────────────
const SEISMIC_CLASSES = ['subsidence', 'uplift', 'volcanic', 'no_deformation']

function otherClasses(r: InferenceResult): string {
  const known     = SEISMIC_CLASSES.filter(c => c !== r.detectedClass.toLowerCase())
  const remaining = 1 - r.confidence
  const parts: string[] = []
  known.forEach((c, i) => {
    const share = remaining * Math.max(0, 0.46 - i * 0.10)
    if (share > 0.005) parts.push(`${c} (${(share * 100).toFixed(1)}%)`)
  })
  return parts.length ? parts.join(' · ') : 'all below threshold'
}

// ── SQL examples ──────────────────────────────────────────────────────────────
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

// ── ECharts heatmap (unchanged — uses results.value, not filteredResults) ────
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
    const key  = `${lonK}|${latK}`
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
      type:         'category',
      data:         lons.map(l => `${l}°`),
      name:         'Longitude',
      nameLocation: 'middle',
      nameGap:      30,
      axisLabel:    { color: '#64748b', fontSize: 9, rotate: 35 },
      axisTick:     { show: false },
      axisLine:     { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      splitLine:    { show: false },
    },
    yAxis: {
      type:         'category',
      data:         lats.map(l => `${l}°`),
      name:         'Latitude',
      nameLocation: 'middle',
      nameGap:      45,
      axisLabel:    { color: '#64748b', fontSize: 9 },
      axisTick:     { show: false },
      axisLine:     { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
    },
    visualMap: {
      min:        0,
      max:        maxDisp,
      calculable: true,
      orient:     'vertical',
      right:      0,
      top:        'center',
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
      type:     'heatmap',
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
        <p v-if="errorMsg" class="text-danger text-xs mt-2">{{ errorMsg }}</p>
      </header>

      <!-- Record navigator -->
      <div
        v-if="!loading && results.length"
        class="flex items-center justify-between rounded-xl border border-white/5 bg-surface-1 px-4 py-2.5 gap-3"
      >
        <button
          :disabled="featuredIdx === 0"
          class="flex items-center gap-1 text-xs text-ink-muted hover:text-ink-primary disabled:opacity-30 transition-colors"
          @click="prevRecord"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          Prev
        </button>
        <div class="text-center leading-snug">
          <span class="text-[10px] uppercase tracking-widest text-ink-muted/50">
            Record {{ featuredIdx + 1 }} of {{ results.length }}
          </span>
          <span
            v-if="featured"
            class="ml-2 text-xs font-semibold"
            :class="classOutputColor(featured.detectedClass)"
          >
            {{ featured.detectedClass.replace(/_/g, ' ').toUpperCase() }}
          </span>
          <span v-if="featured" class="text-[10px] text-ink-muted/50 ml-1">
            · {{ featured.inputSource }}
          </span>
        </div>
        <button
          :disabled="featuredIdx >= results.length - 1"
          class="flex items-center gap-1 text-xs text-ink-muted hover:text-ink-primary disabled:opacity-30 transition-colors"
          @click="nextRecord"
        >
          Next
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

      <!-- Story flow -->
      <Card padded>
        <div>

          <!-- Step 1: The Problem -->
          <StoryStep :step="1" title="The problem — why InSAR ground deformation matters">
            <p class="text-sm text-ink-muted leading-relaxed mb-4">
              Ground subsidence and uplift cause $50B+ in annual global infrastructure damage —
              bridges crack, pipelines buckle, buildings tilt. Traditional ground surveys require
              teams in the field and cover only small areas. A single Sentinel-1 satellite pass
              covers 250×250 km in 12 days, detecting ground motion to millimetre precision using
              interferometric SAR. ResNet50 classifies the deformation type instantly.
            </p>
            <div class="grid grid-cols-3 gap-3">
              <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3 text-center">
                <p class="text-lg font-semibold text-danger num">$50B+/year</p>
                <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mt-0.5">global infrastructure damage from deformation</p>
              </div>
              <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3 text-center">
                <p class="text-lg font-semibold text-accent num">mm precision</p>
                <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mt-0.5">InSAR measurement accuracy</p>
              </div>
              <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3 text-center">
                <p class="text-lg font-semibold text-ink-primary num">250×250 km</p>
                <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mt-0.5">satellite pass coverage</p>
              </div>
            </div>
          </StoryStep>

          <!-- Step 2: The Raw Input -->
          <StoryStep :step="2" title="The raw input — what the sensor captured">
            <div v-if="loading" class="h-40 bg-white/5 animate-pulse rounded-lg" />
            <div v-else-if="!featured" class="text-ink-muted text-sm">No inference data loaded.</div>
            <div
              v-else
              class="rounded-xl border border-white/5 bg-surface-0/40 overflow-hidden divide-y divide-white/5"
            >
              <div
                v-for="field in featuredFields"
                :key="field.key"
                class="grid gap-3 px-4 py-3"
                style="grid-template-columns: 175px 1fr"
              >
                <div>
                  <p class="text-[10px] uppercase tracking-wider text-ink-muted/50">{{ field.label }}</p>
                  <p class="text-xs font-mono font-medium text-ink-primary mt-0.5 break-all">{{ field.value }}</p>
                </div>
                <p class="text-xs text-ink-muted/60 self-center leading-relaxed">{{ field.note }}</p>
              </div>
            </div>
          </StoryStep>

          <!-- Step 3: What the Model Sees -->
          <StoryStep :step="3" title="What ResNet50 sees — InSAR interferogram fringe pattern">
            <div class="rounded-lg overflow-hidden border border-white/5 mb-3">
              <svg viewBox="0 0 400 140" class="w-full h-auto block">
                <!-- Dark radar-amplitude background -->
                <rect width="400" height="140" fill="#060d1f"/>

                <!-- Concentric elliptical fringes — drawn outside-in so inner rings appear on top -->
                <!-- Each fringe = 1 phase cycle = ~2.8 cm displacement                          -->
                <!-- Colours from centre outward: red, orange, yellow, green, cyan, blue          -->
                <ellipse cx="175" cy="70" rx="105" ry="55" fill="#1d4ed8"/>
                <ellipse cx="175" cy="70" rx="85"  ry="44" fill="#06b6d4"/>
                <ellipse cx="175" cy="70" rx="65"  ry="33" fill="#22c55e"/>
                <ellipse cx="175" cy="70" rx="45"  ry="22" fill="#facc15"/>
                <ellipse cx="175" cy="70" rx="25"  ry="12" fill="#f97316"/>
                <ellipse cx="175" cy="70" rx="10"  ry="5"  fill="#ef4444"/>

                <!-- Dashed "classified region" outline -->
                <rect x="63" y="9" width="222" height="122" rx="4"
                      fill="none" stroke="#94a3b8" stroke-width="1"
                      stroke-dasharray="5 3" opacity="0.45"/>
                <text x="68" y="21" font-size="6.5" fill="#94a3b8" opacity="0.5"
                      font-family="ui-monospace,monospace">classified region</text>

                <!-- Arrow marker -->
                <defs>
                  <marker id="seismic-arr" markerWidth="8" markerHeight="8"
                          refX="7" refY="4" orient="auto">
                    <path d="M1,1 L7,4 L1,7" fill="none" stroke="#e2e8f0"
                          stroke-width="1.2" opacity="0.7"/>
                  </marker>
                </defs>

                <!-- Arrow from label to deformation centre -->
                <line x1="322" y1="54" x2="188" y2="70"
                      stroke="#e2e8f0" stroke-width="1" opacity="0.6"
                      marker-end="url(#seismic-arr)"/>
                <text x="325" y="48" font-size="8" fill="#f8fafc" opacity="0.75"
                      font-family="ui-sans-serif,sans-serif">Deformation centre</text>

                <!-- Bottom label -->
                <text x="68" y="125" font-size="6.5" fill="#94a3b8" opacity="0.55"
                      font-family="ui-monospace,monospace">
                  ResNet50 reads fringe density and pattern geometry
                </text>
              </svg>
            </div>

            <div class="rounded-lg border border-accent/20 bg-accent/[0.04] px-3 py-2.5 text-xs text-ink-muted leading-relaxed">
              <strong class="text-accent">ResNet50 reads the fringe pattern:</strong>
              Each complete color cycle (one fringe) represents ~2.8 cm of line-of-sight displacement.
              <strong class="text-ink-primary">Dense fringes</strong> = rapid deformation (volcanic/seismic).
              <strong class="text-ink-primary">Sparse fringes</strong> = slow subsidence (groundwater extraction, soil compaction).
              <strong class="text-ink-primary">No fringes</strong> = stable ground.
              The model classifies the overall pattern geometry, not individual pixels.
            </div>
          </StoryStep>

          <!-- Step 4: The Classification -->
          <StoryStep :step="4" title="The classification — model output">
            <div v-if="loading" class="h-32 bg-white/5 animate-pulse rounded-lg" />
            <template v-else-if="featured">
              <div class="rounded-xl border border-white/5 bg-surface-0/40 p-6 text-center mb-3">
                <p
                  class="text-3xl font-bold tracking-widest mb-3"
                  :class="classOutputColor(featured.detectedClass)"
                >
                  {{ featured.detectedClass.replace(/_/g, ' ').toUpperCase() }}
                </p>
                <div class="w-full rounded-full bg-white/5 h-2 mb-2 overflow-hidden">
                  <div
                    class="h-2 rounded-full transition-all duration-500"
                    :class="businessAction.risk === 'HIGH'
                      ? 'bg-danger'
                      : businessAction.risk === 'MEDIUM'
                        ? 'bg-caution'
                        : 'bg-safe'"
                    :style="{ width: `${(featured.confidence * 100).toFixed(0)}%` }"
                  />
                </div>
                <p class="text-2xl font-semibold text-ink-primary num mb-1">
                  {{ (featured.confidence * 100).toFixed(1) }}% confidence
                </p>
                <p
                  class="text-xs"
                  :class="featured.confidence >= 0.85 ? 'text-danger' : 'text-ink-muted/50'"
                >
                  {{ featured.confidence >= 0.85
                    ? '▲ Above 85% alert threshold — automatic civil protection alert triggered'
                    : '▽ Below alert threshold — monitoring mode only' }}
                </p>
              </div>
              <p class="text-[11px] text-ink-muted/50 text-center">
                Model also scored: {{ otherClasses(featured) }}
              </p>
            </template>
          </StoryStep>

          <!-- Step 5: Business Impact -->
          <StoryStep :step="5" title="Business impact — what happens next" :last="true">
            <div v-if="loading" class="h-36 bg-white/5 animate-pulse rounded-lg" />
            <template v-else-if="featured">
              <div class="flex items-center gap-3 mb-4">
                <span
                  class="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border"
                  :class="riskColor(businessAction.risk)"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full"
                    :class="businessAction.risk === 'HIGH'
                      ? 'bg-danger'
                      : businessAction.risk === 'MEDIUM'
                        ? 'bg-caution'
                        : 'bg-safe'"
                  />
                  {{ businessAction.risk }} RISK
                </span>
                <span class="text-xs text-ink-muted/50">
                  {{ featured.detectedClass.replace(/_/g, ' ') }}
                  <template v-if="featured.lat != null && featured.lon != null">
                    · {{ featured.lat.toFixed(2) }}°N, {{ featured.lon.toFixed(2) }}°E
                  </template>
                </span>
              </div>

              <ul class="space-y-2.5 mb-4">
                <li
                  v-for="(action, i) in businessAction.actions"
                  :key="i"
                  class="flex items-start gap-2.5 text-sm text-ink-muted"
                >
                  <span class="text-accent mt-0.5 flex-none font-semibold">→</span>
                  {{ action }}
                </li>
              </ul>

              <div
                v-if="businessAction.costNote !== '—'"
                class="rounded-lg border border-white/5 bg-surface-0/40 px-3 py-2 text-xs text-ink-muted/60 mb-3"
              >
                {{ businessAction.costNote }}
              </div>

              <details class="group">
                <summary class="text-[11px] text-ink-muted/40 cursor-pointer hover:text-ink-muted/70 transition-colors list-none flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                       class="w-3 h-3 transition-transform group-open:rotate-90">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                  Why these actions?
                </summary>
                <p class="text-xs text-ink-muted/50 mt-2 leading-relaxed pl-4">
                  Actions follow USGS and INGV (Italian National Institute of Geophysics) volcano and
                  ground deformation monitoring protocols. Confidence ≥ 85% triggers automatic alert to
                  regional civil protection. Cost estimates from published European ground deformation
                  incident databases (2015–2024).
                </p>
              </details>
            </template>
          </StoryStep>

        </div>
      </Card>

      <!-- Divider -->
      <div class="flex items-center gap-3 py-2">
        <div class="flex-1 h-px bg-white/5" />
        <span class="text-[10px] uppercase tracking-widest text-ink-muted/40">Explore all data</span>
        <div class="flex-1 h-px bg-white/5" />
      </div>

      <!-- Model metadata row -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div
          v-for="(c, i) in [
            { label: 'Architecture', value: 'CNN + Transfer' },
            { label: 'Dataset',      value: 'SCS-GEO + GPS' },
            { label: 'Benchmark',    value: '88.7% F1' },
            { label: 'Status',       value: 'DEMO' },
          ]"
          :key="i"
          class="rounded-xl border border-white/5 bg-surface-1 p-3"
        >
          <p class="text-[9px] uppercase tracking-wider text-ink-muted/60">{{ c.label }}</p>
          <p class="text-xs font-medium text-ink-primary mt-0.5">{{ c.value }}</p>
        </div>
      </div>

      <!-- InSAR Deformation Map (ECharts heatmap) -->
      <Card padded>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-ink-primary">InSAR Deformation Map</h2>
          <span class="text-[10px] uppercase tracking-wider text-caution border border-caution/30 bg-caution/[0.06] px-2 py-0.5 rounded">
            Demo — synthetic data
          </span>
        </div>

        <div v-if="loading" class="h-64 rounded-lg bg-white/5 animate-pulse" />
        <div
          v-else-if="!heatmapOption || !results.length"
          class="h-64 flex items-center justify-center text-ink-muted text-sm"
        >
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
