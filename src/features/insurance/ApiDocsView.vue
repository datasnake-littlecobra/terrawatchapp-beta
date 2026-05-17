<script setup lang="ts">
// TerraWatch — Phase 9.13: public docs for the Insurance Risk API.
//
// Shareable URL. Single-page reference for an insurer's engineer:
// what the endpoint is, how to auth, every request shape, the
// response shape, the error codes, working curl + node + python
// examples. The "How is this calculated?" panel is included inline
// for the self-documenting workflow.

import { ref } from 'vue'
import Card from '@/ui/Card.vue'
import InsuranceTabStrip from './components/InsuranceTabStrip.vue'
import MetricInfoPanel from './components/MetricInfoPanel.vue'
import { useMeta } from '@/composables/useMeta'

useMeta(() => ({
  title:       'Risk API — Insurance Intelligence',
  description: 'POST an address or coordinates, get a risk score, premium multiplier, and per-peril breakdown in JSON. Calibrated against FEMA NRI v3.',
}))

const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://<project>.supabase.co'
const endpoint = `${baseUrl}/functions/v1/insurance-risk-verdict`

const tabs = ['curl', 'node', 'python'] as const
type Tab = typeof tabs[number]
const activeTab = ref<Tab>('curl')

const curlExample = `curl -X POST "${endpoint}" \\
  -H "Authorization: Bearer tw_yourkey..." \\
  -H "Content-Type: application/json" \\
  -d '{"address": "Miami Beach, FL"}'`

const nodeExample = `const r = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.TW_API_KEY}\`,
    "Content-Type":  "application/json",
  },
  body: JSON.stringify({ address: "Miami Beach, FL" }),
})
const { verdict } = await r.json()
console.log(verdict.risk_score, verdict.verdict)`

const pythonExample = `import os, requests
r = requests.post(
    "${endpoint}",
    headers={
        "Authorization": f"Bearer {os.environ['TW_API_KEY']}",
        "Content-Type":  "application/json",
    },
    json={"address": "Miami Beach, FL"},
)
verdict = r.json()["verdict"]
print(verdict["risk_score"], verdict["verdict"])`

const responseExample = `{
  "ok":        true,
  "tenant":    "Acme MGA",
  "plan":      "free",
  "remaining": 97,
  "verdict": {
    "risk_score":         72,
    "risk_label":         "HIGH",
    "verdict":            "Bind only with elevated premium...",
    "premium_multiplier": 2.44,
    "aal_multiplier":     2.92,
    "perils": {
      "flood":     8.2,
      "seismic":   2.1,
      "wind":      5.8,
      "wildfire":  3.5,
      "surge":     7.4
    },
    "confidence": 0.78,
    "matched_county": {
      "fips":  "12086",
      "name":  "Miami-Dade",
      "state": "Florida"
    },
    "active_events_in_state": [],
    "sensor_backed_anomalies": [],
    "data_sources": ["FEMA NRI v3", "USGS quakes", "NWS alerts", ...],
    "last_updated": "2026-05-12T08:00:00Z"
  }
}`

function copy(s: string) {
  void navigator.clipboard?.writeText(s)
}
</script>

