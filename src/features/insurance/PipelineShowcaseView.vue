<script setup lang="ts">
// TerraWatch — Phase 9.13.2: /insurance/pipeline.
//
// Single-page narrative: Raw sensor stream → Transformed signals →
// Business outputs. Driven entirely from public.sensors +
// public.measurements (Phase 9.6 schema), with the seeded DataSnake
// proprietary tier from migration 0028 supplying the data until real
// hardware ships.
//
// Self-documenting: every chart-bearing card carries its own
// MetricInfoPanel; the pipeline.* entries in src/data/insurance-explainers.ts
// surface in /insurance/glossary fully expanded.

import { computed, onMounted, ref, watch } from 'vue'
import Card from '@/ui/Card.vue'
import InsuranceTabStrip from './components/InsuranceTabStrip.vue'
import DemoBadge from './components/DemoBadge.vue'
import SensorSelector from './components/SensorSelector.vue'
import TimeSeriesChart from '@/features/monitoring/TimeSeriesChart.vue'
import AnomalyChart from './components/AnomalyChart.vue'
import ComparativeChart from './components/ComparativeChart.vue'
import PipelineNarrativeCard from './components/PipelineNarrativeCard.vue'
import MetricInfoPanel from './components/MetricInfoPanel.vue'
import { useMeta } from '@/composables/useMeta'
import { fetchSeries } from '@/services/measurements'
import {
  fetchPipelineSensors,
  fetchAnomalies,
  fetchCompare,
  fetchCorrelation,
  VARIANT_PARAMETERS,
  type PipelineSensor,
  type AnomalyPoint,
  type ComparePoint,
  type CorrelationSummary,
} from '@/services/sensorPipeline'
import type { MeasurementPoint } from '@/types/measurement'

useMeta(() => ({
  title:       'Pipeline — Insurance Intelligence',
  description: 'See DataSnake\'s proprietary sensor data flow end-to-end: raw measurements → rolling z-score anomalies → underwriting actions on the insurance dashboards.',
}))

// ----- State ---------------------------------------------------------
const sensors = ref<PipelineSensor[]>([])
const selectedId = ref<string>('')
const param = ref<string>('')
const paramB = ref<string>('')
const hours = ref<number>(72)

const rawSeries = ref<MeasurementPoint[]>([])
const anomalies = ref<AnomalyPoint[]>([])
const comparePts = ref<ComparePoint[]>([])
const correlation = ref<CorrelationSummary | null>(null)

const loadingRaw = ref(false)
const loadingAnomaly = ref(false)
const loadingCompare = ref(false)
const errorMsg = ref<string | null>(null)

const HOURS_OPTIONS = [
  { v: 24,  label: '24h' },
  { v: 72,  label: '3d' },
  { v: 168, label: '7d' },
  { v: 720, label: '30d' },
]

// ----- Derived -------------------------------------------------------
const selectedSensor = computed<PipelineSensor | null>(() =>
  sensors.value.find((s) => s.id === selectedId.value) ?? null)

const variantParams = computed(() => {
  const v = selectedSensor.value?.variant ?? ''
  return VARIANT_PARAMETERS[v] ?? []
})

const paramLabel = computed(() => variantParams.value.find((p) => p.key === param.value)?.label ?? param.value)
const paramUnit  = computed(() => variantParams.value.find((p) => p.key === param.value)?.unit  ?? '')
const paramBLabel = computed(() => variantParams.value.find((p) => p.key === paramB.value)?.label ?? paramB.value)
const paramBUnit  = computed(() => variantParams.value.find((p) => p.key === paramB.value)?.unit  ?? '')

const latestValue = computed(() => {
  if (!rawSeries.value.length) return null
  return rawSeries.value[rawSeries.value.length - 1]
})

const freshness = computed(() => {
  const p = latestValue.value
  if (!p) return null
  const ms = Date.now() - p.observedAt.getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
})

