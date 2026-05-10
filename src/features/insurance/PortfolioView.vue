<script setup lang="ts">
// TerraWatch / DataSnake — Module 5: Portfolio Risk Aggregation.
//
// For reinsurers: distribution of risk across the portfolio, exposure-
// vs-risk scatter to surface mispriced policies, peril × region
// concentration heatmap, accumulation zones. The 80/20 view they
// always need: what fraction of policies drive what fraction of CAT.

import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, ScatterChart, HeatmapChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, VisualMapComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import Card from '@/ui/Card.vue'
import InsuranceTabStrip from './components/InsuranceTabStrip.vue'
import DemoBadge from './components/DemoBadge.vue'
import MetricInfoPanel from './components/MetricInfoPanel.vue'
import { useMeta } from '@/composables/useMeta'
import { PORTFOLIO_POLICIES, EP_CURVES, fmtUsd, type Peril } from '@/data/insurance-mock'

use([CanvasRenderer, BarChart, ScatterChart, HeatmapChart, GridComponent, TooltipComponent, LegendComponent, VisualMapComponent])

useMeta(() => ({
  title:       'Portfolio Risk — Insurance Intelligence',
  description: 'Distribution, exposure scatter, peril concentration, and accumulation zones across an insurance portfolio. Surfaces the 80/20 of CAT exposure.',
}))

const policies = PORTFOLIO_POLICIES

// ---------- KPI cards -------------------------------------------------

const totalExposure = computed(() =>
  policies.reduce((s, p) => s + p.exposure_usd * 1e9, 0),
)

const highRiskFrac = computed(() => {
  const high = policies.filter((p) => p.risk_score >= 70)
  return {
    count: high.length,
    pctOfPolicies: high.length / policies.length,
    exposure: high.reduce((s, p) => s + p.exposure_usd * 1e9, 0),
    pctOfExposure: high.reduce((s, p) => s + p.exposure_usd, 0) /
                   policies.reduce((s, p) => s + p.exposure_usd, 0),
  }
})

const mispriced = computed(() => {
  const under = policies.filter((p) => p.classified === 'underpriced')
  const over  = policies.filter((p) => p.classified === 'overpriced')
  return {
    underPct: under.length / policies.length,
    overPct:  over.length / policies.length,
    underExposure: under.reduce((s, p) => s + p.exposure_usd * 1e9, 0),
  }
})

const reserveAdjust = computed(() => {
  // Crude expected-loss reserve recommendation:
  // (current AAL) * weighted under-pricing adjustment.
  // Keeps the user grounded without pretending more precision than warranted.
  return Math.round(totalExposure.value * 0.012 * mispriced.value.underPct * 5)
})

// ---------- Distribution bar chart -----------------------------------

