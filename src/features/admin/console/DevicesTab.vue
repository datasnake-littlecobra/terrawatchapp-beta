<script setup lang="ts">
// TerraWatch — Phase 9.16 Devices tab.
//
// Sensor fleet management: table with status, filters, click-into
// detail. Reads public.sensor_freshness (Phase 9.16 materialized
// view) which folds in last_observed_at + freshness_status.

import { computed, onMounted, ref } from 'vue'
import NarrativeCard from './components/NarrativeCard.vue'
import Card from '@/ui/Card.vue'
import TimeSeriesChart from '@/features/monitoring/TimeSeriesChart.vue'
import { fetchSensorFreshness, type FreshnessRow, type FreshnessStatus } from '@/services/opsConsole'
import { fetchSeries } from '@/services/measurements'
import { VARIANT_PARAMETERS } from '@/services/sensorPipeline'
import type { MeasurementPoint } from '@/types/measurement'

const rows = ref<FreshnessRow[]>([])
const loading = ref(true)
const errorMsg = ref<string | null>(null)

// Filters
const filterDomain  = ref<'all' | 'ocean' | 'land' | 'air'>('all')
const filterTier    = ref<'all' | 'public' | 'proprietary'>('all')
const filterStatus  = ref<'all' | FreshnessStatus>('all')
const filterQuery   = ref('')

// Detail panel
const selectedId = ref<string | null>(null)
const selectedSeries = ref<MeasurementPoint[]>([])
const selectedParam = ref<string>('')
const detailLoading = ref(false)

