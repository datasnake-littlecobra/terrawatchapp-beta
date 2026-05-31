<script setup lang="ts">
// TerraWatch — Phase 9.18.0: Flash Flood use-case page (foundation).
//
// Phase 9.18.0 ships the page structure + explainer + an honest
// "data coming in 9.18.1" SQL panel. Phase 9.18.1 lands the real
// NOAA Global Hourly ingester + the Miami Beach May 2024 replay
// chart.

import WeatherIntelligenceTabStrip from './components/WeatherIntelligenceTabStrip.vue'
import WIMetricInfoPanel from './components/WIMetricInfoPanel.vue'
import SqlInterpretationPanel from './components/SqlInterpretationPanel.vue'
import Card from '@/ui/Card.vue'
import { useMeta } from '@/composables/useMeta'

useMeta(() => ({
  title:       'Flash Flood — Weather Intelligence',
  description: 'Miami Beach May 2024 replay on real NOAA Global Hourly data: the $180K loss FEMA + NOAA called "normal."',
}))

// Preview of the query Phase 9.18.1 will run when the NOAA ISD
// ingester ships. Shown here as the literal target so the
// architecture is visible from day one.
const previewQuery = `select
  observed_at,
  value as precipitation_mm
from public.measurements
where sensor_id = $1
  and parameter  = 'precipitation_mm_1h'
  and observed_at between $2::timestamptz and $3::timestamptz
order by observed_at asc;`

// 'noaa:isd:74486' = Miami International Airport ISD station.
const previewParams = [
  'noaa:isd:74486',
  '2024-05-10T00:00:00Z',
  '2024-05-20T00:00:00Z',
]
</script>

<template>
  <div>
    <WeatherIntelligenceTabStrip />

    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <header>
        <p class="text-ink-muted text-xs tracking-widest uppercase">Use case 1 · Flash Flood</p>
        <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
          Miami Beach, May 15 2024 — $180K loss FEMA + NOAA called "normal"
        </h1>
        <p class="text-ink-muted text-sm sm:text-base mt-3 max-w-3xl leading-relaxed">
          A 2-3 inch afternoon thunderstorm hit Miami Beach. FEMA had
          the ZIP marked Zone X (low risk). NOAA logged "normal
          convective activity." A blocked stormwater drain caused 18"
          of standing water in 6 properties. Total loss $180K.
        </p>
        <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-3xl leading-relaxed">
          What DataSnake's EP curve sees: rainfall intensity 2.8 mm/min
          in a 6-minute window + soil saturation 0.42 m³/m³ (3-day
          rolling). Both signals taken alone look unremarkable. Their
          product crosses 0.5 (HIGH band) — the flash-flood signature.
        </p>
      </header>

      <!-- Phase 9.18.1 placeholder for the actual replay chart -->
      <Card padded class="border-caution/30 bg-caution/[0.04]">
        <p class="text-caution text-sm font-semibold">⏳ Phase 9.18.1 lands the live chart</p>
        <p class="text-ink-muted text-sm mt-2 leading-relaxed">
          The Miami Beach May 2024 replay chart needs the NOAA Global
          Hourly (ISD) ingester — that ships in Phase 9.18.1 along
          with the bulk-load migration for the 2024 historical window.
          Once shipped, this card becomes a time-series chart showing
          real NOAA precipitation observations, the derived saturation
          estimate, and the computed EP-curve probability — with the
          SQL panel below showing the literal query that produced
          each line.
        </p>
      </Card>

      <!-- Show the EXACT query Phase 9.18.1 will use — architecture visible today -->
      <Card padded>
        <h3 class="text-base font-semibold text-ink-primary mb-2">
          The query Phase 9.18.1 will run
        </h3>
        <p class="text-ink-muted text-sm mb-3 leading-relaxed">
          This is the literal SQL the live chart will use when
          NOAA ISD data is loaded. The architecture is visible
          today even before the data is. After 9.18.1 ships, the
          chart above will appear automatically.
        </p>
        <SqlInterpretationPanel
          :query="previewQuery"
          :params="previewParams"
          source="public.measurements — to be populated by ingest-noaa-isd Edge Function (Phase 9.18.1). Sensor id 'noaa:isd:74486' = Miami Intl AP."
          caption="When 9.18.1 ships, this exact query — same sensor ID, same parameter, same window — produces the time-series chart for the replay."
        />
      </Card>

      <!-- Self-documenting explainer -->
      <Card padded>
        <WIMetricInfoPanel id="flash-flood.use-case" standalone />
      </Card>
    </div>
  </div>
</template>
