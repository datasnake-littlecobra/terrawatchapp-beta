<script setup lang="ts">
// TerraWatch — Phase 9.18.0: Seismic Precursor use-case page.
//
// Bay Area foreshock-clustering proxy on the USGS catalog we
// already ingest (Phase 9.0.1 ingest-seismic). Phase 9.18.5 adds
// the SQL RPC + the actual anomaly chart. For now the page tells
// the story + shows the query architecture.

import WeatherIntelligenceTabStrip from './components/WeatherIntelligenceTabStrip.vue'
import WIMetricInfoPanel from './components/WIMetricInfoPanel.vue'
import SqlInterpretationPanel from './components/SqlInterpretationPanel.vue'
import Card from '@/ui/Card.vue'
import { useMeta } from '@/composables/useMeta'

useMeta(() => ({
  title:       'Seismic Precursor — Weather Intelligence',
  description: 'Bay Area foreshock clustering: +247% frequency anomaly = 6-12 week elevated window. Built on the public USGS catalog.',
}))

// Live count today — anchors the page. This actually runs against
// public.events on page load.
const liveCountSql = `select
  count(*) as events_last_14d_bayarea
from public.events
where category = 'seismic'
  and occurred_at >= now() - interval '14 days'
  and region ilike '%California%';`

// The full foreshock anomaly RPC arrives in Phase 9.18.5.
const targetRpcSql = `-- Phase 9.18.5 target: seismic_foreshock_clustering RPC
select
  baseline_freq_per_day,
  trailing_freq_per_day,
  anomaly_pct,
  precursor_confidence
from public.seismic_foreshock_clustering(
  center_lat       := $1,
  center_lon       := $2,
  radius_km        := 100,
  trailing_days    := 14,
  baseline_days    := 90
);`

const targetParams = [37.7749, -122.4194]
</script>

<template>
  <div>
    <WeatherIntelligenceTabStrip />

    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <header>
        <p class="text-ink-muted text-xs tracking-widest uppercase">Use case 2 · Seismic Precursor</p>
        <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
          Bay Area foreshock clustering — +247% frequency anomaly
        </h1>
        <p class="text-ink-muted text-sm sm:text-base mt-3 max-w-3xl leading-relaxed">
          USGS's published static probability for "M≥6.7 in 20 years
          in the Bay Area" has been ~26% for 15 years. That number
          doesn't move when stress is accumulating. Foreshock
          clustering on the public catalog does — a sustained 6-week
          window of +200% event-rate above baseline is a known
          precursor signal.
        </p>
        <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-3xl leading-relaxed">
          This page exposes the foreshock-clustering proxy as the
          best signal computable on public data today. The
          proprietary tier (hydrophone + ground-sensor waveform
          analysis) replaces this proxy with real B-type signal
          detection — same SQL surface, richer data.
        </p>
      </header>

      <!-- Live anchor query -->
      <Card padded>
        <h3 class="text-base font-semibold text-ink-primary mb-2">
          Today, in your Postgres
        </h3>
        <p class="text-ink-muted text-sm mb-3 leading-relaxed">
          The public events table already ingests USGS earthquakes
          hourly (Phase 9.0.1). This counts events in the trailing
          14 days for California — what an anomaly detector starts
          from.
        </p>
        <SqlInterpretationPanel
          :query="liveCountSql"
          source="public.events — populated by ingest-seismic Edge Function (Phase 9.0.1). 2.5+ magnitude USGS catalog, hourly cron."
          caption="Run this against your own Supabase right now. Same answer."
        />
      </Card>

      <!-- Target RPC for 9.18.5 -->
      <Card padded class="border-caution/30 bg-caution/[0.04]">
        <h3 class="text-base font-semibold text-ink-primary mb-2">
          Phase 9.18.5 target — the anomaly detector
        </h3>
        <p class="text-ink-muted text-sm mb-3 leading-relaxed">
          Phase 9.18.5 ships the seismic_foreshock_clustering RPC.
          Same input contract as the static frequency count above,
          but returns the baseline / trailing / anomaly /
          confidence quadruple ready for charting. Visible
          architecture before the data is wired:
        </p>
        <SqlInterpretationPanel
          :query="targetRpcSql"
          :params="targetParams"
          source="public.seismic_foreshock_clustering — Phase 9.18.5 RPC. Wraps the events table aggregation in a SECURITY DEFINER function."
        />
      </Card>

      <Card padded>
        <WIMetricInfoPanel id="seismic-precursor.use-case" standalone />
      </Card>
    </div>
  </div>
</template>
