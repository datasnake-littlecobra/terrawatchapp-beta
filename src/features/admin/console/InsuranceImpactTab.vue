<script setup lang="ts">
// TerraWatch — Phase 9.16 Insurance Impact tab.
//
// The bridge from "data" to "decision". Five sections, one per
// public insurance surface, each spelling out: which sensors feed
// it, what derived metric is computed, how it lands in the
// underwriter's hand. Newbie-readable from top to bottom.

import { RouterLink } from 'vue-router'
import NarrativeCard from './components/NarrativeCard.vue'
import Card from '@/ui/Card.vue'

interface ImpactSection {
  to:          string
  title:       string
  hero:        string
  inputs:      string[]
  derivation:  string
  decision:    string
  example:     string
}

const sections: ImpactSection[] = [
  {
    to:    '/insurance/verdict',
    title: 'Risk Verdict (address-level)',
    hero:  'A risk_score 0-100, a verdict label (LOW…CRITICAL), a premium multiplier, and an AAL multiplier.',
    inputs: [
      'public.fema_nri (county-level annual baseline — FEMA NRI v3)',
      'public.events (live alerts, last 24h — USGS / NWS / EONET / NHC)',
      'Proprietary sensor anomaly density per county (Phase 9.15 wires this in)',
    ],
    derivation:
      'risk_score = FEMA composite. premium_multiplier = min(5, 1 + max(0, risk-40) × 0.045). aal_multiplier = min(7, 1 + max(0, risk-40) × 0.06). Per-peril sub-scores logarithmically normalized from $EAL columns.',
    decision:
      'An underwriter quoting a policy at this address has three numbers to plug into their pricing engine. A 72/HIGH with 2.4× premium means "bind only with surcharge + peril-specific exclusions."',
    example:
      'Miami Beach FL → 78 / HIGH / 2.71× premium / 3.28× AAL. Surge-dominant peril breakdown.',
  },
  {
    to:    '/insurance/api',
    title: 'Risk API (programmatic)',
    hero:  'POST address → JSON verdict in <800ms. Same scoring as the UI verdict, exposed as a B2B endpoint.',
    inputs: [
      'Same FEMA NRI + events sources as Risk Verdict',
      'public.api_keys for auth (atomic api_key_check_and_bump RPC)',
      'public.api_key_usage for rate limiting (free 100/day, paid 10k/day)',
    ],
    derivation:
      'Hashes the bearer key, bumps the daily counter, fetches the county row, computes the verdict, returns JSON. Per-request log lands in public.api_request_log for the APIs tab.',
    decision:
      'An MGA underwriting engine integrates this endpoint. Every quote in their pipeline gets a risk_score + premium_multiplier in <1s without manual cat-modeling work.',
    example:
      'curl -X POST -H "Authorization: Bearer tw_…" -d \'{"address":"Galveston, TX"}\' → {"risk_score": 71, "premium_multiplier": 2.40, …}',
  },
  {
    to:    '/insurance/parametric',
    title: 'Parametric Trigger Monitor',
    hero:  'Contracts that auto-pay when a sensor reading crosses a contractual threshold.',
    inputs: [
      'public.measurements (the sensor stream — currently mocked, Phase 9.15 wires real triggers)',
      'Per-contract threshold rows (today: mock array; Phase 9.15: parametric_contracts table)',
      'measurements_anomalies RPC (rolling z-score)',
    ],
    derivation:
      'State machine: CLEAR → MONITORING → WARNING → TRIGGERED based on (current_reading / threshold) ratio. WARNING at ≥0.90, TRIGGERED at ≥1.00. Phase 9.15 fires a signed webhook on TRIGGERED + writes an audit ledger row.',
    decision:
      'When TRIGGERED fires, claims-ops gets a webhook + the payout amount queues for wire transfer. Audit trail (sensor_id + reading + threshold + signature) is reinsurance-recovery-ready.',
    example:
      'Contract PC-024: surge_height at ds:sub:ocean:002 ≥ 5.0 m. Current reading 5.18 m → TRIGGERED → $250k payout authorized.',
  },
  {
    to:    '/insurance/ep-curves',
    title: 'EP Curves (capital release)',
    hero:  'Baseline vs sensor-informed exceedance-probability curves; the gap is the released catastrophe capital.',
    inputs: [
      'Industry baseline cat model (RMS/AIR-style, parameterized in src/data/insurance-mock.ts)',
      'Sensor-informed adjustment from the proprietary measurements anomaly density',
      'Per-peril modeled loss tables (flood / seismic / wind / surge)',
    ],
    derivation:
      'For each return period, sensor-informed loss = baseline × (1 - tightening_factor(RP)). Tightening is larger at high RPs because local sensor data adds the most information in the tail.',
    decision:
      'CFO + CRO release N% of catastrophe capital based on the tightening at 1-in-100yr. A typical book sees $0.5B-$2B per peril at portfolio scale.',
    example:
      'At 1-in-100yr: baseline $4.2B, sensor-informed $3.3B. $0.9B capital released — redeployable as growth budget.',
  },
  {
    to:    '/insurance/portfolio',
    title: 'Portfolio Risk Aggregation',
    hero:  'An insurer\'s book of policies, rolled up by region × peril, with concentration alerts and underpricing gap.',
    inputs: [
      'public.policies (tenant\'s own book, RLS-gated by tenant_members)',
      'public.fema_nri joined per policy.county_fips',
      'Calibrated load_factor = 1.5 (industry combined-ratio target)',
    ],
    derivation:
      'Fair premium = EAL × 1.5. Pricing gap = fair_premium - actual_premium. 80/20 = top-N concentration. Heatmap = sum(exposure) per (region, peril) cell.',
    decision:
      'CRO sees their largest accumulation zone in real time. Pricing actuary identifies the top-100 underpriced policies for next-renewal repricing. Reinsurance buyer cites concentration to justify treaty layer attachment.',
    example:
      '12% of policies hold 80% of exposure. $42M annual underpricing gap concentrated in Miami-Dade hurricane-exposed homeowners.',
  },
]
</script>