const distOption = computed(() => {
  const buckets = ['<30','30-40','40-50','50-60','60-70','70-80','80+']
  const counts = [0, 0, 0, 0, 0, 0, 0]
  const expSums = [0, 0, 0, 0, 0, 0, 0]
  for (const p of policies) {
    const i = Math.min(6, Math.max(0, Math.floor((p.risk_score - 20) / 10)))
    counts[i]!++
    expSums[i]! += p.exposure_usd
  }
  return {
    backgroundColor: 'transparent',
    grid: { left: 56, right: 60, top: 16, bottom: 36 },
    legend: { textStyle: { color: '#8A97B1' }, top: 0, show: false },
    tooltip: {
      trigger: 'axis',
      formatter: (p: Array<{ axisValueLabel: string; data: number; seriesName: string }>) => {
        const idx = buckets.indexOf(p[0]?.axisValueLabel ?? '')
        return `<b>${buckets[idx]}</b> risk<br/>Policies: ${counts[idx]}<br/>Exposure: $${expSums[idx]?.toFixed(1)}B`
      },
    },
    xAxis: {
      type: 'category', data: buckets,
      name: 'Risk score',
      nameLocation: 'middle', nameGap: 30,
      nameTextStyle: { color: '#8A97B1', fontSize: 10 },
      axisLabel: { color: '#8A97B1' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    yAxis: [
      {
        type: 'value', name: '# Policies', position: 'left',
        nameTextStyle: { color: '#8A97B1', fontSize: 10 },
        axisLabel: { color: '#8A97B1' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      {
        type: 'value', name: 'Exposure ($B)', position: 'right',
        nameTextStyle: { color: '#8A97B1', fontSize: 10 },
        axisLabel: { color: '#8A97B1', formatter: (v: number) => '$' + v + 'B' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Policies', type: 'bar',
        data: counts.map((v, i) => ({
          value: v,
          itemStyle: { color: i < 2 ? '#3DDC97' : i < 5 ? '#F5B74A' : '#FF6B6B' },
        })),
        barWidth: 22,
      },
      {
        name: 'Exposure', type: 'line', yAxisIndex: 1,
        data: expSums.map((v) => Number(v.toFixed(1))),
        symbol: 'circle', symbolSize: 7,
        lineStyle: { color: '#3FA9F5', width: 2 },
        itemStyle: { color: '#3FA9F5' },
      },
    ],
  }
})

// ---------- Exposure-vs-risk scatter ---------------------------------

const scatterOption = computed(() => {
  const points = policies.map((p) => ({
    value: [p.risk_score, p.exposure_usd, p.policy_id, p.region, p.classified],
    itemStyle: {
      color: p.classified === 'underpriced' ? '#FF6B6B'
            : p.classified === 'overpriced'  ? '#3DDC97'
            : '#3FA9F5',
      opacity: 0.7,
    },
  }))
  return {
    backgroundColor: 'transparent',
    grid: { left: 56, right: 16, top: 32, bottom: 50 },
    tooltip: {
      formatter: (p: { data: { value: [number, number, string, string, string] } }) => {
        const [score, exp, id, region, cls] = p.data.value
        return `<b>${id}</b><br/>${region}<br/>Risk: <b>${score}</b><br/>Exposure: <b>$${exp.toFixed(1)}B</b><br/>${cls.replace('_', ' ')}`
      },
    },
    legend: {
      textStyle: { color: '#8A97B1' }, top: 0,
      data: ['Underpriced', 'Priced correctly', 'Overpriced'],
    },
    xAxis: {
      type: 'value', name: 'Risk score', min: 0, max: 100,
      nameLocation: 'middle', nameGap: 30,
      nameTextStyle: { color: '#8A97B1', fontSize: 10 },
      axisLabel: { color: '#8A97B1' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    yAxis: {
      type: 'value', name: 'Exposure ($B)',
      nameLocation: 'middle', nameGap: 40,
      nameTextStyle: { color: '#8A97B1', fontSize: 10 },
      axisLabel: { color: '#8A97B1', formatter: (v: number) => '$' + v + 'B' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [
      { name: 'Underpriced',     type: 'scatter', data: points.filter((p) => p.value[4] === 'underpriced'),       symbolSize: 11 },
      { name: 'Priced correctly',type: 'scatter', data: points.filter((p) => p.value[4] === 'priced_correctly'),  symbolSize: 9 },
      { name: 'Overpriced',      type: 'scatter', data: points.filter((p) => p.value[4] === 'overpriced'),        symbolSize: 9 },
    ],
  }
})

// ---------- Peril × region heatmap -----------------------------------

const heatmapOption = computed(() => {
  const regions = Array.from(new Set(policies.map((p) => p.region))).sort()
  const perils: Peril[] = ['flood', 'seismic', 'wind', 'wildfire', 'surge']
  const data: Array<[number, number, number]> = []
  for (let r = 0; r < regions.length; r++) {
    for (let pi = 0; pi < perils.length; pi++) {
      const region = regions[r]
      const peril = perils[pi]
      if (!region || !peril) continue
      const exp = policies
        .filter((p) => p.region === region && p.perils.includes(peril))
        .reduce((s, p) => s + p.exposure_usd, 0)
      data.push([pi, r, Math.round(exp * 10) / 10])
    }
  }
  const max = Math.max(...data.map((d) => d[2]), 1)
  return {
    backgroundColor: 'transparent',
    grid: { left: 130, right: 16, top: 30, bottom: 30, containLabel: false },
    tooltip: {
      position: 'top',
      formatter: (p: { data: [number, number, number] }) =>
        `<b>${regions[p.data[1]]}</b><br/>${perils[p.data[0]]}: $${p.data[2]}B`,
    },
    visualMap: {
      min: 0, max,
      orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#0B1220', '#3FA9F5', '#FF6B6B'] },
      textStyle: { color: '#8A97B1' },
    },
    xAxis: {
      type: 'category', data: perils,
      axisLabel: { color: '#8A97B1' },
      splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.02)','rgba(255,255,255,0)'] } },
    },
    yAxis: {
      type: 'category', data: regions,
      axisLabel: { color: '#8A97B1' },
    },
    series: [{
      type: 'heatmap', data,
      label: { show: false },
      itemStyle: { borderColor: 'rgba(0,0,0,0.4)', borderWidth: 1 },
    }],
  }
})

// ---------- EAL vs Premium fairness scatter --------------------------
// THE money chart. Each policy plotted as (modeled annual loss, premium
// charged). A "fair" pricing diagonal runs at premium = EAL × 1.5 (a
// representative combined-ratio load). Dots BELOW the line are
// underpriced — the gap to the line is dollars-on-the-table. DataSnake's
// claim is that without sensor-grade EAL precision, you can't see the
// underpricing because the EAL itself has too much variance.

// Industry-typical premium-to-EAL multiplier (combined-ratio target ~95%
// + ~50% expense + profit load). The dashed diagonal on the chart sits
// at this slope so the existing pricing classification aligns visually.
const LOAD_FACTOR = 1.5

interface PolicyEcon { eal_m: number; premium_m: number; classified: string; region: string; policy_id: string }

// Back-derive EAL from the mock's "correct premium" rule so the diagonal
// is consistent with the under/over/correct labels generated by the
// data factory in src/data/insurance-mock.ts.
function correctPremiumB(p: { exposure_usd: number; risk_score: number }): number {
  return p.exposure_usd * 0.012 * (p.risk_score / 50)
}
function ealB(p: { exposure_usd: number; risk_score: number }): number {
  return correctPremiumB(p) / LOAD_FACTOR
}

const policyEcon = computed<PolicyEcon[]>(() =>
  policies.map((p) => ({
    eal_m:      Math.round(ealB(p) * 1000 * 100) / 100,    // $B → $M
    premium_m:  Math.round(p.premium_usd * 1000 * 100) / 100,
    classified: p.classified, region: p.region, policy_id: p.policy_id,
  }))
)

const totalUnderpricingGap = computed(() => {
  // Sum of (fair_premium − actual_premium) for underpriced policies.
  // The explicit $ DataSnake's tighter EAL exposes.
  let gap = 0
  for (const p of policies) {
    if (p.classified !== 'underpriced') continue
    const fairM   = ealB(p) * LOAD_FACTOR * 1000  // $M
    const actualM = p.premium_usd * 1000          // $M
    gap += Math.max(0, fairM - actualM)
  }
  return Math.round(gap * 1e6)  // → $
})

const fairnessOption = computed(() => {
  const points = policyEcon.value
  // Fair-line points: span the full EAL range
  const ealMax = Math.max(...points.map((p) => p.eal_m), 1)
  const fairLine = [
    { value: [0.01, 0.01 * LOAD_FACTOR] },
    { value: [ealMax * 1.05, ealMax * 1.05 * LOAD_FACTOR] },
  ]
  return {
    backgroundColor: 'transparent',
    grid: { left: 60, right: 16, top: 32, bottom: 50 },
    legend: {
      textStyle: { color: '#8A97B1' }, top: 0,
      data: ['Fair pricing (Premium = EAL × 1.5)', 'Underpriced', 'Priced correctly', 'Overpriced'],
    },
    tooltip: {
      formatter: (p: { data: { value: [number, number]; policy_id?: string; region?: string; classified?: string } }) => {
        const v = p.data.value
        if (!v) return ''
        const id = p.data.policy_id; const r = p.data.region; const c = p.data.classified
        if (id) {
          const ealM = v[0]
          const premM = v[1]
          const fairM = ealM * LOAD_FACTOR
          const gap = premM - fairM
          return `<b>${id}</b><br/>${r}<br/>EAL: <b>$${ealM.toFixed(2)}M</b>/yr<br/>Premium: <b>$${premM.toFixed(2)}M</b>/yr<br/>Fair: $${fairM.toFixed(2)}M<br/>Gap to fair: ${gap >= 0 ? '+' : ''}$${gap.toFixed(2)}M (${c})`
        }
        return ''
      },
    },
    xAxis: {
      type: 'log', name: 'Modeled annual loss — EAL ($M/yr)',
      nameLocation: 'middle', nameGap: 32,
      nameTextStyle: { color: '#8A97B1', fontSize: 10 },
      axisLabel: { color: '#8A97B1', formatter: (v: number) => '$' + v.toFixed(0) + 'M' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    yAxis: {
      type: 'log', name: 'Premium charged ($M/yr)',
      nameLocation: 'middle', nameGap: 44,
      nameTextStyle: { color: '#8A97B1', fontSize: 10 },
      axisLabel: { color: '#8A97B1', formatter: (v: number) => '$' + v.toFixed(0) + 'M' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [
      {
        name: 'Fair pricing (Premium = EAL × 1.5)', type: 'line',
        data: fairLine, smooth: false, symbol: 'none',
        lineStyle: { color: '#8A97B1', type: 'dashed', width: 1.5 },
      },
      {
        name: 'Underpriced', type: 'scatter', symbolSize: 11,
        data: points.filter((p) => p.classified === 'underpriced')
          .map((p) => ({ value: [p.eal_m, p.premium_m], policy_id: p.policy_id, region: p.region, classified: p.classified })),
        itemStyle: { color: '#FF6B6B', opacity: 0.75 },
      },
      {
        name: 'Priced correctly', type: 'scatter', symbolSize: 9,
        data: points.filter((p) => p.classified === 'priced_correctly')
          .map((p) => ({ value: [p.eal_m, p.premium_m], policy_id: p.policy_id, region: p.region, classified: p.classified })),
        itemStyle: { color: '#3FA9F5', opacity: 0.65 },
      },
      {
        name: 'Overpriced', type: 'scatter', symbolSize: 9,
        data: points.filter((p) => p.classified === 'overpriced')
          .map((p) => ({ value: [p.eal_m, p.premium_m], policy_id: p.policy_id, region: p.region, classified: p.classified })),
        itemStyle: { color: '#3DDC97', opacity: 0.65 },
      },
    ],
  }
})

// ---------- Per-peril savings at 1-in-100yr --------------------------
// Pulls from EP_CURVES at return_period=100. Story: where the $ savings
// from sensor-data injection actually concentrate by peril.

const perilSavingsOption = computed(() => {
  const PERILS: Array<{ key: 'flood' | 'seismic' | 'wind' | 'combined'; label: string; color: string }> = [
    { key: 'combined', label: 'Combined',  color: '#B46BFF' },
    { key: 'flood',    label: 'Flood',     color: '#3FA9F5' },
    { key: 'wind',     label: 'Wind',      color: '#7EC9FF' },
    { key: 'seismic',  label: 'Seismic',   color: '#FF6B6B' },
  ]
  const rows = PERILS.map((p) => {
    const c = EP_CURVES[p.key].find((r) => r.return_period === 100)
    return {
      label: p.label,
      saving: c?.saving ?? 0,
      baseline: c?.baseline_loss ?? 0,
      pct: c ? (c.saving / c.baseline_loss) * 100 : 0,
      color: p.color,
    }
  })
  return {
    backgroundColor: 'transparent',
    grid: { left: 90, right: 110, top: 20, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      formatter: (p: Array<{ axisValueLabel: string; data: number; dataIndex: number }>) => {
        const idx = p[0]?.dataIndex ?? 0
        const row = rows[idx]
        if (!row) return ''
        return `<b>${row.label}</b><br/>1-in-100yr baseline loss: $${row.baseline.toFixed(1)}B<br/>Sensor-tightened: $${(row.baseline - row.saving).toFixed(1)}B<br/>Saving: <b>$${row.saving.toFixed(1)}B</b> (${row.pct.toFixed(0)}%)`
      },
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#8A97B1', formatter: (v: number) => '$' + v + 'B' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    yAxis: {
      type: 'category', data: rows.map((r) => r.label),
      axisLabel: { color: '#8A97B1' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
    },
    series: [{
      type: 'bar',
      data: rows.map((r) => ({ value: r.saving, itemStyle: { color: r.color } })),
      barWidth: 18,
      label: {
        show: true, position: 'right',
        color: '#E6EDF7', fontSize: 11,
        formatter: (p: { dataIndex: number }) => {
          const r = rows[p.dataIndex]; if (!r) return ''
          return `$${r.saving.toFixed(1)}B  ·  −${r.pct.toFixed(0)}%`
        },
      },
    }],
  }
})

// ---------- Accumulation zones ---------------------------------------

function notifyExport() {
  globalThis.alert('CSV export — wire to /api/insurance/portfolio/export in production')
}

const accumZones = computed(() => {
  const map = new Map<string, { region: string; count: number; exposure: number }>()
  for (const p of policies) {
    if (p.risk_score < 70) continue
    const cur = map.get(p.region) ?? { region: p.region, count: 0, exposure: 0 }
    cur.count += 1
    cur.exposure += p.exposure_usd * 1e9
    map.set(p.region, cur)
  }
  return [...map.values()].sort((a, b) => b.exposure - a.exposure).slice(0, 6)
})
</script>

<template>
  <div>
    <InsuranceTabStrip />

    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header class="flex items-start justify-between gap-3 mb-5">
        <div>
          <p class="text-ink-muted text-xs tracking-widest uppercase">Module · Portfolio</p>
          <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
            Portfolio risk aggregation
          </h1>
          <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-2xl">
            Distribution, exposure-vs-risk pricing scatter, peril ×
            region concentration, and accumulation zones — the views a
            reinsurer reads first to find the 3% that drives 50% of CAT.
          </p>
        </div>
        <DemoBadge class="hidden sm:inline-flex" />
      </header>

      <!-- KPIs -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
        <div class="rounded-2xl border border-white/5 bg-surface-1 p-3 sm:p-4">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Total exposure</p>
          <p class="num text-2xl font-semibold text-ink-primary mt-1">{{ fmtUsd(totalExposure) }}</p>
        </div>
        <div class="rounded-2xl border border-danger/30 bg-danger/[0.05] p-3 sm:p-4">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">% high-risk</p>
          <p class="num text-2xl font-semibold text-danger mt-1">
            {{ (highRiskFrac.pctOfPolicies * 100).toFixed(1) }}%
          </p>
          <p class="text-[10px] text-ink-muted/70 num mt-0.5">
            drives <span class="text-ink-muted">{{ (highRiskFrac.pctOfExposure * 100).toFixed(0) }}%</span> of exposure
          </p>
        </div>
        <div class="rounded-2xl border border-caution/30 bg-caution/[0.05] p-3 sm:p-4">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">% mispriced</p>
          <p class="num text-2xl font-semibold text-caution mt-1">
            {{ ((mispriced.underPct + mispriced.overPct) * 100).toFixed(0) }}%
          </p>
          <p class="text-[10px] text-ink-muted/70 mt-0.5">
            <span class="text-danger">{{ (mispriced.underPct * 100).toFixed(0) }}%</span> under /
            <span class="text-safe">{{ (mispriced.overPct * 100).toFixed(0) }}%</span> over
          </p>
        </div>
        <div class="rounded-2xl border border-accent/30 bg-accent/[0.05] p-3 sm:p-4">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Reserve adj.</p>
          <p class="num text-2xl font-semibold text-accent mt-1">+{{ fmtUsd(reserveAdjust) }}</p>
          <p class="text-[10px] text-ink-muted/70 mt-0.5">recommended</p>
        </div>
      </div>

      <Card padded class="mb-3">
        <MetricInfoPanel id="portfolio.kpi-strip" standalone />
      </Card>

      <!-- 80/20 callout -->
      <Card padded class="border-accent/30 bg-accent/[0.04] mb-3">
        <div class="flex items-start gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
               class="w-5 h-5 text-accent shrink-0 mt-0.5">
            <path d="M3 3v18h18M7 14l4-4 4 4 5-7"/>
          </svg>
          <p class="text-sm text-ink-primary">
            <span class="num text-accent">{{ (highRiskFrac.pctOfPolicies * 100).toFixed(1) }}%</span>
            of your portfolio accounts for
            <span class="num text-accent">{{ (highRiskFrac.pctOfExposure * 100).toFixed(0) }}%</span>
            of modeled CAT exposure
            (<span class="num">{{ fmtUsd(highRiskFrac.exposure) }}</span>).
            That's where to focus pricing-model improvements first.
          </p>
        </div>
        <MetricInfoPanel id="portfolio.eighty-twenty" />
      </Card>

      <!-- Distribution chart -->
      <Card padded>
        <h2 class="text-base font-semibold text-ink-primary mb-1">Risk distribution</h2>
        <p class="text-ink-muted text-xs mb-2">Policy count (bars) and aggregated exposure (line) per risk-score bucket.</p>
        <VChart :option="distOption" autoresize style="height: 300px;" />
        <MetricInfoPanel id="portfolio.distribution" />
      </Card>

      <!-- Scatter + heatmap row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
        <Card padded>
          <h2 class="text-base font-semibold text-ink-primary mb-1">Pricing accuracy</h2>
          <p class="text-ink-muted text-xs mb-2">Each dot is a policy. Red = underpriced (cluster up-and-right reveals the repricing opportunity).</p>
          <VChart :option="scatterOption" autoresize style="height: 320px;" />
          <MetricInfoPanel id="portfolio.pricing-scatter" />
        </Card>

        <Card padded>
          <h2 class="text-base font-semibold text-ink-primary mb-1">Peril × region concentration</h2>
          <p class="text-ink-muted text-xs mb-2">Cell shading = $B exposure where this region carries this peril.</p>
          <VChart :option="heatmapOption" autoresize style="height: 360px;" />
          <MetricInfoPanel id="portfolio.heatmap" />
        </Card>
      </div>

      <!-- Underpricing-gap callout + fairness scatter — the money chart -->
      <Card padded class="mt-3 border-danger/30 bg-danger/[0.03]">
        <div class="flex items-start gap-3 mb-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
               class="w-5 h-5 text-danger shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>
          </svg>
          <div class="flex-1">
            <h2 class="text-base font-semibold text-ink-primary">
              Underpricing gap visible right now:
              <span class="text-danger num">{{ fmtUsd(totalUnderpricingGap) }}/yr</span>
            </h2>
            <p class="text-ink-muted text-sm mt-1">
              Sum of (fair premium − actual premium) across underpriced
              policies. The dashed diagonal below is the fair-pricing
              line (premium = EAL × 1.5, an industry-typical combined-
              ratio target). Red dots below the line are the dollars
              currently uncompensated. DataSnake's tighter EAL is what
              makes this gap visible — without sensor-grade priors the
              EAL itself wobbles enough that underpricing hides inside
              the noise.
            </p>
          </div>
        </div>
        <VChart :option="fairnessOption" autoresize style="height: 360px;" />
        <MetricInfoPanel id="portfolio.fairness-scatter" />
      </Card>

      <!-- Per-peril savings at 1-in-100yr -->
      <Card padded class="mt-3">
        <h2 class="text-base font-semibold text-ink-primary mb-1">
          Where the savings concentrate — by peril, at 1-in-100yr
        </h2>
        <p class="text-ink-muted text-sm mb-3">
          DataSnake's sensor priors tighten the modeled-loss tail
          differently per peril. Flood + wind dominate dollar-for-
          dollar; seismic adds a smaller absolute tightening but with
          higher % impact in seismic-exposed portfolios. Combined view
          is what reinsurance accumulators care about.
        </p>
        <VChart :option="perilSavingsOption" autoresize style="height: 220px;" />
        <MetricInfoPanel id="portfolio.peril-savings" />
      </Card>

      <!-- Accumulation zones -->
      <Card padded class="mt-3">
        <div class="flex items-baseline justify-between mb-2">
          <h2 class="text-base font-semibold text-ink-primary">Accumulation zones (high-risk)</h2>
          <button
            class="text-xs text-accent hover:underline"
            @click="notifyExport"
          >Export CSV</button>
        </div>
        <ul class="divide-y divide-white/5 text-sm">
          <li v-for="z in accumZones" :key="z.region" class="py-2 flex items-baseline justify-between gap-3">
            <span class="text-ink-primary">{{ z.region }}</span>
            <div class="flex items-baseline gap-4 text-xs text-ink-muted">
              <span><span class="num text-ink-primary">{{ z.count }}</span> policies</span>
              <span><span class="num text-ink-primary">{{ fmtUsd(z.exposure) }}</span> exposure</span>
            </div>
          </li>
        </ul>
        <MetricInfoPanel id="portfolio.accumulation-zones" />
      </Card>

      <p class="text-ink-muted/60 text-xs mt-5 max-w-3xl">
        <strong class="text-ink-muted">Production wiring:</strong>
        Replace the mock policies with a query against your TPA's
        policy schema (<code>policy_id, region, exposure_usd,
        risk_score</code>). The pricing-error classification is a
        rolling Z-score against the regional median; tune the
        ±25% band to your underwriting tolerance.
      </p>
    </div>
  </div>
</template>