<template>
  <div>
    <InsuranceTabStrip />

    <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      <header>
        <p class="text-ink-muted text-xs tracking-widest uppercase">Insurance · API</p>
        <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
          Risk API — address → risk verdict
        </h1>
        <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-2xl">
          A single HTTP endpoint that returns a risk score, premium
          multiplier, AAL multiplier, and per-peril breakdown for any
          US address or county. Calibrated against FEMA NRI v3 plus
          live event signals.
        </p>
      </header>

      <!-- Endpoint -->
      <Card padded>
        <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">Endpoint</p>
        <div class="flex items-center gap-2 mt-1.5">
          <code class="text-accent text-sm font-mono break-all flex-1">POST {{ endpoint }}</code>
          <button type="button" class="text-xs text-ink-muted hover:text-accent transition-colors" @click="copy(endpoint)">copy</button>
        </div>
      </Card>

      <!-- Auth -->
      <Card padded>
        <h2 class="text-base font-semibold text-ink-primary mb-2">Authentication</h2>
        <p class="text-ink-muted text-sm mb-3">
          Send your API key in the <code class="text-accent">Authorization</code>
          header as a Bearer token. Keys are issued via the admin console
          and start with <code class="text-accent">tw_</code>.
        </p>
        <pre class="rounded-lg border border-white/5 bg-surface-0/40 p-3 text-xs font-mono text-ink-primary overflow-x-auto">Authorization: Bearer tw_yourkey...</pre>
        <p class="text-ink-muted text-xs mt-2">
          Free plan: 100 requests/day. Paid plan: 10,000 requests/day.
          Rate-limit state is reported in
          <code class="text-accent">X-RateLimit-Limit</code> and
          <code class="text-accent">X-RateLimit-Remaining</code>
          response headers.
        </p>
      </Card>

      <!-- Request -->
      <Card padded>
        <h2 class="text-base font-semibold text-ink-primary mb-2">Request body</h2>
        <p class="text-ink-muted text-sm mb-3">
          JSON. Send any ONE of the four input shapes below:
        </p>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-[10px] uppercase tracking-widest text-ink-muted/60 border-b border-white/5">
              <th class="text-left py-2 px-3">Field</th>
              <th class="text-left py-2 px-3">Type</th>
              <th class="text-left py-2 px-3">Notes</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5 text-ink-primary">
            <tr><td class="py-2 px-3 font-mono text-xs">county_fips</td><td class="py-2 px-3 text-xs text-ink-muted">string</td><td class="py-2 px-3 text-xs">5-digit FIPS, e.g. "12086". Fastest path — skips geocoding.</td></tr>
            <tr><td class="py-2 px-3 font-mono text-xs">state + county</td><td class="py-2 px-3 text-xs text-ink-muted">string, string</td><td class="py-2 px-3 text-xs">Name match, case-insensitive. "Florida" + "Miami-Dade".</td></tr>
            <tr><td class="py-2 px-3 font-mono text-xs">address</td><td class="py-2 px-3 text-xs text-ink-muted">string</td><td class="py-2 px-3 text-xs">Free text. Geocoded via Open-Meteo.</td></tr>
            <tr><td class="py-2 px-3 font-mono text-xs">lat + lon</td><td class="py-2 px-3 text-xs text-ink-muted">number, number</td><td class="py-2 px-3 text-xs">Currently routes through state+county; expects nearby populated place.</td></tr>
          </tbody>
        </table>
      </Card>

      <!-- Examples -->
      <Card padded>
        <h2 class="text-base font-semibold text-ink-primary mb-3">Examples</h2>
        <div class="flex gap-1 mb-3">
          <button
            v-for="t in tabs"
            :key="t"
            type="button"
            class="text-xs px-3 py-1.5 rounded-full border transition-colors"
            :class="activeTab === t
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-white/10 text-ink-muted hover:text-ink-primary hover:border-white/20'"
            @click="activeTab = t"
          >{{ t }}</button>
        </div>
        <div class="relative">
          <pre v-if="activeTab === 'curl'"   class="rounded-lg border border-white/5 bg-surface-0/40 p-3 text-xs font-mono text-ink-primary overflow-x-auto">{{ curlExample }}</pre>
          <pre v-if="activeTab === 'node'"   class="rounded-lg border border-white/5 bg-surface-0/40 p-3 text-xs font-mono text-ink-primary overflow-x-auto">{{ nodeExample }}</pre>
          <pre v-if="activeTab === 'python'" class="rounded-lg border border-white/5 bg-surface-0/40 p-3 text-xs font-mono text-ink-primary overflow-x-auto">{{ pythonExample }}</pre>
          <button
            type="button"
            class="absolute top-2 right-2 text-[10px] uppercase tracking-widest text-ink-muted/70 hover:text-accent transition-colors"
            @click="copy(activeTab === 'curl' ? curlExample : activeTab === 'node' ? nodeExample : pythonExample)"
          >copy</button>
        </div>
      </Card>

      <!-- Response -->
      <Card padded>
        <h2 class="text-base font-semibold text-ink-primary mb-2">Response (200 OK)</h2>
        <pre class="rounded-lg border border-white/5 bg-surface-0/40 p-3 text-xs font-mono text-ink-primary overflow-x-auto">{{ responseExample }}</pre>
        <h3 class="text-sm font-semibold text-ink-primary mt-4 mb-2">Field reference</h3>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-[10px] uppercase tracking-widest text-ink-muted/60 border-b border-white/5">
              <th class="text-left py-2 px-3">Field</th>
              <th class="text-left py-2 px-3">Range</th>
              <th class="text-left py-2 px-3">Meaning</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5 text-ink-primary">
            <tr><td class="py-2 px-3 font-mono text-xs">risk_score</td><td class="py-2 px-3 text-xs text-ink-muted">0-100</td><td class="py-2 px-3 text-xs">Composite. ≥80 = Very High.</td></tr>
            <tr><td class="py-2 px-3 font-mono text-xs">risk_label</td><td class="py-2 px-3 text-xs text-ink-muted">enum</td><td class="py-2 px-3 text-xs">LOW / MODERATE / ELEVATED / HIGH / CRITICAL.</td></tr>
            <tr><td class="py-2 px-3 font-mono text-xs">premium_multiplier</td><td class="py-2 px-3 text-xs text-ink-muted">1.0-5.0</td><td class="py-2 px-3 text-xs">× carrier base rate.</td></tr>
            <tr><td class="py-2 px-3 font-mono text-xs">aal_multiplier</td><td class="py-2 px-3 text-xs text-ink-muted">1.0-7.0</td><td class="py-2 px-3 text-xs">× portfolio AAL reserve.</td></tr>
            <tr><td class="py-2 px-3 font-mono text-xs">perils.*</td><td class="py-2 px-3 text-xs text-ink-muted">0-10</td><td class="py-2 px-3 text-xs">Per-peril sub-score. flood/seismic/wind/wildfire/surge.</td></tr>
            <tr><td class="py-2 px-3 font-mono text-xs">confidence</td><td class="py-2 px-3 text-xs text-ink-muted">0-1</td><td class="py-2 px-3 text-xs">Agreement across peril sub-scores × column completeness.</td></tr>
            <tr><td class="py-2 px-3 font-mono text-xs">sensor_backed_anomalies</td><td class="py-2 px-3 text-xs text-ink-muted">array</td><td class="py-2 px-3 text-xs">Empty until DataSnake proprietary sensors come online (Phase 9.13.1).</td></tr>
          </tbody>
        </table>
      </Card>

      <!-- Errors -->
      <Card padded>
        <h2 class="text-base font-semibold text-ink-primary mb-2">Error responses</h2>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-[10px] uppercase tracking-widest text-ink-muted/60 border-b border-white/5">
              <th class="text-left py-2 px-3">Status</th>
              <th class="text-left py-2 px-3">When</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5 text-ink-primary">
            <tr><td class="py-2 px-3 num">400</td><td class="py-2 px-3 text-xs">Body not JSON; no recognized input field.</td></tr>
            <tr><td class="py-2 px-3 num">401</td><td class="py-2 px-3 text-xs">Missing, invalid, or revoked API key.</td></tr>
            <tr><td class="py-2 px-3 num">404</td><td class="py-2 px-3 text-xs">County not found in FEMA NRI.</td></tr>
            <tr><td class="py-2 px-3 num">422</td><td class="py-2 px-3 text-xs">Geocoding failed; could not resolve county.</td></tr>
            <tr><td class="py-2 px-3 num">429</td><td class="py-2 px-3 text-xs">Daily rate limit exceeded. Retry-After: 86400.</td></tr>
            <tr><td class="py-2 px-3 num">500</td><td class="py-2 px-3 text-xs">Server error.</td></tr>
          </tbody>
        </table>
      </Card>

      <!-- How-is-this-calculated panel (self-documenting workflow) -->
      <Card padded>
        <MetricInfoPanel id="api.risk-verdict-endpoint" standalone />
      </Card>

      <p class="text-ink-muted/60 text-xs">
        Need a key? Contact us, or if you're an admin, issue one via
        <code class="text-accent">/admin/api-keys</code>.
      </p>
    </div>
  </div>
</template>
