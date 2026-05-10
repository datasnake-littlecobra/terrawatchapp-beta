<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLocationStore } from '@/stores/location'
import {
  fetchSensors,
  fetchSeries,
  fetchMonitoringStats,
  canUseMonitoringDb,
} from '@/services/measurements'
import {
  NDBC_PARAMETERS,
  type Sensor,
  type MeasurementPoint,
  type MonitoringStats,
  type SourceTier,
  type ParameterMeta,
} from '@/types/measurement'
import HeroCounters from './HeroCounters.vue'
import DataSourceToggle from './DataSourceToggle.vue'
import BuoyPicker from './BuoyPicker.vue'
import TimeSeriesChart from './TimeSeriesChart.vue'
import MeasurementsTable from './MeasurementsTable.vue'

// Phase 9.6 — top-level view for the Ocean Monitoring dashboard. Wires the
// 5 sub-components into one screen: hero counters → controls → chart →
// table. Lead with scale ("we monitor 1,500 sensors") before the chart so
// the surface reads as infrastructure, not a one-buoy demo.

const location = useLocationStore()
const { coords } = storeToRefs(location)

const stats = ref<MonitoringStats[]>([])
const sensors = ref<Sensor[]>([])
const selectedSensor = ref<Sensor | null>(null)
const series = ref<MeasurementPoint[]>([])

const sourceTier = ref<'all' | SourceTier>('public')
// NDBC_PARAMETERS is a non-empty const-defined array; the [0] access is
// safe but noUncheckedIndexedAccess types it as possibly-undefined.
const parameter = ref<ParameterMeta>(NDBC_PARAMETERS[0]!) // wave_height_m
const rangeHours = ref(168) // 7d

const loadingSensors = ref(false)
const loadingSeries = ref(false)
const error = ref<string | null>(null)

const ranges = [
  { hours: 24,  label: '24h' },
  { hours: 72,  label: '3d' },
  { hours: 168, label: '7d' },
  { hours: 720, label: '30d' },
]

async function loadStats() {
  try { stats.value = await fetchMonitoringStats() } catch { /* non-fatal */ }
}

