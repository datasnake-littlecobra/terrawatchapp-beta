<script setup lang="ts">
// TerraWatch / DataSnake — Module 6: Claims Validation.
//
// After an event, validate inbound claims against the actual sensor
// readings recorded at the claimed location at the claimed time. The
// fraud-detection / loss-adjustment surface.

import { computed, ref } from 'vue'
import Card from '@/ui/Card.vue'
import InsuranceTabStrip from './components/InsuranceTabStrip.vue'
import DemoBadge from './components/DemoBadge.vue'
import MetricInfoPanel from './components/MetricInfoPanel.vue'
import { useMeta } from '@/composables/useMeta'
import {
  CLAIMS_EVENTS,
  fmtUsd,
  type ClaimsEvent,
  type ClaimRecord,
} from '@/data/insurance-mock'

useMeta(() => ({
  title:       'Claims Validation — Insurance Intelligence',
  description: 'Validate inbound claims against actual sensor readings at the claim location and time. Surfaces inconsistent claims for adjuster review.',
}))

const eventId = ref<string>(CLAIMS_EVENTS[0]?.event_id ?? '')

const events = CLAIMS_EVENTS
const event = computed<ClaimsEvent | undefined>(
  () => events.find((e) => e.event_id === eventId.value),
)

const summary = computed(() => {
  const e = event.value
  if (!e) return { total: 0, consistent: 0, inconsistent: 0, insufficient: 0, atRisk: 0 }
  let consistent = 0, inconsistent = 0, insufficient = 0, atRisk = 0
  for (const c of e.claims) {
    if (c.verdict === 'CONSISTENT') consistent++
    else if (c.verdict === 'INCONSISTENT') { inconsistent++; atRisk += c.claim_amount }
    else if (c.verdict === 'INSUFFICIENT') insufficient++
  }
  return { total: e.claims.length, consistent, inconsistent, insufficient, atRisk }
})

function verdictPill(c: ClaimRecord): { class: string; label: string } {
  if (c.verdict === 'CONSISTENT')   return { class: 'border-safe/40 text-safe bg-safe/10',         label: 'CONSISTENT' }
  if (c.verdict === 'INCONSISTENT') return { class: 'border-danger/40 text-danger bg-danger/10',   label: 'INCONSISTENT' }
  return                                   { class: 'border-white/15 text-ink-muted bg-white/5',   label: 'INSUFFICIENT' }
}

// Visual: ratio of recorded reading to claimed-damage threshold.
// > 1 means sensor recorded more than the threshold (claim is supported).
// < 1 means recorded less (claim looks suspicious).
function ratio(c: ClaimRecord): number {
  if (c.threshold === 0) return 0
  return c.reading_value / c.threshold
}
function ratioColor(r: number): string {
  if (r >= 1.0) return '#3DDC97'
  if (r >= 0.7) return '#F5B74A'
  return '#FF6B6B'
}
</script>