// ----- Loaders -------------------------------------------------------
async function loadRaw() {
  if (!selectedId.value || !param.value) return
  loadingRaw.value = true
  try {
    rawSeries.value = await fetchSeries({ sensorId: selectedId.value, parameter: param.value, hours: hours.value })
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'fetchSeries failed'
  } finally {
    loadingRaw.value = false
  }
}

async function loadAnomalies() {
  if (!selectedId.value || !param.value) return
  loadingAnomaly.value = true
  try {
    anomalies.value = await fetchAnomalies(selectedId.value, param.value, hours.value)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'fetchAnomalies failed'
  } finally {
    loadingAnomaly.value = false
  }
}

async function loadCompare() {
  if (!selectedId.value || !param.value || !paramB.value || paramB.value === param.value) {
    comparePts.value = []
    correlation.value = null
    return
  }
  loadingCompare.value = true
  try {
    const [pts, corr] = await Promise.all([
      fetchCompare(selectedId.value, param.value, paramB.value, hours.value),
      fetchCorrelation(selectedId.value, param.value, paramB.value, hours.value),
    ])
    comparePts.value = pts
    correlation.value = corr
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'fetchCompare failed'
  } finally {
    loadingCompare.value = false
  }
}

function reloadAll() {
  void loadRaw()
  void loadAnomalies()
  void loadCompare()
}