async function loadSensors() {
  if (!canUseMonitoringDb()) return
  loadingSensors.value = true
  try {
    const opts = coords.value
      ? {
          centerLat: coords.value.lat,
          centerLon: coords.value.lon,
          radiusKm: 200_000,
          domain: 'ocean' as const,
          maxRows: 200,
        }
      : { domain: 'ocean' as const, maxRows: 200 }
    sensors.value = await fetchSensors(opts)
    if (!selectedSensor.value && sensors.value.length) {
      selectedSensor.value = sensors.value[0] ?? null
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load buoys'
  } finally {
    loadingSensors.value = false
  }
}

async function loadSeries() {
  if (!selectedSensor.value) {
    series.value = []
    return
  }
  loadingSeries.value = true
  try {
    series.value = await fetchSeries({
      sensorId: selectedSensor.value.id,
      parameter: parameter.value.key,
      hours: rangeHours.value,
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load measurements'
  } finally {
    loadingSeries.value = false
  }
}

// Surface "current" stat tiles from the most-recent reading per parameter
// for the selected sensor. We piggy-back on series — when the user changes
// parameter the headline tile flips with it. Cheap; one extra query per
// sub-tile would be wasteful.
const latestPoint = computed(() => series.value.at(-1) ?? null)
const latestValue = computed(() => latestPoint.value?.value ?? null)
const latestAge = computed(() => {
  if (!latestPoint.value) return null
  const ms = Date.now() - latestPoint.value.observedAt.getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'live'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
})

onMounted(async () => {
  await Promise.all([loadStats(), loadSensors()])
  if (selectedSensor.value) await loadSeries()
})

watch([selectedSensor, parameter, rangeHours], loadSeries)
watch(coords, loadSensors)
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
    <!-- Header -->
    <header>
      <div class="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary">Ocean Monitoring</h1>
          <p class="text-ink-muted text-sm mt-1">
            Real-time observations from NOAA buoys across the world's oceans.
            DataSnake's submarine fleet plugs into this view as proprietary data lights up.
          </p>
        </div>
        <DataSourceToggle v-model="sourceTier" :proprietary-available="false" />
      </div>
    </header>

    <!-- Hero counters: lead with scale -->
    <HeroCounters :stats="stats" domain="ocean" :source-tier="sourceTier" />

    <p v-if="error" class="text-danger text-sm">{{ error }}</p>

    <!-- Controls row: buoy + parameter + range -->
    <section class="flex flex-wrap items-center gap-3">
      <BuoyPicker
        :sensors="sensors"
        :selected="selectedSensor"
        :source-tier="sourceTier"
        @select="(s) => (selectedSensor = s)"
      />

      <select
        :value="parameter.key"
        class="h-10 px-3 rounded-lg border border-white/10 bg-surface-1 text-sm text-ink-primary
               focus:outline-none focus:border-accent/50 transition-colors appearance-none pr-8"
        @change="parameter = NDBC_PARAMETERS.find((p) => p.key === ($event.target as HTMLSelectElement).value) ?? parameter"
      >
        <option v-for="p in NDBC_PARAMETERS" :key="p.key" :value="p.key">
          {{ p.label }} ({{ p.unit }})
        </option>
      </select>

      <div class="inline-flex p-0.5 rounded-lg border border-white/10 bg-surface-1">
        <button
          v-for="r in ranges"
          :key="r.hours"
          class="px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors num"
          :class="rangeHours === r.hours
            ? 'bg-accent/20 text-accent'
            : 'text-ink-muted hover:text-ink-primary'"
          @click="rangeHours = r.hours"
        >{{ r.label }}</button>
      </div>

      <span v-if="loadingSensors" class="text-ink-muted text-xs">Loading buoys…</span>
    </section>

    <!-- Current-conditions tile + chart -->
    <section v-if="selectedSensor" class="grid lg:grid-cols-[280px_1fr] gap-4">
      <!-- Current value tile -->
      <div class="bg-surface-1 border border-white/5 rounded-xl p-5 flex flex-col">
        <p class="text-[10px] tracking-widest uppercase text-ink-muted/70">Current</p>
        <p class="text-sm font-medium text-ink-primary mt-0.5">{{ parameter.label }}</p>
        <p class="num text-4xl sm:text-5xl font-semibold text-ink-primary mt-3 tabular-nums">
          <span v-if="latestValue !== null">{{ latestValue.toFixed(2) }}</span>
          <span v-else class="text-ink-muted text-2xl">—</span>
          <span class="text-base text-ink-muted ml-2">{{ parameter.unit }}</span>
        </p>
        <p class="text-xs text-ink-muted mt-2">{{ latestAge ?? 'No recent data' }}</p>
        <div class="mt-auto pt-4 border-t border-white/5 text-xs">
          <p class="text-ink-muted">{{ selectedSensor.name }}</p>
          <p v-if="selectedSensor.lat != null && selectedSensor.lon != null" class="num text-ink-muted/60 mt-0.5">
            {{ selectedSensor.lat.toFixed(2) }}°, {{ selectedSensor.lon.toFixed(2) }}°
          </p>
        </div>
      </div>

      <!-- Chart -->
      <TimeSeriesChart
        :series="series"
        :parameter-label="parameter.label"
        :unit="parameter.unit"
        :loading="loadingSeries"
      />
    </section>

    <!-- Table -->
    <MeasurementsTable
      v-if="selectedSensor"
      :series="series"
      :parameter-label="parameter.label"
      :unit="parameter.unit"
      :sensor-name="selectedSensor.name"
      :source-tier="selectedSensor.sourceTier"
    />

    <!-- Empty state — no buoys -->
    <div v-if="!loadingSensors && !sensors.length" class="text-center py-16">
      <p class="text-ink-primary font-medium">No buoy data yet</p>
      <p class="text-ink-muted text-sm mt-1">
        The NDBC ingest hasn't populated the database yet. Once the
        <code class="text-xs px-1 py-0.5 bg-surface-1 rounded">ingest-ndbc-hourly</code>
        cron has run, buoys appear here automatically.
      </p>
    </div>
  </div>
</template>