<template>
  <div>
    <InsuranceTabStrip />

    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header class="flex items-start justify-between gap-3 mb-5">
        <div>
          <p class="text-ink-muted text-xs tracking-widest uppercase">Module · Claims</p>
          <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
            Claims validation against sensor data
          </h1>
          <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-2xl">
            For any past event, compare every inbound claim against the
            actual DataSnake sensor readings at the claim's coordinates +
            timestamp. Inconsistent claims surface for adjuster review.
          </p>
        </div>
        <DemoBadge class="hidden sm:inline-flex" />
      </header>

      <!-- Event picker -->
      <Card padded>
        <div class="flex flex-col sm:flex-row sm:items-end gap-3">
          <div class="flex-1">
            <label class="text-[10px] uppercase tracking-widest text-ink-muted/60 block mb-1">Event</label>
            <select
              v-model="eventId"
              class="w-full rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-ink-primary focus:outline-none focus:border-accent/40"
            >
              <option v-for="e in events" :key="e.event_id" :value="e.event_id">
                {{ e.event_name }}
              </option>
            </select>
          </div>
          <div class="text-xs text-ink-muted">
            <span class="block text-[10px] uppercase tracking-widest text-ink-muted/60">Sensors</span>
            <span class="font-mono">{{ event?.sensor_ids.join(' · ') ?? '—' }}</span>
          </div>
        </div>

        <!-- Recorded peaks -->
        <div v-if="event" class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <div class="rounded-lg border border-white/5 bg-surface-0/60 p-3">
            <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Date</p>
            <p class="num text-sm text-ink-primary mt-1">{{ event.date }}</p>
          </div>
          <div class="rounded-lg border border-white/5 bg-surface-0/60 p-3">
            <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Peak surge</p>
            <p class="num text-sm text-ink-primary mt-1">
              {{ event.peak_surge_m != null ? `${event.peak_surge_m} m` : '—' }}
            </p>
          </div>
          <div class="rounded-lg border border-white/5 bg-surface-0/60 p-3">
            <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Peak wind</p>
            <p class="num text-sm text-ink-primary mt-1">
              {{ event.peak_wind_kmh != null ? `${event.peak_wind_kmh} km/h` : '—' }}
            </p>
          </div>
          <div class="rounded-lg border border-white/5 bg-surface-0/60 p-3">
            <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Peak rain</p>
            <p class="num text-sm text-ink-primary mt-1">
              {{ event.peak_rain_mm != null ? `${event.peak_rain_mm} mm` : '—' }}
            </p>
          </div>
        </div>
        <MetricInfoPanel id="claims.event-context" />
      </Card>

      <!-- Summary KPIs -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 my-5">
        <div class="rounded-2xl border border-white/5 bg-surface-1 p-3 sm:p-4">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Claims</p>
          <p class="num text-2xl font-semibold text-ink-primary mt-1">{{ summary.total }}</p>
        </div>
        <div class="rounded-2xl border border-safe/30 bg-safe/[0.05] p-3 sm:p-4">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Consistent</p>
          <p class="num text-2xl font-semibold text-safe mt-1">{{ summary.consistent }}</p>
        </div>
        <div class="rounded-2xl border border-danger/30 bg-danger/[0.05] p-3 sm:p-4">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Inconsistent</p>
          <p class="num text-2xl font-semibold text-danger mt-1">{{ summary.inconsistent }}</p>
        </div>
        <div class="rounded-2xl border border-caution/30 bg-caution/[0.05] p-3 sm:p-4">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">$ at risk</p>
          <p class="num text-2xl font-semibold text-caution mt-1">{{ fmtUsd(summary.atRisk) }}</p>
        </div>
      </div>

      <Card padded class="mb-5">
        <MetricInfoPanel id="claims.summary-kpis" standalone />
      </Card>

      <!-- Claims table -->
      <Card v-if="event" padded>
        <h2 class="text-base font-semibold text-ink-primary mb-3">Claim-by-claim verdict</h2>
        <div class="overflow-x-auto -mx-3">
          <table class="w-full text-sm border-collapse min-w-[840px]">
            <thead>
              <tr class="text-[10px] uppercase tracking-widest text-ink-muted/60 border-b border-white/5">
                <th class="text-left py-2 px-3">Claim</th>
                <th class="text-left py-2 px-3">Location</th>
                <th class="text-left py-2 px-3">Damage</th>
                <th class="text-right py-2 px-3">Amount</th>
                <th class="text-left py-2 px-3">Sensor reading</th>
                <th class="text-left py-2 px-3">Threshold</th>
                <th class="text-center py-2 px-3">Reading vs Required</th>
                <th class="text-center py-2 px-3">Verdict</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              <tr v-for="c in event.claims" :key="c.claim_id">
                <td class="py-2.5 px-3 align-top">
                  <p class="text-ink-primary font-medium">{{ c.claim_id }}</p>
                  <p class="text-[10px] text-ink-muted/60">{{ c.policy_type }}</p>
                </td>
                <td class="py-2.5 px-3 align-top text-ink-muted">{{ c.location }}</td>
                <td class="py-2.5 px-3 align-top">
                  <span class="text-ink-primary">{{ c.claimed_damage.replace('_', ' ') }}</span>
                </td>
                <td class="py-2.5 px-3 align-top num text-right text-ink-primary">{{ fmtUsd(c.claim_amount) }}</td>
                <td class="py-2.5 px-3 align-top text-ink-muted">{{ c.sensor_reading }}</td>
                <td class="py-2.5 px-3 align-top text-ink-muted num">≥ {{ c.threshold }}</td>
                <td class="py-2.5 px-3 align-top w-[200px]">
                  <div class="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      class="h-full rounded-full"
                      :style="{
                        width: Math.min(150, ratio(c) * 100) + '%',
                        background: ratioColor(ratio(c)),
                      }"
                    />
                  </div>
                  <p class="text-[10px] text-ink-muted/60 mt-1">
                    {{ (ratio(c) * 100).toFixed(0) }}% of required threshold
                  </p>
                </td>
                <td class="py-2.5 px-3 align-top text-center">
                  <span
                    class="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border font-semibold inline-block"
                    :class="verdictPill(c).class"
                  >{{ verdictPill(c).label }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <MetricInfoPanel id="claims.claim-verdicts" />
      </Card>

      <!-- Notes per inconsistent claim -->
      <Card v-if="event && summary.inconsistent > 0" padded class="mt-3 border-danger/30 bg-danger/[0.04]">
        <h3 class="text-sm font-semibold text-ink-primary mb-2 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
               class="w-4 h-4 text-danger">
            <path d="m12 9 .01 4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          </svg>
          Adjuster notes — claims requiring review
        </h3>
        <ul class="space-y-2 text-sm">
          <li v-for="c in event.claims.filter((x) => x.verdict !== 'CONSISTENT')" :key="c.claim_id">
            <p class="text-ink-primary">
              <span class="font-mono text-xs text-ink-muted">{{ c.claim_id }}</span>
              · {{ c.location }} ·
              <span class="text-ink-muted">{{ fmtUsd(c.claim_amount) }}</span>
            </p>
            <p class="text-ink-muted text-xs mt-0.5">{{ c.notes }}</p>
          </li>
        </ul>
      </Card>

      <p class="text-ink-muted/60 text-xs mt-5 max-w-3xl">
        <strong class="text-ink-muted">Production wiring:</strong>
        Adjusters paste a claim ID; the API joins claim coordinates +
        timestamp to the closest DataSnake sensor reading at that
        moment, and emits a verdict. Threshold tables are configurable
        per peril and per policy type. INCONSISTENT verdicts pause
        auto-payout; INSUFFICIENT verdicts route to manual review.
      </p>
    </div>
  </div>
</template>
