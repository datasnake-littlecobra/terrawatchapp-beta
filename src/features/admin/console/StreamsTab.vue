<script setup lang="ts">
// TerraWatch — Phase 9.16 Streams tab.
//
// Live "data flowing in" view, similar to /insurance/pipeline but
// scoped to the operator (admin sees all sensors, not just proprietary).
// Reuses the same chart primitives (TimeSeriesChart, AnomalyChart,
// ComparativeChart).

import { computed, onMounted, ref, watch } from 'vue'
import NarrativeCard from './components/NarrativeCard.vue'
import Card from '@/ui/Card.vue'
import TimeSeriesChart from '@/features/monitoring/TimeSeriesChart.vue'
import AnomalyChart from '@/features/insurance/components/AnomalyChart.vue'
import ComparativeChart from '@/features/insurance/components/ComparativeChart.vue'
import { fetchSensorFreshness, type FreshnessRow } from '@/services/opsConsole'
import { fetchSeries } from '@/services/measurements'
import {
  fetchAnomalies,
  fetchCompare,
  fetchCorrelation,
  VARIANT_PARAMETERS,
  type AnomalyPoint,
  type ComparePoint,
  type CorrelationSummary,
} from '@/services/sensorPipeline'
import type { MeasurementPoint } from '@/types/measurement'

// NDBC variant parameter set (public-tier) — not in the existing
// VARIANT_PARAMETERS map (which is DataSnake-only). Add inline.
const NDBC_PARAMS = [
  { key: 'wave_height_m',  label: 'Wave height',  unit: 'm' },
  { key: 'wave_period_s',  label: 'Wave period',  unit: 's' },
  { key: 'wind_speed_mps', label: 'Wind speed',   unit: 'm/s' },
  { key: 'gust_mps',       label: 'Gust',         unit: 'm/s' },
  { key: 'pressure_hpa',   label: 'Pressure',     unit: 'hPa' },
  { key: 'air_temp_c',     label: 'Air temp',     unit: '°C' },
  { key: 'sst_c',          label: 'Sea-surface',  unit: '°C' },
]

const sensors = ref<FreshnessRow[]>([])
const selectedId = ref<string>('')
const param = ref<string>('')
const paramB = ref<string>('')
const hours = ref<number>(72)

const series = ref<MeasurementPoint[]>([])
const anomalies = ref<AnomalyPoint[]>([])
const comparePts = ref<ComparePoint[]>([])
const correlation = ref<CorrelationSummary | null>(null)

const loadingRaw = ref(false)
const loadingAnomaly = ref(false)
const loadingCompare = ref(false)
const errorMsg = ref<string | null>(null)

const HOURS_OPTS = [
  { v: 24,  label: '24h' },
  { v: 72,  label: '3d' },
  { v: 168, label: '7d' },
]

const selected = computed<FreshnessRow | null>(
  () => sensors.value.find((s) => s.id === selectedId.value) ?? null
)

const params = computed(() => {
  const s = selected.value
  if (!s) return []
  const variant = (s.metadata?.['variant'] as string | undefined) ?? ''
  if (VARIANT_PARAMETERS[variant]) return VARIANT_PARAMETERS[variant]
  if (s.source === 'ndbc') return NDBC_PARAMS
  return []
})

const labelOf = (k: string) => params.value.find((p) => p.key === k)?.label ?? k
const unitOf  = (k: string) => params.value.find((p) => p.key === k)?.unit ?? ''

