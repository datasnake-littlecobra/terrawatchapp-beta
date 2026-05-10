<script setup lang="ts">
// TerraWatch / DataSnake — Module 4: Parametric Trigger Monitor.
//
// Real-time view of active parametric insurance contracts and their
// underlying sensor readings vs threshold. The product an insurer would
// pay for directly: certified, timestamped, audit-logged sensor data
// for parametric trigger validation.

import { computed, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import Card from '@/ui/Card.vue'
import InsuranceTabStrip from './components/InsuranceTabStrip.vue'
import DemoBadge from './components/DemoBadge.vue'
import MetricInfoPanel from './components/MetricInfoPanel.vue'
import { useMeta } from '@/composables/useMeta'
import {
  PARAMETRIC_CONTRACTS,
  fmtUsd,
  statusColor,
  type ParametricContract,
  type ContractStatus,
} from '@/data/insurance-mock'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

useMeta(() => ({
  title:       'Parametric Trigger Monitor — Insurance Intelligence',
  description: 'Live sensor readings vs parametric contract thresholds. Certified, timestamped, audit-logged data for parametric payout defensibility.',
}))

const filter = ref<ContractStatus | 'ALL'>('ALL')

const STATUS_OPTIONS: Array<{ key: ContractStatus | 'ALL'; label: string }> = [
  { key: 'ALL',        label: 'All' },
  { key: 'TRIGGERED',  label: 'Triggered' },
  { key: 'WARNING',    label: 'Warning' },
  { key: 'MONITORING', label: 'Monitoring' },
  { key: 'CLEAR',      label: 'Clear' },
]

const visibleContracts = computed(() =>
  filter.value === 'ALL'
    ? PARAMETRIC_CONTRACTS
    : PARAMETRIC_CONTRACTS.filter((c) => c.status === filter.value),
)

const counts = computed(() => {
  const c = { TRIGGERED: 0, WARNING: 0, MONITORING: 0, CLEAR: 0 } as Record<ContractStatus, number>
  for (const x of PARAMETRIC_CONTRACTS) c[x.status]++
  return c
})

const totalAtRisk = computed(() =>
  PARAMETRIC_CONTRACTS
    .filter((c) => c.status === 'TRIGGERED' || c.status === 'WARNING')
    .reduce((s, c) => s + c.payout_amount, 0),
)

function progress(c: ParametricContract): number {
  return Math.max(0, Math.min(100, (c.current_reading / c.threshold_num) * 100))
}

function sparkOption(c: ParametricContract) {
  const sevColor = statusColor(c.status)
  const data = c.readings_24h
  return {
    backgroundColor: 'transparent',
    grid: { left: 0, right: 0, top: 4, bottom: 4 },
    tooltip: {
      trigger: 'axis',
      formatter: (p: Array<{ data: number; dataIndex: number }>) => {
        const point = p[0]
        if (!point) return ''
        const hoursAgo = data.length - 1 - point.dataIndex
        return `${hoursAgo === 0 ? 'now' : hoursAgo + 'h ago'}<br/><b>${point.data.toFixed(2)}</b> ${c.reading_unit}`
      },
    },
    xAxis: { type: 'category', show: false, data: data.map((_, i) => i) },
    yAxis: { type: 'value', show: false, scale: true },
    series: [{
      type: 'line', data,
      symbol: 'none',
      smooth: true,
      lineStyle: { color: sevColor, width: 1.5 },
      areaStyle: { color: sevColor, opacity: 0.15 },
      markLine: {
        silent: true,
        symbol: 'none',
        label: { show: false },
        lineStyle: { color: '#FF6B6B', type: 'dashed', width: 1, opacity: 0.6 },
        data: [{ yAxis: c.threshold_num }],
      },
    }],
  }
}
</script>

<template>
  <div>
    <InsuranceTabStrip />

    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header class="flex items-start justify-between gap-3 mb-5">
        <div>
          <p class="text-ink-muted text-xs tracking-widest uppercase">Module · Parametric</p>
          <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
            Parametric trigger monitor
          </h1>
          <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-2xl">
            Active parametric contracts mapped to live DataSnake sensor
            readings. Every datapoint is timestamped, cryptographically
            signed, and audit-logged for claims defensibility.
          </p>
        </div>
        <DemoBadge class="hidden sm:inline-flex" />
      </header>

      <!-- Hero strip -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
        <div class="rounded-2xl border border-danger/30 bg-danger/[0.05] p-3 sm:p-4">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Triggered</p>
          <p class="num text-2xl font-semibold text-danger mt-1">{{ counts.TRIGGERED }}</p>
        </div>
        <div class="rounded-2xl border border-caution/30 bg-caution/[0.05] p-3 sm:p-4">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Warning</p>
          <p class="num text-2xl font-semibold text-caution mt-1">{{ counts.WARNING }}</p>
        </div>
        <div class="rounded-2xl border border-accent/30 bg-accent/[0.05] p-3 sm:p-4">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Monitoring</p>
          <p class="num text-2xl font-semibold text-accent mt-1">{{ counts.MONITORING }}</p>
        </div>
        <div class="rounded-2xl border border-white/5 bg-surface-1 p-3 sm:p-4">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Payout at risk</p>
          <p class="num text-2xl font-semibold text-ink-primary mt-1">{{ fmtUsd(totalAtRisk) }}</p>
        </div>
      </div>

      <Card padded class="mb-5">
        <MetricInfoPanel id="parametric.kpi-strip" standalone />
      </Card>

      <!-- Status filter chips -->
      <div class="flex flex-wrap gap-1.5 mb-4">
        <button
          v-for="o in STATUS_OPTIONS"
          :key="o.key"
          class="text-xs px-3 py-1.5 rounded-full border transition-colors"
          :class="filter === o.key
            ? 'border-accent bg-accent/15 text-accent'
            : 'border-white/10 text-ink-muted hover:text-ink-primary hover:border-white/20'"
          @click="filter = o.key"
        >{{ o.label }}</button>
      </div>

      <!-- Contracts list -->
      <div class="space-y-3">
        <Card v-for="c in visibleContracts" :key="c.contract_id" padded>
          <div class="grid grid-cols-1 lg:grid-cols-[1fr_180px_140px] gap-4 items-start">
            <!-- Identity + threshold -->
            <div class="min-w-0">
              <div class="flex items-baseline justify-between gap-3 mb-1.5">
                <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">{{ c.contract_id }}</p>
                <span
                  class="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded"
                  :style="{
                    color: statusColor(c.status),
                    background: statusColor(c.status) + '20',
                    border: `1px solid ${statusColor(c.status)}66`,
                  }"
                >{{ c.status }}</span>
              </div>
              <h3 class="text-base font-semibold text-ink-primary truncate">
                {{ c.peril }} · {{ c.location }}
              </h3>
              <p class="text-ink-muted text-xs mt-0.5">
                {{ c.client }} · sensor <span class="num text-ink-muted">{{ c.sensor_id }}</span>
              </p>

              <div class="grid grid-cols-3 gap-2 mt-3">
                <div>
                  <p class="text-[10px] uppercase tracking-wider text-ink-muted/60">Threshold</p>
                  <p class="num text-sm text-ink-primary">{{ c.threshold }}</p>
                </div>
                <div>
                  <p class="text-[10px] uppercase tracking-wider text-ink-muted/60">Current</p>
                  <p class="num text-sm" :style="{ color: statusColor(c.status) }">
                    {{ c.current_reading }} {{ c.reading_unit }}
                  </p>
                </div>
                <div>
                  <p class="text-[10px] uppercase tracking-wider text-ink-muted/60">Payout</p>
                  <p class="num text-sm text-ink-primary">{{ fmtUsd(c.payout_amount) }}</p>
                </div>
              </div>

              <!-- Progress bar -->
              <div class="mt-3">
                <div class="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :style="{
                      width: progress(c) + '%',
                      background: statusColor(c.status),
                    }"
                  />
                </div>
                <p class="text-[10px] text-ink-muted/60 mt-1">
                  {{ progress(c).toFixed(0) }}% of trigger threshold
                </p>
              </div>
            </div>

            <!-- Sparkline -->
            <div>
              <p class="text-[10px] uppercase tracking-widest text-ink-muted/60 mb-1">Last 24h</p>
              <VChart :option="sparkOption(c)" autoresize style="height: 56px;" />
            </div>

            <!-- Audit -->
            <div>
              <p class="text-[10px] uppercase tracking-widest text-ink-muted/60 mb-1">Audit</p>
              <ul class="text-[11px] text-ink-muted space-y-0.5">
                <li class="flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-safe"></span>
                  signed
                </li>
                <li class="flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-safe"></span>
                  timestamped
                </li>
                <li class="flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-safe"></span>
                  log retained
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <Card padded class="mt-3">
        <MetricInfoPanel id="parametric.contract-rows" standalone />
      </Card>

      <!-- Compliance disclaimer -->
      <Card padded class="mt-5">
        <div class="flex items-start gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
               class="w-5 h-5 text-accent shrink-0 mt-0.5">
            <path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6Z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
          <div>
            <h3 class="text-sm font-semibold text-ink-primary">Certified data for parametric payouts</h3>
            <p class="text-ink-muted text-xs mt-1 leading-relaxed">
              All readings shown are timestamped, cryptographically signed
              by the sensor's hardware key, and retained for the contract
              term + statute-of-limitations window. DataSnake is the
              system-of-record for parametric trigger validation.
            </p>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>