async function load() {
  loading.value = true
  try {
    const opts: Parameters<typeof fetchSensorFreshness>[0] = {}
    if (filterDomain.value !== 'all') opts.domain = filterDomain.value
    if (filterTier.value !== 'all')   opts.sourceTier = filterTier.value
    if (filterStatus.value !== 'all') opts.status = filterStatus.value
    if (filterQuery.value.trim())     opts.query = filterQuery.value.trim()
    rows.value = await fetchSensorFreshness(opts)
    errorMsg.value = null
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Load failed'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const selectedRow = computed<FreshnessRow | null>(
  () => rows.value.find((r) => r.id === selectedId.value) ?? null
)

const selectedVariantParams = computed(() => {
  const v = (selectedRow.value?.metadata?.['variant'] as string | undefined) ?? ''
  return VARIANT_PARAMETERS[v] ?? []
})

async function selectRow(id: string) {
  selectedId.value = id
  const r = rows.value.find((x) => x.id === id)
  if (!r) return
  const params = VARIANT_PARAMETERS[(r.metadata?.['variant'] as string | undefined) ?? '']
  selectedParam.value = params?.[0]?.key ?? ''
  if (selectedParam.value) await loadDetailSeries()
}

async function loadDetailSeries() {
  if (!selectedId.value || !selectedParam.value) return
  detailLoading.value = true
  try {
    selectedSeries.value = await fetchSeries({
      sensorId:  selectedId.value,
      parameter: selectedParam.value,
      hours:     72,
    })
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Series fetch failed'
  } finally {
    detailLoading.value = false
  }
}

function fmtRel(d: Date | null): string {
  if (!d) return 'never'
  const m = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function statusClass(s: FreshnessStatus): string {
  if (s === 'fresh')   return 'border-safe/40    text-safe    bg-safe/[0.08]'
  if (s === 'lagging') return 'border-caution/40 text-caution bg-caution/[0.08]'
  if (s === 'stale')   return 'border-danger/40  text-danger  bg-danger/[0.08]'
  return 'border-white/10 text-ink-muted bg-white/[0.02]'
}

const labelForParam = (k: string) =>
  selectedVariantParams.value.find((p) => p.key === k)?.label ?? k
const unitForParam = (k: string) =>
  selectedVariantParams.value.find((p) => p.key === k)?.unit ?? ''
</script>

<template>
  <div class="space-y-5">
    <NarrativeCard
      eyebrow="Ops Console · Devices"
      title="Sensor fleet status"
      body="Every deployed unit, grouped by status. 'Fresh' = a reading landed in the last 15 minutes. 'Lagging' = 15-60 minutes silent. 'Stale' = >60 minutes silent (operational triage). Click any row to inspect lifecycle, deployment history, and recent time-series."
      :links="[
        { to: '/admin/console/streams', label: 'Inspect a sensor live' },
        { to: '/admin/console/monitor', label: 'Why a sensor went stale' },
      ]"
    />

    <!-- Filters -->
    <Card padded>
      <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3">
        <input
          v-model="filterQuery"
          type="text"
          placeholder="Search by id or name…"
          class="rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-ink-primary text-sm"
          @keydown.enter="load"
        />
        <select v-model="filterDomain" class="rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-ink-primary text-sm" @change="load">
          <option value="all">All domains</option>
          <option value="ocean">Ocean</option>
          <option value="land">Ground</option>
          <option value="air">Air</option>
        </select>
        <select v-model="filterTier" class="rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-ink-primary text-sm" @change="load">
          <option value="all">All tiers</option>
          <option value="public">Public</option>
          <option value="proprietary">Proprietary</option>
        </select>
        <select v-model="filterStatus" class="rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-ink-primary text-sm" @change="load">
          <option value="all">All statuses</option>
          <option value="fresh">Fresh</option>
          <option value="lagging">Lagging</option>
          <option value="stale">Stale</option>
          <option value="never">Never reported</option>
        </select>
      </div>
    </Card>

    <p v-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>

    <!-- Table -->
    <Card padded>
      <div class="flex items-baseline justify-between mb-3">
        <h2 class="text-base font-semibold text-ink-primary">Fleet</h2>
        <p class="text-xs text-ink-muted"><span class="num">{{ rows.length }}</span> sensor{{ rows.length === 1 ? '' : 's' }}</p>
      </div>
      <p v-if="loading" class="text-ink-muted text-sm">Loading…</p>
      <p v-else-if="!rows.length" class="text-ink-muted text-sm">No sensors match the current filters.</p>
      <div v-else class="overflow-x-auto -mx-3">
        <table class="w-full text-sm border-collapse min-w-[760px]">
          <thead>
            <tr class="text-[10px] uppercase tracking-widest text-ink-muted/60 border-b border-white/5">
              <th class="text-left py-2 px-3">Status</th>
              <th class="text-left py-2 px-3">ID</th>
              <th class="text-left py-2 px-3">Name</th>
              <th class="text-left py-2 px-3">Source · tier · domain</th>
              <th class="text-right py-2 px-3">Last reading</th>
              <th class="text-right py-2 px-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            <tr
              v-for="r in rows"
              :key="r.id"
              class="text-ink-primary cursor-pointer hover:bg-white/[0.02]"
              :class="{ 'bg-white/[0.04]': selectedId === r.id }"
              @click="selectRow(r.id)"
            >
              <td class="py-2 px-3">
                <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border" :class="statusClass(r.freshnessStatus)">{{ r.freshnessStatus }}</span>
              </td>
              <td class="py-2 px-3 font-mono text-xs">{{ r.id }}</td>
              <td class="py-2 px-3">{{ r.name }}</td>
              <td class="py-2 px-3 text-xs text-ink-muted">{{ r.source }} · {{ r.sourceTier }} · {{ r.domain }}</td>
              <td class="py-2 px-3 text-xs text-right text-ink-muted">{{ fmtRel(r.lastObservedAt) }}</td>
              <td class="py-2 px-3 text-right">
                <span class="text-xs text-accent" v-if="selectedId === r.id">selected</span>
                <span class="text-xs text-ink-muted" v-else>inspect →</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <!-- Detail panel -->
    <Card v-if="selectedRow" padded>
      <div class="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">Detail</p>
          <h2 class="text-lg font-semibold text-ink-primary">{{ selectedRow.name }}</h2>
          <p class="text-xs text-ink-muted font-mono mt-0.5">{{ selectedRow.id }}</p>
        </div>
        <button type="button" class="text-xs text-ink-muted hover:text-ink-primary" @click="selectedId = null">close</button>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div class="rounded-lg border border-white/5 bg-surface-0/60 p-3">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Variant</p>
          <p class="num text-sm text-ink-primary mt-1">{{ selectedRow.metadata?.['variant'] ?? '—' }}</p>
        </div>
        <div class="rounded-lg border border-white/5 bg-surface-0/60 p-3">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Firmware</p>
          <p class="num text-sm text-ink-primary mt-1">{{ selectedRow.metadata?.['firmware'] ?? selectedRow.metadata?.['firmware_version'] ?? '—' }}</p>
        </div>
        <div class="rounded-lg border border-white/5 bg-surface-0/60 p-3">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Deployed</p>
          <p class="num text-sm text-ink-primary mt-1">{{ String(selectedRow.metadata?.['deployed_at'] ?? '—').slice(0, 10) }}</p>
        </div>
        <div class="rounded-lg border border-white/5 bg-surface-0/60 p-3">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Location</p>
          <p class="num text-sm text-ink-primary mt-1">
            <template v-if="selectedRow.lat != null && selectedRow.lon != null">{{ selectedRow.lat.toFixed(2) }}, {{ selectedRow.lon.toFixed(2) }}</template>
            <template v-else>—</template>
          </p>
        </div>
      </div>

      <!-- Parameter selector -->
      <div v-if="selectedVariantParams.length" class="flex flex-wrap items-center gap-1.5 mb-3">
        <span class="text-[10px] uppercase tracking-widest text-ink-muted/60 mr-1">Parameter:</span>
        <button
          v-for="p in selectedVariantParams"
          :key="p.key"
          type="button"
          class="text-xs px-3 py-1.5 rounded-full border transition-colors"
          :class="selectedParam === p.key
            ? 'border-accent bg-accent/15 text-accent'
            : 'border-white/10 text-ink-muted hover:text-ink-primary hover:border-white/20'"
          @click="selectedParam = p.key; loadDetailSeries()"
        >{{ p.label }}</button>
      </div>

      <TimeSeriesChart
        v-if="selectedParam"
        :series="selectedSeries"
        :parameter-label="labelForParam(selectedParam)"
        :unit="unitForParam(selectedParam)"
        :loading="detailLoading"
      />

      <p v-if="!selectedVariantParams.length" class="text-ink-muted text-xs">
        No parameter vocabulary registered for this sensor's variant.
        Add it to <code class="text-accent">VARIANT_PARAMETERS</code> in
        <code class="text-accent">src/services/sensorPipeline.ts</code>.
      </p>
    </Card>
  </div>
</template>
