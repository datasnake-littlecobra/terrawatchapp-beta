<script setup lang="ts">
// TerraWatch — Phase 9.18.1: Flash Flood use case — LIVE chart on
// real NOAA NWS observation data.
//
// Foundation (9.18.0) shipped the structure. This phase wires:
//   - Real sensor picker (NOAA NWS METAR stations seeded in 0039)
//   - 7-day precipitation time-series chart via the existing
//     TimeSeriesChart + fetchSeries from /services/measurements.ts
//   - Live verdict callout via weather_flash_flood_score RPC
//     (migration 0040)
//   - SQL panels with the LITERAL parameterized queries running
//     against the current sensor selection.

import { computed, onMounted, ref, watch } from 'vue'
import WeatherIntelligenceTabStrip from './components/WeatherIntelligenceTabStrip.vue'
import WIMetricInfoPanel from './components/WIMetricInfoPanel.vue'
import SqlInterpretationPanel from './components/SqlInterpretationPanel.vue'
import TimeSeriesChart from '@/features/monitoring/TimeSeriesChart.vue'
import Card from '@/ui/Card.vue'
import { useMeta } from '@/composables/useMeta'
import { fetchSeries } from '@/services/measurements'
import {
  fetchFlashFloodScore,
  fetchNoaaNwsSensors,
  type FlashFloodScore,
  type NoaaNwsSensor,
} from '@/services/weatherIntelligence'
import type { MeasurementPoint } from '@/types/measurement'

useMeta(() => ({
  title:       'Flash Flood — Weather Intelligence',
  description: 'EP-curve flash flood probability computed live on real NOAA NWS observations. The Miami Beach hypothesis tested every hour.',
}))

const sensors    = ref<NoaaNwsSensor[]>([])
const selectedId = ref<string>('noaa-nws:KMIA')
const series     = ref<MeasurementPoint[]>([])
const score      = ref<FlashFloodScore | null>(null)
const loading    = ref(false)
const errorMsg   = ref<string | null>(null)

const HOURS_RANGE = 168                       // 7-day chart window
const SCORE_HOURS = 6                         // EP curve native window

const selectedSensor = computed(() =>
  sensors.value.find((s) => s.id === selectedId.value) ?? null,
)

// Live SQL preview that the SqlInterpretationPanel renders. The
// parameter array is interpolated by the panel so the user sees
// the LITERAL query.
const seriesSql = `select
  observed_at,
  value as precipitation_mm
from public.measurements
where sensor_id  = $1
  and parameter  = 'precipitation_mm_1h'
  and observed_at >= now() - interval '$2 hours'
order by observed_at asc;`

const scoreSql = `select
  rainfall_mm_window,
  rainfall_mm_72h,
  saturation_estimate,
  p_flood,
  threat_level,
  samples_in_window,
  last_observation_at,
  formula
from public.weather_flash_flood_score(
  p_sensor_id := $1,
  p_hours     := $2
);`

async function loadAll() {
  if (!selectedId.value) return
  loading.value = true
  errorMsg.value = null
  try {
    const [s, v] = await Promise.all([
      fetchSeries({
        sensorId:  selectedId.value,
        parameter: 'precipitation_mm_1h',
        hours:     HOURS_RANGE,
      }),
      fetchFlashFloodScore(selectedId.value, SCORE_HOURS),
    ])
    series.value = s
    score.value  = v
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Load failed'
  } finally {
    loading.value = false
  }
}

watch(selectedId, loadAll)

onMounted(async () => {
  try {
    sensors.value = await fetchNoaaNwsSensors()
    if (sensors.value.length && !sensors.value.find((s) => s.id === selectedId.value)) {
      selectedId.value = sensors.value[0]!.id
    }
    await loadAll()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Sensor list failed'
  }
})

const threatColor = computed(() => {
  switch (score.value?.threatLevel) {
    case 'CRITICAL': return 'border-danger/40  text-danger  bg-danger/[0.06]'
    case 'HIGH':     return 'border-caution/40 text-caution bg-caution/[0.06]'
    case 'MEDIUM':   return 'border-accent/40  text-accent  bg-accent/[0.06]'
    case 'LOW':      return 'border-safe/40    text-safe    bg-safe/[0.06]'
    default:         return 'border-white/10   text-ink-muted bg-white/[0.02]'
  }
})

const lastObservedAgo = computed(() => {
  const d = score.value?.lastObservationAt
  if (!d) return null
  const min = Math.round((Date.now() - d.getTime()) / 60_000)
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
})
</script>