// ----- Init ----------------------------------------------------------
onMounted(async () => {
  try {
    sensors.value = await fetchPipelineSensors()
    if (sensors.value.length) {
      selectedId.value = sensors.value[0]!.id
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'fetchPipelineSensors failed'
  }
})

// When the sensor changes, reset parameter selections to that variant's defaults.
watch(selectedSensor, (s) => {
  if (!s) return
  const params = VARIANT_PARAMETERS[s.variant] ?? []
  if (!params.length) return
  param.value  = params[0]!.key
  paramB.value = params[1]?.key ?? params[0]!.key
  reloadAll()
})

// When the parameter, second-parameter, or time-range changes, refetch.
watch([param, paramB, hours], reloadAll)
</script>

<template>
  <div>
    <InsuranceTabStrip />

    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <header class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p class="text-ink-muted text-xs tracking-widest uppercase">Module · Sensor Data Pipeline</p>
          <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
            Raw sensor data → Insurance decisions
          </h1>
          <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-2xl">
            The end-to-end DataSnake flow. Pick a proprietary sensor and
            watch the data move from raw measurements (top) through
            anomaly detection + correlation (middle) into specific
            underwriting actions on the live insurance dashboards (bottom).
          </p>
        </div>
        <DemoBadge class="hidden sm:inline-flex" />
      </header>

      <p v-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>

      <!-- ============================================================
           Section A — Raw sensor stream
           ============================================================ -->
      <section class="space-y-3">
        <div class="flex items-baseline gap-3">
          <p class="text-[10px] uppercase tracking-widest text-accent">A · Input</p>
          <h2 class="text-lg font-semibold text-ink-primary">Raw sensor stream</h2>
        </div>

        <Card padded>
          <SensorSelector
            :sensors="sensors"
            :selected="selectedId"
            @select="(id) => { selectedId = id }"
          />

          <!-- Parameter + time-range controls -->
          <div v-if="variantParams.length" class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mt-4 pt-4 border-t border-white/5">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[10px] uppercase tracking-widest text-ink-muted/60 mr-1">Parameter:</span>
              <button
                v-for="p in variantParams"
                :key="p.key"
                type="button"
                class="text-xs px-3 py-1.5 rounded-full border transition-colors"
                :class="param === p.key
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-white/10 text-ink-muted hover:text-ink-primary hover:border-white/20'"
                @click="param = p.key"
              >{{ p.label }}</button>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] uppercase tracking-widest text-ink-muted/60 mr-1">Range:</span>
              <button
                v-for="h in HOURS_OPTIONS"
                :key="h.v"
                type="button"
                class="text-xs px-3 py-1.5 rounded-full border transition-colors"
                :class="hours === h.v
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-white/10 text-ink-muted hover:text-ink-primary hover:border-white/20'"
                @click="hours = h.v"
              >{{ h.label }}</button>
            </div>
          </div>

          <!-- Latest value tile + raw time-series chart -->
          <div v-if="param" class="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-3 mt-4">
            <div class="rounded-xl border border-white/5 bg-surface-0/40 p-4 flex flex-col justify-center">
              <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">{{ paramLabel }}</p>
              <p class="num text-3xl font-semibold text-ink-primary mt-1">
                {{ latestValue ? latestValue.value.toFixed(2) : '—' }}
                <span class="text-base text-ink-muted">{{ paramUnit }}</span>
              </p>
              <p class="text-xs text-ink-muted mt-1.5">
                <template v-if="freshness">{{ freshness }}</template>
                <template v-else>—</template>
              </p>
            </div>
            <TimeSeriesChart
              :series="rawSeries"
              :parameter-label="paramLabel"
              :unit="paramUnit"
              :loading="loadingRaw"
            />
          </div>

          <MetricInfoPanel id="pipeline.raw-timeseries" />
        </Card>
      </section>

      <!-- ============================================================
           Section B — Transformation
           ============================================================ -->
      <section class="space-y-3">
        <div class="flex items-baseline gap-3">
          <p class="text-[10px] uppercase tracking-widest text-caution">B · Processing</p>
          <h2 class="text-lg font-semibold text-ink-primary">Transformation</h2>
        </div>

        <!-- Hourly rollup — same series, but in 7d window the RPC auto-pivots to hourly -->
        <Card padded>
          <h3 class="text-sm font-semibold text-ink-primary mb-1">Hourly rollup with min/max envelope</h3>
          <p class="text-ink-muted text-xs mb-3">
            Raw measurements are noisy. The hourly rollup view
            (<code class="text-accent">public.measurements_hourly</code>)
            stores the mean, min, and max per hour. When the window
            exceeds 36h the chart switches to this rollup automatically
            and shades the min-max band so intra-hour variability stays
            visible.
          </p>
          <TimeSeriesChart
            :series="rawSeries"
            :parameter-label="paramLabel"
            :unit="paramUnit"
            :loading="loadingRaw"
          />
          <MetricInfoPanel id="pipeline.hourly-rollup" />
        </Card>

        <!-- Anomaly strip -->
        <Card padded>
          <h3 class="text-sm font-semibold text-ink-primary mb-1">Anomaly detection — rolling z-score</h3>
          <p class="text-ink-muted text-xs mb-3">
            For each hour, compute the mean and standard deviation of
            the prior 24 hours; flag any point whose z-score exceeds 2.
            This is the signal that lets a parametric trigger fire
            before the news catches up.
          </p>
          <AnomalyChart
            :points="anomalies"
            :parameter-label="paramLabel"
            :unit="paramUnit"
            :loading="loadingAnomaly"
          />
          <MetricInfoPanel id="pipeline.anomaly-strip" />
        </Card>

        <!-- Comparative chart -->
        <Card padded>
          <div class="flex items-baseline justify-between gap-3 mb-1 flex-wrap">
            <h3 class="text-sm font-semibold text-ink-primary">Comparative analysis</h3>
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[10px] uppercase tracking-widest text-ink-muted/60 mr-1">Compare with:</span>
              <button
                v-for="p in variantParams"
                :key="p.key"
                type="button"
                class="text-xs px-3 py-1.5 rounded-full border transition-colors"
                :disabled="p.key === param"
                :class="[
                  paramB === p.key
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-white/10 text-ink-muted hover:text-ink-primary hover:border-white/20',
                  p.key === param ? 'opacity-40 cursor-not-allowed' : '',
                ]"
                @click="paramB = p.key"
              >{{ p.label }}</button>
            </div>
          </div>
          <p class="text-ink-muted text-xs mb-3">
            Two parameters of the same sensor on a dual axis, plus the
            Pearson r over the selected window. Confirms physical
            sanity ("cooler nights → higher humidity") and detects
            sensor faults ("temperature and humidity stopped covarying
            → suspect calibration").
          </p>
          <ComparativeChart
            :points="comparePts"
            :label-a="paramLabel"
            :label-b="paramBLabel"
            :unit-a="paramUnit"
            :unit-b="paramBUnit"
            :correlation="correlation"
            :loading="loadingCompare"
          />
          <MetricInfoPanel id="pipeline.comparative" />
        </Card>
      </section>

      <!-- ============================================================
           Section C — Business outputs
           ============================================================ -->
      <section class="space-y-3">
        <div class="flex items-baseline gap-3">
          <p class="text-[10px] uppercase tracking-widest text-safe">C · Value</p>
          <h2 class="text-lg font-semibold text-ink-primary">Insurance outputs</h2>
        </div>

        <Card padded>
          <p class="text-ink-muted text-sm mb-4">
            Each transformed signal feeds a specific underwriting
            action on the live insurance dashboards. Click through to
            see the dashboard the signal currently drives.
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <PipelineNarrativeCard
              title="Surge proxy"
              signal="Ocean pressure_dbar + wave_height_m crossing rolling threshold"
              metric="Storm-surge proxy index, 1-hr resolution"
              action="Fires parametric trigger when crossed; payout queued"
              link-to="/insurance/parametric"
              link-label="See parametric monitor"
              calibration="calibrated"
            />
            <PipelineNarrativeCard
              title="Flood index"
              signal="Ground soil_moisture_pct + 7d rainfall trend"
              metric="Saturation index — % above seasonal baseline"
              action="Adjusts eal_flood modifier in the Risk Verdict"
              link-to="/insurance/verdict"
              link-label="See Risk Verdict"
              calibration="calibrated"
            />
            <PipelineNarrativeCard
              title="Wildfire index"
              signal="Ground air_temp_c + humidity_pct + wind_speed_mps (compound)"
              metric="Hot-dry-windy compound score (HDW × WUI density)"
              action="Adjusts eal_wildfire sub-score in the Risk Verdict"
              link-to="/insurance/verdict"
              link-label="See Risk Verdict"
              calibration="calibrated"
            />
            <PipelineNarrativeCard
              title="EP-tightening"
              signal="Aggregated anomaly density across all proprietary sensors"
              metric="Tail-uncertainty reduction at 1-in-100yr return period"
              action="Narrows the modeled-loss band in EP curves"
              link-to="/insurance/ep-curves"
              link-label="See EP curves"
              calibration="calibrated"
            />
            <PipelineNarrativeCard
              title="Confidence boost"
              signal="Proprietary sensor coverage in a county / population"
              metric="Coverage ratio — proprietary rows / public rows"
              action="Raises Risk API confidence field (currently public-only)"
              link-to="/insurance/api"
              link-label="See Risk API"
              calibration="derived"
            />
            <PipelineNarrativeCard
              title="Glossary"
              signal="Every chart on this page"
              metric="Each card carries a MetricInfoPanel"
              action="Read once in /insurance/glossary; come back any time"
              link-to="/insurance/glossary"
              link-label="See Glossary"
              calibration="live"
            />
          </div>
          <MetricInfoPanel id="pipeline.business-outputs" />
        </Card>

        <Card padded>
          <MetricInfoPanel id="pipeline.coverage-confidence" standalone />
        </Card>
      </section>

      <p class="text-ink-muted/60 text-xs max-w-3xl">
        <strong class="text-ink-muted">Provenance:</strong>
        The sensors and measurements you see here are seeded mocks
        (<code class="text-accent">source='datasnake'</code>,
        <code class="text-accent">source_tier='proprietary'</code>)
        plus a 10-min cron that keeps the stream fresh. When real
        DataSnake hardware ships, the seed migration is replaced by
        the ingest endpoint described in
        <code class="text-accent">docs/DATASNAKE_SENSOR_DATA_CONTRACT.md</code>
        — schema unchanged, only the source of writes changes.
      </p>
    </div>
  </div>
</template>
