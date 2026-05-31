<script setup lang="ts">
// TerraWatch — Phase 9.18.0: /weather-intelligence landing.
//
// Public-facing entry point. Thesis at top, 5 use-case cards in the
// middle, competitor matrix at the bottom. Every chart-bearing
// page underneath this section carries the SqlInterpretationPanel
// — the visible artifact that differentiates DataSnake from First
// Street + Zesty AI's black-box scores.

import WeatherIntelligenceTabStrip from './components/WeatherIntelligenceTabStrip.vue'
import UseCaseCard from './components/UseCaseCard.vue'
import CompetitorMatrix from './components/CompetitorMatrix.vue'
import WIMetricInfoPanel from './components/WIMetricInfoPanel.vue'
import SqlInterpretationPanel from './components/SqlInterpretationPanel.vue'
import Card from '@/ui/Card.vue'
import { useMeta } from '@/composables/useMeta'

useMeta(() => ({
  title:       'Weather Intelligence — DataSnake',
  description: 'Five insurance use cases proven on real open data — NOAA, FEMA, USGS, NASA FIRMS. Every chart ships with the SQL query that produced it.',
  type:        'website',
}))

// SQL panel example on the landing — shows the live FEMA NRI county
// count that anchors the section. Real query, real numbers.
const liveCountySql = `select
  count(*)::int                         as counties_indexed,
  sum(expected_annual_loss_total)::numeric as total_us_eal_usd,
  count(*) filter (where risk_score >= 80) as high_risk_count
from public.fema_nri;`
</script>

<template>
  <div>
    <WeatherIntelligenceTabStrip />

    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      <!-- Hero -->
      <header>
        <p class="text-ink-muted text-xs tracking-widest uppercase">Section · Weather Intelligence</p>
        <h1 class="text-3xl sm:text-4xl font-semibold text-ink-primary mt-2 leading-tight">
          Five insurance use cases, proven on real open data.
        </h1>
        <p class="text-ink-muted text-base sm:text-lg mt-3 max-w-3xl leading-relaxed">
          Every chart in this section runs on free public data —
          NOAA Global Hourly, FEMA NRI, USGS earthquakes, NASA FIRMS.
          Below every chart is the literal SQL query that produced it.
          Copy it. Run it against your own Postgres. Get the same answer.
        </p>
        <p class="text-ink-muted text-base mt-3 max-w-3xl leading-relaxed">
          This is the technical due-diligence layer. The investor
          pitch lives at
          <RouterLink to="/insurance" class="text-accent hover:text-accent-deep">/insurance</RouterLink>.
          The B2B API lives at
          <RouterLink to="/insurance/api" class="text-accent hover:text-accent-deep">/insurance/api</RouterLink>.
          This section is the proof — the queries you can run yourself.
        </p>
      </header>

      <!-- Five use case cards -->
      <section>
        <h2 class="text-xl font-semibold text-ink-primary mb-3">The five use cases</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <UseCaseCard
            to="/weather-intelligence/flash-flood"
            :number="1"
            title="Flash Flood Detection"
            one-liner="Miami Beach, May 2024: $180K loss FEMA + NOAA missed. EP curve on real NOAA data flags it."
            real-data="NOAA Global Hourly + FEMA NRI"
            roi="750:1"
            status="partial"
          />
          <UseCaseCard
            to="/weather-intelligence/seismic-precursor"
            :number="2"
            title="Seismic Precursor"
            one-liner="Bay Area foreshock clustering: +247% frequency anomaly = 6-12 week elevated window."
            real-data="USGS earthquake catalog"
            roi="150:1"
            status="live"
          />
          <UseCaseCard
            to="/weather-intelligence/parametric"
            :number="3"
            title="Parametric Trigger"
            one-liner="Pick a sensor + threshold + payout. Back-test against history. Validate before launch."
            real-data="NDBC buoys (live, hourly)"
            roi="Product enablement"
            status="live"
          />
          <UseCaseCard
            to="/weather-intelligence/underwriting"
            :number="4"
            title="Underwriting Moat"
            one-liner="Static FEMA NRI alone vs FEMA NRI + live alert/buoy modifiers. 38pp loss ratio gap."
            real-data="FEMA NRI + public.events + NDBC"
            roi="1.3× ongoing profit"
            status="live"
          />
          <UseCaseCard
            to="/weather-intelligence/claims"
            :number="5"
            title="Claims Validation"
            one-liner="Hurricane Ian replay: reconstruct what sensors recorded at the claim location. 2hr vs 7-14d."
            real-data="NOAA IBTrACS + reanalysis (planned)"
            roi="$10M/yr ops + fraud"
            status="planned"
          />
        </div>
        <Card padded class="mt-4">
          <WIMetricInfoPanel id="overview.thesis" standalone />
        </Card>
      </section>

      <!-- The differentiator visible artifact: a live SQL panel on the landing -->
      <section>
        <h2 class="text-xl font-semibold text-ink-primary mb-3">What this section looks like</h2>
        <Card padded>
          <p class="text-ink-primary text-sm leading-relaxed mb-3">
            Every page underneath this landing has charts plus the
            literal SQL query that produced them. Here's an example
            from FEMA NRI — the same anchor data the
            <RouterLink to="/insurance" class="text-accent hover:text-accent-deep">/insurance</RouterLink>
            section's headline counters use, exposed here as a
            reproducible query.
          </p>
          <SqlInterpretationPanel
            :query="liveCountySql"
            source="public.fema_nri — FEMA NRI v3 county-level table, ~3,200 rows. Loaded one-shot via seed-fema-nri workflow."
            caption="Three numbers that anchor the entire DataSnake insurance section. Run this against the same table and you'll get the same answer."
          />
        </Card>
      </section>

      <!-- Competitor matrix -->
      <section>
        <CompetitorMatrix />
        <Card padded class="mt-3">
          <WIMetricInfoPanel id="overview.competitor-matrix" standalone />
        </Card>
      </section>

      <!-- Glossary CTA -->
      <Card padded>
        <h3 class="text-base font-semibold text-ink-primary">Want every detail in one place?</h3>
        <p class="text-ink-muted text-sm mt-2">
          The
          <RouterLink to="/weather-intelligence/glossary" class="text-accent hover:text-accent-deep">glossary page</RouterLink>
          lists every "How is this calculated?" panel fully expanded
          across all five use cases. Use it as a pre-meeting cheat
          sheet or share the link with technical reviewers.
        </p>
      </Card>
    </div>
  </div>
</template>