<template>
  <div class="space-y-5">
    <NarrativeCard
      eyebrow="Ops Console · Insurance Impact"
      title="Sensor → climate signal → underwriting decision"
      body="Every chart in the previous tabs feeds at least one card here. If you're explaining the platform to a buyer in five minutes, start at this tab. Each section: what the buyer sees, what feeds it, how it's computed, the decision it informs, plus a concrete example."
      :links="[{ to: '/insurance', label: 'Public insurance hub' }]"
    />

    <Card v-for="s in sections" :key="s.to" padded>
      <div class="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <div>
          <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">Insurance Surface</p>
          <h2 class="text-lg font-semibold text-ink-primary mt-0.5">{{ s.title }}</h2>
        </div>
        <RouterLink :to="s.to" class="text-xs text-accent hover:text-accent-deep whitespace-nowrap">See live →</RouterLink>
      </div>

      <p class="text-ink-primary text-sm leading-relaxed mb-4">{{ s.hero }}</p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="rounded-lg border border-white/5 bg-surface-0/40 p-3">
          <p class="text-[10px] uppercase tracking-widest text-ink-muted/70 mb-1">Inputs</p>
          <ul class="text-ink-primary text-xs leading-relaxed space-y-1">
            <li v-for="i in s.inputs" :key="i">• {{ i }}</li>
          </ul>
        </div>
        <div class="rounded-lg border border-white/5 bg-surface-0/40 p-3">
          <p class="text-[10px] uppercase tracking-widest text-ink-muted/70 mb-1">Derivation</p>
          <p class="text-ink-primary text-xs leading-relaxed">{{ s.derivation }}</p>
        </div>
        <div class="rounded-lg border border-white/5 bg-surface-0/40 p-3">
          <p class="text-[10px] uppercase tracking-widest text-ink-muted/70 mb-1">Underwriting decision</p>
          <p class="text-ink-primary text-xs leading-relaxed">{{ s.decision }}</p>
        </div>
        <div class="rounded-lg border border-accent/30 bg-accent/[0.04] p-3">
          <p class="text-[10px] uppercase tracking-widest text-accent/80 mb-1">Concrete example</p>
          <p class="text-ink-primary text-xs leading-relaxed">{{ s.example }}</p>
        </div>
      </div>
    </Card>

    <p class="text-ink-muted/60 text-xs max-w-3xl">
      <strong class="text-ink-muted">The throughline:</strong>
      sensor reading → rolling z-score crosses a threshold → contract
      fires OR risk_score moves OR EP curve tightens OR portfolio
      heatmap reflows. Five different end-states, one upstream input.
      Every dollar of decision-quality improvement DataSnake produces
      originates as a sensor row that landed in the Streams tab.
    </p>
  </div>
</template>