async function loadAll() {
  if (!selectedId.value || !param.value) return
  loadingRaw.value = true
  loadingAnomaly.value = true
  loadingCompare.value = true
  try {
    const [s, a] = await Promise.all([
      fetchSeries({ sensorId: selectedId.value, parameter: param.value, hours: hours.value }),
      fetchAnomalies(selectedId.value, param.value, hours.value),
    ])
    series.value = s
    anomalies.value = a
    if (paramB.value && paramB.value !== param.value) {
      const [pts, corr] = await Promise.all([
        fetchCompare(selectedId.value, param.value, paramB.value, hours.value),
        fetchCorrelation(selectedId.value, param.value, paramB.value, hours.value),
      ])
      comparePts.value = pts
      correlation.value = corr
    } else {
      comparePts.value = []
      correlation.value = null
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Load failed'
  } finally {
    loadingRaw.value = false
    loadingAnomaly.value = false
    loadingCompare.value = false
  }
}

watch(selected, (s) => {
  if (!s) return
  const p = params.value
  if (!p.length) return
  param.value = p[0]!.key
  paramB.value = p[1]?.key ?? p[0]!.key
  void loadAll()
})

watch([param, paramB, hours], loadAll)

onMounted(async () => {
  try {
    sensors.value = await fetchSensorFreshness()
    if (sensors.value.length) selectedId.value = sensors.value[0]!.id
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Sensor list failed'
  }
})
</script>

<template>
  <div class="space-y-5">
    <NarrativeCard
      eyebrow="Ops Console · Streams"
      title="Live data flowing in"
      body="What the platform is breathing right now. Pick any sensor (public or proprietary), pick a parameter, then watch the raw stream + the rolling z-score anomalies + the correlated peer parameter. The same machinery powers the public /insurance/pipeline page — this tab gives operators the unfiltered view across the entire fleet."
      :links="[{ to: '/insurance/pipeline', label: 'Public pipeline view' }]"
    />

    <!-- Sensor + parameter controls -->
    <Card padded>
      <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <label class="text-[10px] uppercase tracking-widest text-ink-muted/60 block mb-1">Sensor</label>
          <select v-model="selectedId" class="w-full rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-ink-primary text-sm">
            <option v-for="s in sensors" :key="s.id" :value="s.id">
              {{ s.name }} — {{ s.source }} / {{ s.sourceTier }} / {{ s.domain }} — {{ s.freshnessStatus }}
            </option>
          </select>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-[10px] uppercase tracking-widest text-ink-muted/60 mr-1">Range:</span>
          <button
            v-for="h in HOURS_OPTS"
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

      <div v-if="params.length" class="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-white/5">
        <span class="text-[10px] uppercase tracking-widest text-ink-muted/60 mr-1">Parameter:</span>
        <button
          v-for="p in params"
          :key="p.key"
          type="button"
          class="text-xs px-3 py-1.5 rounded-full border transition-colors"
          :class="param === p.key
            ? 'border-accent bg-accent/15 text-accent'
            : 'border-white/10 text-ink-muted hover:text-ink-primary hover:border-white/20'"
          @click="param = p.key"
        >{{ p.label }}</button>
      </div>
    </Card>

    <p v-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>

    <!-- Raw -->
    <Card padded>
      <h3 class="text-sm font-semibold text-ink-primary mb-1">Raw time-series</h3>
      <p class="text-ink-muted text-xs mb-3">
        Auto-pivots from 10-min raw resolution to hourly rollup at the
        36h threshold. The min-max band shows intra-hour variability
        when the rollup is in use.
      </p>
      <TimeSeriesChart
        :series="series"
        :parameter-label="labelOf(param)"
        :unit="unitOf(param)"
        :loading="loadingRaw"
      />
    </Card>

    <!-- Anomalies -->
    <Card padded>
      <h3 class="text-sm font-semibold text-ink-primary mb-1">Rolling 24h z-score anomalies</h3>
      <p class="text-ink-muted text-xs mb-3">
        For each hour, compute the mean and stddev of the prior 24 hours;
        flag points where |z| &gt; 2. This is the leading-indicator
        signal that lets parametric triggers fire before the news
        catches up.
      </p>
      <AnomalyChart
        :points="anomalies"
        :parameter-label="labelOf(param)"
        :unit="unitOf(param)"
        :loading="loadingAnomaly"
      />
    </Card>

    <!-- Compare -->
    <Card padded>
      <div class="flex items-baseline justify-between gap-3 mb-1 flex-wrap">
        <h3 class="text-sm font-semibold text-ink-primary">Comparative analysis</h3>
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-[10px] uppercase tracking-widest text-ink-muted/60 mr-1">vs:</span>
          <button
            v-for="p in params"
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
        Pearson r over the window. Catches sensor faults — when two
        physically-coupled parameters stop covarying, the sensor is
        suspect.
      </p>
      <ComparativeChart
        :points="comparePts"
        :label-a="labelOf(param)"
        :label-b="labelOf(paramB)"
        :unit-a="unitOf(param)"
        :unit-b="unitOf(paramB)"
        :correlation="correlation"
        :loading="loadingCompare"
      />
    </Card>
  </div>
</template>
