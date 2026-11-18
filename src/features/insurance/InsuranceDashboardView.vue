<script setup lang="ts">
// TerraWatch — Phase 9.12: Insurance MVP dashboard.
//
// Public route at /insurance. Shareable on LinkedIn / X for the partner
// pitch. Built on the existing AnalyticsScaffold + GapCallout primitives
// from Phase 9.11.
//
// MVP visualization choice (intentional, documented in plan):
//   - State-level horizontal-bar EAL chart leads (no county choropleth
//     in v1 — bundling 600KB of county GeoJSON adds friction without
//     proportional value at MVP scale; partners read state-level rollups
//     more readily anyway).
//   - County-level data drives the Top-N hazard lists + County Detail
//     panel. Click any county in the lists to refocus the detail panel.
//   - Active-threat strip joins our live events to high-risk states.

import { computed, onMounted, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, VisualMapComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import AnalyticsScaffold from './AnalyticsScaffold.vue'
import GapCallout       from './GapCallout.vue'
import HazardTopList    from './HazardTopList.vue'
import CountyDetailPanel from './CountyDetailPanel.vue'
import ActiveThreatStrip from './ActiveThreatStrip.vue'
import InsuranceTabStrip from './components/InsuranceTabStrip.vue'
import MetricInfoPanel from './components/MetricInfoPanel.vue'
import Card from '@/ui/Card.vue'
import { useMeta } from '@/composables/useMeta'
import {
  fetchInsuranceCounters,
  fetchTopCountiesByHazard,
  fetchCountyDetail,
  fetchStateEal,
  fetchActiveThreatsInHighRisk,
  type InsuranceCounters,
  type CountyHazardRow,
  type CountyDetail,
  type StateEalRow,
  type ActiveThreat,
} from '@/services/insurance'

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent, LegendComponent, VisualMapComponent])

useMeta(() => ({
  title:       'Insurance — TerraWatch',
  description: 'Underwriting-grade climate-risk intelligence: Expected Annual Loss, composite Risk Score, and per-hazard exposure across ~3,200 US counties, cross-referenced with live elevated-event data.',
  type:        'website',
}))

const counters     = ref<InsuranceCounters | null>(null)
const stateEal     = ref<StateEalRow[]>([])
const floodTop     = ref<CountyHazardRow[]>([])
const wildfireTop  = ref<CountyHazardRow[]>([])
const hurricaneTop = ref<CountyHazardRow[]>([])
const detail       = ref<CountyDetail | null>(null)
const detailLoading = ref(false)
const threats      = ref<ActiveThreat[]>([])
const loading      = ref(true)
const errorMsg     = ref<string | null>(null)

async function loadDetail(fips: string) {
  detailLoading.value = true
  try {
    detail.value = await fetchCountyDetail(fips)
  } catch (e) {
    detail.value = null
    if (e instanceof Error) console.warn('[insurance] county detail failed:', e.message)
  } finally {
    detailLoading.value = false
  }
}

onMounted(async () => {
  try {
    const [c, states, flood, wildfire, hurricane, t] = await Promise.all([
      fetchInsuranceCounters(),
      fetchStateEal(20),
      fetchTopCountiesByHazard('flood', 10),
      fetchTopCountiesByHazard('wildfire', 10),
      fetchTopCountiesByHazard('hurricane', 10),
      fetchActiveThreatsInHighRisk(80, 25),
    ])
    counters.value     = c
    stateEal.value     = states
    floodTop.value     = flood
    wildfireTop.value  = wildfire
    hurricaneTop.value = hurricane
    threats.value      = t

    // Default the detail panel to the highest-EAL county overall — falls
    // back gracefully if the table is empty (pre-seed state).
    const candidates = [...flood, ...wildfire, ...hurricane]
      .sort((a, b) => b.ealUsd - a.ealUsd)
    const firstFips = candidates[0]?.countyFips
    if (firstFips) await loadDetail(firstFips)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to load.'
  } finally {
    loading.value = false
  }
})