<template>
  <div>
    <WeatherIntelligenceTabStrip />

    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <header>
        <p class="text-ink-muted text-xs tracking-widest uppercase">Use case 1 · Flash Flood</p>
        <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
          Live flash-flood EP curve on real NOAA observations
        </h1>
        <p class="text-ink-muted text-sm sm:text-base mt-3 max-w-3xl leading-relaxed">
          The Miami Beach May 2024 scenario plays every hour, live.
          For any NOAA NWS station, we sum trailing 6-hour
          precipitation, estimate antecedent saturation from the
          past 72 hours, and compute the EP-curve probability. When
          P_flood crosses 0.5 (HIGH band), the page flags it.
          FEMA + NOAA's standard reports don't run this calculation.
          That's the gap.
        </p>
      </header>

      <!-- Sensor picker -->
      <Card padded>
        <label class="block">
          <span class="text-[10px] uppercase tracking-widest text-ink-muted/60">NOAA NWS station</span>
          <select
            v-model="selectedId"
            class="mt-1 w-full bg-surface-0 border border-white/10 rounded-lg h-10 px-3 text-sm text-ink-primary"
          >
            <option v-for="s in sensors" :key="s.id" :value="s.id">
              {{ s.name }}
              <template v-if="s.city">— {{ s.city }}{{ s.state ? ', ' + s.state : '' }}</template>
            </option>
          </select>
        </label>
        <p class="text-ink-muted text-[11px] mt-2">
          8 stations seeded in
          <code class="text-accent">supabase/migrations/0039_noaa_nws_sensors_seed.sql</code>
          (4 Miami area, 2 Texas Gulf, Naples, Tampa). New stations
          are easy to add — just append an
          <code class="text-accent">insert into public.sensors</code> row and the cron picks them up.
        </p>
      </Card>

      <p v-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>

      <!-- Verdict callout -->
      <Card v-if="score" padded :class="['border-2', threatColor]">
        <div class="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">
              EP-curve verdict — {{ selectedSensor?.name ?? selectedId }}
            </p>
            <p class="text-3xl font-semibold num mt-1">{{ score.threatLevel }}</p>
            <p class="text-ink-muted text-xs mt-1">
              Last observation: {{ lastObservedAgo ?? '—' }}
              <span v-if="score.samplesInWindow" class="ml-2">
                · {{ score.samplesInWindow }} sample{{ score.samplesInWindow === 1 ? '' : 's' }} in 6h
              </span>
            </p>
          </div>
          <div class="text-right">
            <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">P_flood</p>
            <p class="text-3xl font-semibold num mt-1">{{ score.pFlood.toFixed(3) }}</p>
          </div>
        </div>

        <dl class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/5 text-sm">
          <div>
            <dt class="text-[10px] uppercase tracking-widest text-ink-muted/60">Trailing 6h rain</dt>
            <dd class="num text-ink-primary mt-0.5">{{ score.rainfallMmWindow.toFixed(1) }} mm</dd>
          </div>
          <div>
            <dt class="text-[10px] uppercase tracking-widest text-ink-muted/60">Antecedent 72h rain</dt>
            <dd class="num text-ink-primary mt-0.5">{{ score.rainfallMm72h.toFixed(1) }} mm</dd>
          </div>
          <div>
            <dt class="text-[10px] uppercase tracking-widest text-ink-muted/60">Saturation estimate</dt>
            <dd class="num text-ink-primary mt-0.5">{{ score.saturationEstimate.toFixed(3) }} m³/m³</dd>
          </div>
        </dl>

        <p class="text-ink-muted text-[11px] mt-3 leading-relaxed">
          Formula: <code class="text-accent">{{ score.formula }}</code>
        </p>
      </Card>

      <!-- Time-series chart -->
      <Card padded>
        <h3 class="text-base font-semibold text-ink-primary mb-3">
          7-day hourly precipitation — real NOAA observations
        </h3>
        <TimeSeriesChart
          :series="series"
          parameter-label="Hourly precipitation"
          unit="mm"
          :loading="loading"
        />
        <SqlInterpretationPanel
          :query="seriesSql"
          :params="[selectedId, HOURS_RANGE]"
          source="public.measurements — populated by ingest-noaa-nws-obs hourly cron (Phase 9.18.1)."
          caption="This is the literal query producing the chart above. Edit the sensor picker and the parameter value updates."
        />
      </Card>

      <!-- Score query -->
      <Card padded>
        <h3 class="text-base font-semibold text-ink-primary mb-3">
          EP-curve query — same as the verdict callout
        </h3>
        <SqlInterpretationPanel
          :query="scoreSql"
          :params="[selectedId, SCORE_HOURS]"
          source="public.weather_flash_flood_score(text, int) RPC — defined in migration 0040."
          caption="Run this against your own Postgres with the same migration applied; you'll get the same threat level."
        />
      </Card>

      <Card padded>
        <WIMetricInfoPanel id="flash-flood.use-case" standalone />
      </Card>
    </div>
  </div>
</template>
