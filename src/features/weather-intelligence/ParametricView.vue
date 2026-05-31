<script setup lang="ts">
// TerraWatch — Phase 9.18.0: Parametric Trigger back-tester (foundation).
//
// Phase 9.18.0 ships the page + the parameterized SQL panel + the
// "you can run this today against live NDBC data" anchor. Phase
// 9.18.3 ships the interactive form (pick sensor + threshold +
// payout, see the chart) + a real back-test simulator UI.

import { ref } from 'vue'
import WeatherIntelligenceTabStrip from './components/WeatherIntelligenceTabStrip.vue'
import WIMetricInfoPanel from './components/WIMetricInfoPanel.vue'
import SqlInterpretationPanel from './components/SqlInterpretationPanel.vue'
import Card from '@/ui/Card.vue'
import { useMeta } from '@/composables/useMeta'

useMeta(() => ({
  title:       'Parametric Trigger — Weather Intelligence',
  description: 'Pick a sensor, parameter, threshold, and payout. Back-test against the live NDBC catalog before launching a real contract.',
}))

// Interactive: the user can edit the parameters and see the
// interpolated SQL change. The actual back-test fetch lands in
// Phase 9.18.3 — for 9.18.0 we just show the literal query that
// would run.
const sensorId  = ref('ndbc:41009')
const parameter = ref('wave_height_m')
const threshold = ref(5.0)
const hours     = ref(8760)        // last 365 days

const backtestSql = `select
  observed_at,
  value as reading,
  $4 as threshold,
  case when value >= $4 then 1 else 0 end as triggered
from public.measurements
where sensor_id  = $1
  and parameter  = $2
  and observed_at >= now() - interval '$3 hours'
order by observed_at asc;`

const summarySql = `select
  count(*) filter (where value >= $4) as trigger_crossings,
  count(*)                            as samples,
  min(observed_at)                    as earliest,
  max(observed_at)                    as latest
from public.measurements
where sensor_id  = $1
  and parameter  = $2
  and observed_at >= now() - interval '$3 hours';`
</script>

<template>
  <div>
    <WeatherIntelligenceTabStrip />

    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <header>
        <p class="text-ink-muted text-xs tracking-widest uppercase">Use case 3 · Parametric Trigger</p>
        <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
          Back-test your parametric trigger before you launch it
        </h1>
        <p class="text-ink-muted text-sm sm:text-base mt-3 max-w-3xl leading-relaxed">
          Pick a sensor (any of 1,500+ NDBC buoys we already ingest
          hourly), pick a parameter (wave height, wind speed,
          pressure, etc.), pick a threshold, pick a payout. The
          query below counts how many times the threshold would
          have crossed in the chosen window. Run it. If your trigger
          would have fired 100× in the last year at $250K each,
          design the contract accordingly.
        </p>
        <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-3xl leading-relaxed">
          This is the parametric product design workshop. Phase
          9.15 (queued) ships the real-time fire engine. This page
          ships the back-tester.
        </p>
      </header>

      <!-- Parameter form — visible state, SQL panel updates inline -->
      <Card padded>
        <h3 class="text-base font-semibold text-ink-primary mb-3">Trigger parameters</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label class="block">
            <span class="text-[10px] uppercase tracking-widest text-ink-muted/60">Sensor</span>
            <input
              v-model="sensorId"
              type="text"
              class="mt-1 w-full bg-surface-0 border border-white/10 rounded-lg h-10 px-3 text-sm text-ink-primary font-mono"
            />
          </label>
          <label class="block">
            <span class="text-[10px] uppercase tracking-widest text-ink-muted/60">Parameter</span>
            <input
              v-model="parameter"
              type="text"
              class="mt-1 w-full bg-surface-0 border border-white/10 rounded-lg h-10 px-3 text-sm text-ink-primary font-mono"
            />
          </label>
          <label class="block">
            <span class="text-[10px] uppercase tracking-widest text-ink-muted/60">Threshold</span>
            <input
              v-model.number="threshold"
              type="number"
              step="0.1"
              class="mt-1 w-full bg-surface-0 border border-white/10 rounded-lg h-10 px-3 text-sm text-ink-primary num"
            />
          </label>
          <label class="block">
            <span class="text-[10px] uppercase tracking-widest text-ink-muted/60">Window (hours)</span>
            <input
              v-model.number="hours"
              type="number"
              step="24"
              class="mt-1 w-full bg-surface-0 border border-white/10 rounded-lg h-10 px-3 text-sm text-ink-primary num"
            />
          </label>
        </div>
        <p class="text-ink-muted text-xs mt-3">
          Edit any field and the two SQL panels below update with
          your literal values. Phase 9.18.3 will run them
          automatically and chart the result.
        </p>
      </Card>

      <!-- The summary query -->
      <Card padded>
        <h3 class="text-base font-semibold text-ink-primary mb-2">Trigger summary — how many crossings?</h3>
        <SqlInterpretationPanel
          :query="summarySql"
          :params="[sensorId, parameter, hours, threshold]"
          source="public.measurements — populated by ingest-ndbc Edge Function (Phase 9.6). Hourly cron, 1,500+ NDBC stations."
          caption="Run this against your own Supabase. trigger_crossings ÷ samples × 100 = how often a contract at this threshold would fire."
        />
      </Card>

      <!-- The time-series query for the chart -->
      <Card padded>
        <h3 class="text-base font-semibold text-ink-primary mb-2">Time series — the chart (lands in Phase 9.18.3)</h3>
        <SqlInterpretationPanel
          :query="backtestSql"
          :params="[sensorId, parameter, hours, threshold]"
          source="Same source as above. Phase 9.18.3 wires this into a real chart with the threshold overlaid + crossings highlighted."
        />
      </Card>

      <Card padded>
        <WIMetricInfoPanel id="parametric.use-case" standalone />
      </Card>
    </div>
  </div>
</template>
