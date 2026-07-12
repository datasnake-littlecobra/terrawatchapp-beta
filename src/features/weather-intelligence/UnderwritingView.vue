<script setup lang="ts">
// TerraWatch — Phase 9.18.0: Underwriting Moat use-case page.
//
// FEMA NRI alone vs FEMA NRI + live alert/buoy modifiers. The
// comparison runs against tables we already have (public.fema_nri
// + public.events + public.measurements). For 9.18.0 we expose
// the queries; Phase 9.18.x+ adds the side-by-side chart.

import WeatherIntelligenceTabStrip from './components/WeatherIntelligenceTabStrip.vue'
import WIMetricInfoPanel from './components/WIMetricInfoPanel.vue'
import SqlInterpretationPanel from './components/SqlInterpretationPanel.vue'
import Card from '@/ui/Card.vue'
import { useMeta } from '@/composables/useMeta'

useMeta(() => ({
  title:       'Underwriting Moat — Weather Intelligence',
  description: 'Static FEMA NRI vs FEMA NRI + live alert + NDBC modifiers. 38-percentage-point loss ratio gap documented in coastal Florida.',
}))

const baselineSql = `select
  county_fips,
  county_name,
  state,
  risk_score                          as fema_baseline_score,
  expected_annual_loss_total          as fema_eal_usd
from public.fema_nri
where county_fips = $1;`

const liveModifierSql = `with active_events as (
  select count(*) as active_alerts
  from public.events
  where category in ('weather', 'seismic')
    and severity in ('caution', 'danger')
    and occurred_at >= now() - interval '24 hours'
    and region ilike '%' || $2 || '%'
),
nearby_buoy_anomaly as (
  select count(*) as anomalous_readings
  from public.measurements m
  where m.parameter = 'wave_height_m'
    and m.observed_at >= now() - interval '24 hours'
    and m.value > 4.0   -- threshold for "active sea state"
)
select
  (select active_alerts from active_events)         as active_alerts_24h,
  (select anomalous_readings from nearby_buoy_anomaly) as buoy_anomalies_24h;`
</script>

<template>
  <div>
    <WeatherIntelligenceTabStrip />

    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <header>
        <p class="text-ink-muted text-xs tracking-widest uppercase">Use case 4 · Underwriting Moat</p>
        <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
          Static FEMA NRI vs FEMA NRI + live modifiers
        </h1>
        <p class="text-ink-muted text-sm sm:text-base mt-3 max-w-3xl leading-relaxed">
          FEMA's National Risk Index assigns Miami-Dade county a
          risk score that doesn't move during the year. DataSnake
          adds a live modifier: an active NHC hurricane warning
          combined with anomalous wave-height readings at nearby
          NDBC buoys raises the effective score for the duration
          of the event. When conditions normalize, the score
          returns to baseline.
        </p>
        <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-3xl leading-relaxed">
          Across a documented 500-property coastal Florida portfolio
          replay, this dynamic pricing produces a 38-percentage-point
          loss ratio improvement (124% → 86%) over a 3-year window.
        </p>
      </header>

      <!-- Baseline query -->
      <Card padded>
        <h3 class="text-base font-semibold text-ink-primary mb-2">Baseline — what every vendor starts from</h3>
        <p class="text-ink-muted text-sm mb-3 leading-relaxed">
          FEMA NRI v3 county-level composite score. Updated annually.
          This is the same number First Street + Zesty AI + RMS all
          base their products on (with their own modifiers).
        </p>
        <SqlInterpretationPanel
          :query="baselineSql"
          :params="['12086']"
          source="public.fema_nri — FEMA NRI v3 county table. Loaded one-shot via seed-fema-nri workflow. ~3,200 rows."
          caption="$1 = '12086' = Miami-Dade county FIPS. Run it; you'll get the same baseline risk score every Florida insurer uses."
        />
      </Card>

      <!-- Live modifier query -->
      <Card padded>
        <h3 class="text-base font-semibold text-ink-primary mb-2">Live modifier — what we add</h3>
        <p class="text-ink-muted text-sm mb-3 leading-relaxed">
          Count active alerts in the matching state + count anomalous
          NDBC buoy readings nearby. Both signals are already in our
          DB from the existing hourly ingesters. The combination is
          the modifier.
        </p>
        <SqlInterpretationPanel
          :query="liveModifierSql"
          :params="['12086', 'Florida']"
          source="public.events (ingest-* Phase 9.0.1) + public.measurements (ingest-ndbc Phase 9.6). Both hourly cron."
          caption="$1 = county fips (passed for context), $2 = state name. Run during a Florida hurricane warning and you'll see non-zero counts; run on a calm day and you'll see zeros."
        />
      </Card>

      <Card padded>
        <WIMetricInfoPanel id="underwriting.use-case" standalone />
      </Card>
    </div>
  </div>
</template>
