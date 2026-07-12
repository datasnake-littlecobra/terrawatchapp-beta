<script setup lang="ts">
// TerraWatch — Phase 9.18.0: Claims Validation use-case page.
//
// Hurricane Ian (Sept 2022) replay. Phase 9.18.4 loads the
// IBTrACS + NOAA reanalysis bulk historical data. For now the
// page tells the story + shows the verdict-logic SQL pattern
// against existing events data.

import WeatherIntelligenceTabStrip from './components/WeatherIntelligenceTabStrip.vue'
import WIMetricInfoPanel from './components/WIMetricInfoPanel.vue'
import SqlInterpretationPanel from './components/SqlInterpretationPanel.vue'
import Card from '@/ui/Card.vue'
import { useMeta } from '@/composables/useMeta'

useMeta(() => ({
  title:       'Claims Validation — Weather Intelligence',
  description: 'Hurricane Ian (Sept 2022) replay: reconstruct what sensors recorded at the claim location. 2-hour verdict vs 7-14 day manual inspection.',
}))

const verdictSql = `with sensor_readings_at_event as (
  -- Phase 9.18.4 will load NOAA IBTrACS + reanalysis into
  -- public.hurricane_readings. For now we sketch the join contract.
  select
    max(peak_wind_mph)              as peak_wind_mph,
    sum(case when wind_mph > 50 then 1 else 0 end) as hours_above_50mph,
    max(pressure_drop_hpa)          as pressure_drop_hpa,
    sum(precip_inches_per_hour)     as precipitation_inches_24h
  from public.hurricane_readings
  where event_id    = $1
    and lat between $2 - 0.05 and $2 + 0.05
    and lon between $3 - 0.05 and $3 + 0.05
    and observed_at between $4::timestamptz - interval '12 hours'
                       and $4::timestamptz + interval '36 hours'
)
select
  *,
  case
    when peak_wind_mph >= 60 then true else false
  end                                     as roof_damage_threshold,
  case
    when peak_wind_mph >= 50 and precipitation_inches_24h >= 4
      then true else false
  end                                     as water_intrusion_threshold,
  case
    when hours_above_50mph >= 2 then true else false
  end                                     as duration_penalty
from sensor_readings_at_event;`
</script>

<template>
  <div>
    <WeatherIntelligenceTabStrip />

    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <header>
        <p class="text-ink-muted text-xs tracking-widest uppercase">Use case 5 · Claims Validation</p>
        <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
          Hurricane Ian, Naples FL — verify a $250K claim in 2 hours
        </h1>
        <p class="text-ink-muted text-sm sm:text-base mt-3 max-w-3xl leading-relaxed">
          A claim arrives: $250K roof + water intrusion damage,
          claimed cause "80 mph winds from Hurricane Ian." A claims
          adjuster needs to verify. The traditional path is 7-14
          days and $500-1500 per inspection. DataSnake reconstructs
          what NOAA + nearby sensors recorded at the property
          location during the storm window. If the readings match
          the claim, verdict LEGITIMATE in 2 hours. If they don't,
          flag for human review.
        </p>
        <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-3xl leading-relaxed">
          Phase 9.18.4 loads NOAA IBTrACS + reanalysis into a
          public.hurricane_readings table. The verdict-logic SQL
          below is the production query — same shape, real data.
        </p>
      </header>

      <Card padded class="border-caution/30 bg-caution/[0.04]">
        <p class="text-caution text-sm font-semibold">⏳ Phase 9.18.4 lands the historical IBTrACS load</p>
        <p class="text-ink-muted text-sm mt-2 leading-relaxed">
          The verdict UI (form: claim ID + property lat/lon + event
          → instant verdict) needs the NOAA IBTrACS bulk-load.
          That's a one-shot historical migration (Hurricane Ian +
          5-7 other major events). Once shipped, this page becomes
          an interactive verdict tool.
        </p>
      </Card>

      <!-- Show the production verdict SQL -->
      <Card padded>
        <h3 class="text-base font-semibold text-ink-primary mb-2">
          The verdict query — visible architecture today
        </h3>
        <p class="text-ink-muted text-sm mb-3 leading-relaxed">
          For a claim at Naples FL (25.5, -81.2) during Hurricane
          Ian (event_id='IAN_2022_09'), the production verdict
          computes the three damage thresholds (roof / water
          intrusion / duration) from reconstructed sensor readings
          at the property location during the storm window. If the
          claim's described cause is consistent with sensor readings
          AND damage thresholds are met → LEGITIMATE. Otherwise →
          INVESTIGATE.
        </p>
        <SqlInterpretationPanel
          :query="verdictSql"
          :params="['IAN_2022_09', 25.5, -81.2, '2022-09-28T18:00:00Z']"
          source="public.hurricane_readings — populated by ingest-ibtracs (Phase 9.18.4) + ingest-noaa-reanalysis (Phase 9.18.4)."
        />
      </Card>

      <Card padded>
        <WIMetricInfoPanel id="claims.use-case" standalone />
      </Card>
    </div>
  </div>
</template>