function fmtUsdShort(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return '—'
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`
  if (usd >= 1e9)  return `$${(usd / 1e9).toFixed(1)}B`
  if (usd >= 1e6)  return `$${(usd / 1e6).toFixed(0)}M`
  return `$${usd.toFixed(0)}`
}

type Tone = 'safe' | 'caution' | 'danger'
interface HeroCounter { label: string; value: string; unit?: string; tone?: Tone }

const heroCounters = computed<HeroCounter[]>(() => {
  if (!counters.value) return []
  const c = counters.value
  const highRisk: HeroCounter = { label: 'High-risk counties', value: c.highRiskCounties.toLocaleString() }
  if (c.highRiskCounties > 0) highRisk.tone = 'caution'
  const live: Tone =
    c.activeThreatsInHighRisk > 5 ? 'danger' :
    c.activeThreatsInHighRisk > 0 ? 'caution' :
    'safe'
  return [
    { label: 'Counties indexed',         value: c.countiesIndexed.toLocaleString() },
    { label: 'Total EAL (US)',           value: fmtUsdShort(c.totalEalUsd) },
    highRisk,
    { label: 'Live threats in high-risk', value: c.activeThreatsInHighRisk.toLocaleString(), tone: live },
  ]
})

// State-level EAL bar chart (top 20 states by total EAL, descending).
const stateOption = computed(() => {
  const sorted = [...stateEal.value].sort((a, b) => a.totalEalUsd - b.totalEalUsd) // ascending so largest is on top
  return {
    backgroundColor: 'transparent',
    grid: { left: 130, right: 60, top: 10, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      formatter: (p: Array<{ name: string; data: number; dataIndex: number }>) => {
        const point = p[0]
        if (!point) return ''
        const row = sorted[point.dataIndex]
        if (!row) return ''
        return `<b>${row.state}</b><br/>EAL: ${fmtUsdShort(row.totalEalUsd)}<br/>Counties: ${row.countyCount}<br/>High-risk counties: ${row.highRiskCount}`
      },
    },
    visualMap: {
      show: false,
      type: 'continuous',
      min: 0,
      max: Math.max(...sorted.map((r) => r.totalEalUsd), 1),
      inRange: { color: ['#3FA9F5', '#B46BFF', '#FF6B6B'] },
    },
    xAxis: {
      type: 'value',
      axisLabel: {
        color: '#8A97B1',
        formatter: (v: number) => fmtUsdShort(v),
      },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    yAxis: {
      type: 'category',
      data: sorted.map((r) => r.state),
      axisLabel: { color: '#8A97B1' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    series: [{
      type: 'bar',
      data: sorted.map((r) => r.totalEalUsd),
      barWidth: 14,
      label: {
        show: true,
        position: 'right',
        color: '#8A97B1',
        fontSize: 10,
        formatter: (p: { value: number }) => fmtUsdShort(p.value),
      },
    }],
  }
})

const seedHint = computed(() =>
  counters.value != null && counters.value.countiesIndexed === 0
    ? 'No FEMA NRI data loaded yet. The migrations applied; the operator now needs to run the "Seed FEMA NRI" GitHub workflow with the unzipped CSV URL. See DEPLOY.md.'
    : null,
)
</script>

<template>
  <InsuranceTabStrip />
  <AnalyticsScaffold
    domain="insurance"
    eyebrow="Vertical · Insurance"
    title="Climate-risk intelligence for underwriting"
    subtitle="Expected Annual Loss, composite Risk Score, Social Vulnerability, and Community Resilience across ~3,200 US counties — cross-referenced with live elevated-event data so the static index reflects what's actually happening right now."
    :counters="heroCounters"
    :sources="['FEMA National Risk Index v3', 'USGS earthquakes', 'NWS alerts', 'NOAA NHC', 'EONET wildfires', 'GDACS multi-hazard']"
    footnote="FEMA NRI is annual + county-level. Live event data (last 24h) is joined by state to surface real-time activity in your highest-risk markets. The DataSnake fleet roadmap below extends both — parametric triggers + hyperlocal real-time signals for ZIP- or address-level exposure adjustment."
  >
    <p v-if="loading" class="text-ink-muted text-sm">Loading…</p>
    <p v-else-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>

    <template v-else>
      <p
        v-if="seedHint"
        class="rounded-lg border border-caution/30 bg-caution/5 px-3 py-2.5 text-sm text-ink-primary"
      >{{ seedHint }}</p>

      <!-- Hero counters explainer (hero counters are rendered by AnalyticsScaffold) -->
      <Card padded>
        <MetricInfoPanel id="overview.hero-counters" standalone />
      </Card>

      <!-- State-level EAL chart -->
      <Card padded>
        <h2 class="text-base font-semibold text-ink-primary mb-1">
          Total Expected Annual Loss by state
        </h2>
        <p class="text-ink-muted text-sm mb-3">
          Sum of FEMA NRI EAL across every county in the state. Dollar
          values represent population + building-stock exposure modeled
          against historical hazard frequencies — the underwriting
          baseline for catastrophic-risk pricing.
        </p>
        <p v-if="!stateEal.length" class="text-ink-muted text-sm">
          No state-level data yet — load the FEMA NRI seed first.
        </p>
        <VChart
          v-else
          :option="stateOption"
          autoresize
          :style="{ height: `${Math.max(stateEal.length * 24 + 50, 320)}px` }"
        />
        <MetricInfoPanel id="overview.state-eal-chart" />
      </Card>

      <!-- County detail panel (default = highest-EAL county) -->
      <CountyDetailPanel :detail="detail" :loading="detailLoading" />
      <Card padded>
        <MetricInfoPanel id="overview.county-detail" standalone />
      </Card>

      <!-- Top-10 by hazard, three columns -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <HazardTopList
          title="Top 10 — Flood EAL"
          :rows="floodTop"
          @select="loadDetail"
        />
        <HazardTopList
          title="Top 10 — Wildfire EAL"
          :rows="wildfireTop"
          @select="loadDetail"
        />
        <HazardTopList
          title="Top 10 — Hurricane EAL"
          :rows="hurricaneTop"
          @select="loadDetail"
        />
      </div>
      <Card padded>
        <MetricInfoPanel id="overview.hazard-top-lists" standalone />
      </Card>

      <!-- Active threats overlay -->
      <ActiveThreatStrip :threats="threats" :min-risk="80" />
      <Card padded>
        <MetricInfoPanel id="overview.active-threats-strip" standalone />
      </Card>

      <GapCallout
        domain="insurance"
        headline="FEMA NRI is the public baseline. DataSnake's parametric + hyperlocal layer is what closes the underwriting gap."
        body="The NRI gives you US county-level Expected Annual Loss against historical climatology — the right anchor for a portfolio view. It does not give you intra-county heterogeneity (a riverside parcel and a hilltop parcel in the same county show identical EAL), live parametric triggers, or forward-looking climate-adjusted scenarios. DataSnake's fleet targets all three: ZIP- and address-level exposure adjustment via portable hyperlocal nodes, real-time parametric triggers wired into the same events table powering the active-threat strip above, and CarbonPlan-aligned +1.5°C / +2°C / +3°C projections in v2."
        :stats="[
          { label: 'US counties indexed',         value: counters?.countiesIndexed.toLocaleString() ?? '—' },
          { label: 'Total US EAL (annual)',       value: fmtUsdShort(counters?.totalEalUsd) },
          { label: 'High-risk counties (≥80)',    value: counters?.highRiskCounties.toLocaleString() ?? '—' },
          { label: 'NRI granularity',             value: 'county', unit: '~3,200 cells' },
          { label: 'DataSnake target granularity', value: 'address', unit: 'parametric + hyperlocal' },
          { label: 'Update cadence (NRI vs DS)',  value: 'annual → real-time' },
        ]"
        :bullets="[
          'Phase 9.12.1 — Auto-refresh polling: live re-render on the active-threat strip + counters.',
          'Phase 9.12.2 — CarbonPlan climate-adjusted projection toggle (+1.5°C / +2°C / +3°C side-by-side with NRI today).',
          'Phase 9.12.3 — Address-level lookup: paste an address, get nearest-county NRI + active threats.',
          'Phase 9.12.5 — Authenticated portfolio aggregation: partners upload a CSV of policies, dashboard computes aggregate exposure by hazard and geographic concentration with multi-tenant RLS.',
        ]"
      />
    </template>
  </AnalyticsScaffold>
</template>
