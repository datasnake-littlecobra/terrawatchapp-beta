<script setup lang="ts">
// TerraWatch / DataSnake — Module 1: Location Risk Verdict.
//
// "Enter a property address, get a risk score + premium recommendation
// in <3 seconds." This is the demo centerpiece — the panel a partner
// underwriter sees first.
//
// Demo data only this turn. The API contract is the RiskVerdict shape
// in src/data/insurance-mock.ts; swapping in live data is a single
// service-call change.

import { computed, ref } from 'vue'
import Card from '@/ui/Card.vue'
import InsuranceTabStrip from './components/InsuranceTabStrip.vue'
import DemoBadge from './components/DemoBadge.vue'
import RiskMeter from './components/RiskMeter.vue'
import PerilBars from './components/PerilBars.vue'
import MetricInfoPanel from './components/MetricInfoPanel.vue'
import { useMeta } from '@/composables/useMeta'
import { RISK_VERDICTS, type RiskVerdict } from '@/data/insurance-mock'

useMeta(() => ({
  title:       'Risk Verdict — Insurance Intelligence',
  description: 'Enter a property location, get a DataSnake risk score, premium multiplier, and the sensor-driven reasons behind it — built for underwriters and reinsurers.',
}))

const query = ref('')
const selected = ref<RiskVerdict>(RISK_VERDICTS[0]!)

const matches = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return RISK_VERDICTS
  return RISK_VERDICTS.filter((v) => v.location.toLowerCase().includes(q))
})

function pick(v: RiskVerdict) {
  selected.value = v
  query.value = ''
}

const verdictTone = computed(() => {
  const s = selected.value.risk_score
  if (s >= 70) return 'danger'
  if (s >= 40) return 'caution'
  return 'safe'
})

const lastUpdatedRel = computed(() => {
  const d = new Date(selected.value.last_updated)
  const ms = Date.now() - d.getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
})
</script>

<template>
  <div>
    <InsuranceTabStrip />

    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header class="flex items-start justify-between gap-3 mb-5">
        <div>
          <p class="text-ink-muted text-xs tracking-widest uppercase">Module · Risk Verdict</p>
          <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
            Address-level underwriting verdict
          </h1>
          <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-2xl">
            Type a city or property address. The DataSnake fleet returns a
            composite risk score, a premium multiplier, and the specific
            sensor readings that drove the recommendation — the same data
            that would feed your AAL calculation.
          </p>
        </div>
        <DemoBadge class="hidden sm:inline-flex" />
      </header>

      <!-- Search box -->
      <div class="relative mb-6">
        <input
          v-model="query"
          type="text"
          placeholder="e.g. Miami Beach, San Francisco, Houston…"
          class="w-full rounded-xl border border-white/10 bg-surface-1 px-4 py-3 text-ink-primary placeholder:text-ink-muted/60 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/40"
          aria-label="Search for a location"
        />
        <ul
          v-if="query.trim().length"
          class="absolute z-10 mt-1 w-full max-h-72 overflow-auto rounded-xl border border-white/10 bg-surface-1 shadow-xl divide-y divide-white/5"
        >
          <li v-if="!matches.length" class="px-4 py-3 text-ink-muted text-sm">
            No matching demo location — try Miami, Houston, or San Francisco.
          </li>
          <li v-for="m in matches" :key="m.location">
            <button
              class="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center justify-between gap-3"
              @click="pick(m)"
            >
              <span class="text-ink-primary">{{ m.location }}</span>
              <span class="num text-xs text-ink-muted">{{ m.risk_score }}/100</span>
            </button>
          </li>
        </ul>
      </div>

      <!-- Verdict layout -->
      <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <!-- Left: meter + verdict -->
        <Card padded>
          <div class="flex flex-col items-center text-center">
            <RiskMeter :score="selected.risk_score" :sublabel="selected.risk_label" />
            <p class="text-[10px] uppercase tracking-widest text-ink-muted/60 mt-4">{{ selected.location }}</p>
            <p
              class="text-sm font-semibold mt-1.5"
              :class="{
                'text-danger':  verdictTone === 'danger',
                'text-caution': verdictTone === 'caution',
                'text-safe':    verdictTone === 'safe',
              }"
            >{{ selected.verdict }}</p>
          </div>

          <div class="grid grid-cols-2 gap-2 mt-5">
            <div class="rounded-lg border border-white/5 bg-surface-0/60 p-3 text-center">
              <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Premium ×</p>
              <p class="num text-xl font-semibold text-ink-primary mt-0.5">{{ selected.premium_multiplier.toFixed(1) }}×</p>
            </div>
            <div class="rounded-lg border border-white/5 bg-surface-0/60 p-3 text-center">
              <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">AAL ×</p>
              <p class="num text-xl font-semibold text-ink-primary mt-0.5">{{ selected.aal_multiplier.toFixed(1) }}×</p>
            </div>
          </div>

          <p class="text-[10px] uppercase tracking-widest text-ink-muted/60 mt-5">Confidence</p>
          <div class="h-1.5 rounded-full bg-white/5 overflow-hidden mt-1">
            <div
              class="h-full bg-accent"
              :style="{ width: `${(selected.confidence * 100).toFixed(0)}%` }"
            />
          </div>
          <p class="num text-xs text-ink-muted mt-1">
            {{ (selected.confidence * 100).toFixed(0) }}% · refreshed {{ lastUpdatedRel }}
          </p>
          <MetricInfoPanel id="verdict.risk-meter" />
        </Card>

        <!-- Right: detail -->
        <Card padded>
          <p class="text-ink-primary text-sm leading-relaxed">{{ selected.verdict_detail }}</p>

          <!-- Peril bars -->
          <h3 class="text-sm font-semibold text-ink-primary mt-5 mb-2">Peril breakdown</h3>
          <PerilBars :perils="selected.perils" />

          <!-- Key factors -->
          <h3 class="text-sm font-semibold text-ink-primary mt-5 mb-2">Sensor-driven factors</h3>
          <ul class="text-sm text-ink-muted space-y-1.5">
            <li v-for="(f, i) in selected.key_factors" :key="i" class="flex gap-2">
              <span class="text-accent mt-0.5">→</span>
              <span class="leading-relaxed">{{ f }}</span>
            </li>
          </ul>

          <!-- Data sources -->
          <h3 class="text-sm font-semibold text-ink-primary mt-5 mb-2">Data sources</h3>
          <ul class="flex flex-wrap gap-1.5">
            <li
              v-for="s in selected.data_sources"
              :key="s"
              class="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-white/10 text-ink-muted bg-white/[0.02]"
            >{{ s }}</li>
          </ul>
          <MetricInfoPanel id="verdict.detail" />
        </Card>
      </div>

      <!-- Educational footnote -->
      <p class="text-ink-muted/60 text-xs mt-6 max-w-3xl">
        <strong class="text-ink-muted">How to read this:</strong>
        Risk score is a 0-100 composite. Premium multiplier × baseline
        gives the recommended underwriting price; AAL multiplier × the
        portfolio's modeled annual loss gives the reserve adjustment.
        Each "sensor-driven factor" cites the DataSnake node that
        contributed — auditable for re-pricing committee defensibility.
      </p>
    </div>
  </div>
</template>
