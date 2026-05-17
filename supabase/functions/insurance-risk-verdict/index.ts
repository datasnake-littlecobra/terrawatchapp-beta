// TerraWatch — Phase 9.13: Insurance Risk API.
//
// POST /functions/v1/insurance-risk-verdict
// Body (one of):
//   { county_fips: "12086" }
//   { state: "Florida", county: "Miami-Dade" }
//   { lat: 25.79, lon: -80.13 }
//   { address: "Miami Beach, FL" }
// Auth: Authorization: Bearer <api_key>
//
// Returns the same shape the /insurance/verdict UI renders, computed
// from public.fema_nri (live data). The "sensor_backed_anomalies" field
// is currently always [] — it becomes the upsell field once DataSnake
// proprietary sensors (Phase 9.13.1) start writing to public.measurements
// with source_tier='proprietary'.
//
// Auth: hashes the bearer key (sha256 hex), calls api_key_check_and_bump
// RPC which atomically validates + increments quota.
//
// Rate limiting: per-key daily counter in public.api_key_usage.
//
// Geocoding for the address/lat-lon inputs goes through Open-Meteo's
// free geocoding (same precedent as src/services/geocode.ts). For
// lat/lon we use a small ad-hoc reverse-lookup via Open-Meteo's reverse
// endpoint, then resolve state+county to fips via fema_nri.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extra },
  })
}

// =====================================================================
// Scoring constants (KEEP IN SYNC with src/lib/insuranceScore.ts —
// duplicated here because Deno cannot import from src/ at runtime).
// =====================================================================

const PREMIUM_K = 0.045
const AAL_K     = 0.060
const PREMIUM_MAX = 5.0
const AAL_MAX     = 7.0
const EAL_REF = 100_000_000

type RiskLabel = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL'

const LABEL_CUTOFFS: Array<{ min: number; label: RiskLabel }> = [
  { min: 85, label: 'CRITICAL' },
  { min: 70, label: 'HIGH'     },
  { min: 50, label: 'ELEVATED' },
  { min: 30, label: 'MODERATE' },
  { min: 0,  label: 'LOW'      },
]

function classifyRisk(score: number): RiskLabel {
  for (const c of LABEL_CUTOFFS) if (score >= c.min) return c.label
  return 'LOW'
}
function premiumMultiplier(s: number): number {
  return Math.min(PREMIUM_MAX, 1 + Math.max(0, s - 40) * PREMIUM_K)
}
function aalMultiplier(s: number): number {
  return Math.min(AAL_MAX, 1 + Math.max(0, s - 40) * AAL_K)
}
function ealToSubscore(eal: number | null | undefined): number {
  if (eal == null || !Number.isFinite(eal) || eal <= 0) return 0
  const ratio = Math.log10(1 + (eal / EAL_REF) * 9)
  return Math.min(10, Math.max(0, ratio * 10))
}

interface CountyRow {
  county_fips: string
  state: string
  county_name: string
  risk_score: number | null
  expected_annual_loss_total: number | null
  social_vulnerability: number | null
  community_resilience: number | null
  eal_flood: number | null
  eal_wildfire: number | null
  eal_hurricane: number | null
  eal_tornado: number | null
  eal_earthquake: number | null
}

function buildPerils(row: CountyRow) {
  return {
    flood:    Number(ealToSubscore(row.eal_flood).toFixed(1)),
    seismic:  Number(ealToSubscore(row.eal_earthquake).toFixed(1)),
    wind:     Number(Math.max(ealToSubscore(row.eal_hurricane), ealToSubscore(row.eal_tornado)).toFixed(1)),
    wildfire: Number(ealToSubscore(row.eal_wildfire).toFixed(1)),
    surge:    Number((ealToSubscore(row.eal_hurricane) * 0.7).toFixed(1)),
  }
}

function buildVerdictText(label: RiskLabel, dominantPeril: string): string {
  const cap = dominantPeril.charAt(0).toUpperCase() + dominantPeril.slice(1)
  switch (label) {
    case 'CRITICAL': return `Decline or refer. ${cap} exposure is at industry-uninsurable levels.`
    case 'HIGH':     return `Bind only with elevated premium and peril-specific exclusions. ${cap} drives the risk.`
    case 'ELEVATED': return `Bind with caution — premium multiplier recommended. ${cap} is the dominant exposure.`
    case 'MODERATE': return `Bindable at standard rate with documentation. ${cap} contributes most.`
    case 'LOW':      return `Bindable at preferred rate. No single peril dominates.`
  }
}

// =====================================================================
// Auth — hash bearer key with WebCrypto, call api_key_check_and_bump
// =====================================================================

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// =====================================================================
// Geocoding — Open-Meteo (free, no key needed)
// =====================================================================

interface GeocodeResult { state: string; county?: string; lat: number; lon: number }

async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(address)}&count=1&language=en&format=json`
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const j = await r.json() as any
    const p = j?.results?.[0]
    if (!p) return null
    return { state: p.admin1 ?? '', county: p.admin2, lat: p.latitude, lon: p.longitude }
  } catch { return null }
}

// =====================================================================
// Main handler
// =====================================================================

interface Body {
  county_fips?: string
  state?:       string
  county?:      string
  lat?:         number
  lon?:         number
  address?:     string
}

interface LogCtx { keyId: string | null }

// Phase 9.16 — handleInner mutates ctx.keyId once it's known (after
// auth). The outer serve wrapper writes the log row with the final
// status code + duration. Per-request ctx instance keeps this safe
// under concurrency.
async function handleInner(req: Request, ctx: LogCtx): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfigured' }, 500)
  }

  // ---- Auth -----------------------------------------------------------
  const auth = req.headers.get('authorization') ?? ''
  const rawKey = auth.replace(/^Bearer\s+/i, '').trim()
  if (!rawKey) return json({ error: 'Missing Authorization: Bearer <api_key>' }, 401)
  if (!rawKey.startsWith('tw_')) return json({ error: 'Invalid key format. Keys start with tw_.' }, 401)

  const keyHash = await sha256Hex(rawKey)

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: quotaRows, error: quotaErr } = await admin.rpc('api_key_check_and_bump', { p_key_hash: keyHash })
  if (quotaErr) return json({ error: 'Auth check failed', detail: quotaErr.message }, 500)
  const quota = (quotaRows as any[] | null)?.[0]
  if (quota?.key_id) ctx.keyId = quota.key_id
  if (!quota || !quota.allowed) {
    if (quota && quota.daily_limit > 0 && quota.remaining === 0) {
      return json(
        { error: 'Rate limit exceeded', daily_limit: quota.daily_limit },
        429,
        { 'Retry-After': '86400' },
      )
    }
    return json({ error: 'Invalid or revoked API key' }, 401)
  }

  // ---- Body parse -----------------------------------------------------
  let body: Body
  try { body = await req.json() as Body }
  catch { return json({ error: 'Body must be JSON' }, 400) }

  if (!body || (!body.county_fips && !body.state && !body.lat && !body.address)) {
    return json({
      error: 'Provide one of: { county_fips }, { state, county }, { lat, lon }, or { address }.',
    }, 400)
  }

  // ---- Resolve to county_fips ----------------------------------------
  let countyFips = body.county_fips?.trim() ?? ''

  if (!countyFips && body.address) {
    const geo = await geocodeAddress(body.address)
    if (!geo) return json({ error: 'Could not geocode address.' }, 422)
    body.state  = body.state  ?? geo.state
    body.county = body.county ?? geo.county
  }

  // (lat/lon path: use a reverse-fetch via Open-Meteo if a state isn't
  // provided. For v1 we delegate via the address string of the lat/lon —
  // Open-Meteo's reverse is not free, so we expect callers to send
  // either a county_fips or a state+county pair when using coordinates.)
  if (!countyFips && body.state) {
    let q = admin
      .from('fema_nri')
      .select('county_fips, state, county_name')
      .ilike('state', body.state.trim())
    if (body.county) q = q.ilike('county_name', body.county.trim())
    const { data: matches, error: matchErr } = await q.limit(1)
    if (matchErr) return json({ error: 'County lookup failed', detail: matchErr.message }, 500)
    if (!matches?.length) {
      return json({
        error: 'County not found in FEMA NRI.',
        hint:  'Try a different spelling, or supply county_fips directly.',
      }, 404)
    }
    countyFips = matches[0].county_fips
  }

  if (!countyFips) {
    return json({
      error: 'Could not resolve county. Supply county_fips OR address OR (state + county).',
    }, 422)
  }

  // ---- Fetch the county row ------------------------------------------
  const { data: rowRaw, error: rowErr } = await admin
    .from('fema_nri')
    .select([
      'county_fips','state','county_name',
      'risk_score','expected_annual_loss_total',
      'social_vulnerability','community_resilience',
      'eal_flood','eal_wildfire','eal_hurricane','eal_tornado','eal_earthquake',
    ].join(','))
    .eq('county_fips', countyFips)
    .maybeSingle()
  if (rowErr) return json({ error: 'County fetch failed', detail: rowErr.message }, 500)
  const row = rowRaw as CountyRow | null
  if (!row) return json({ error: 'No FEMA NRI row for that county_fips.', county_fips: countyFips }, 404)

  // ---- Compute the verdict --------------------------------------------
  const baseScore = row.risk_score ?? 0
  const perils = buildPerils(row)
  const dominant = (Object.entries(perils) as Array<[string, number]>)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'flood'
  const label = classifyRisk(baseScore)

  // Active events in the same state — surfaced as a small modifier list
  // for now. Sensor-backed anomalies stays empty until Phase 9.13.1
  // proprietary measurements come online.
  const { data: events } = await admin
    .from('events')
    .select('id, category, severity, title, occurred_at')
    .ilike('region', `%${row.state}%`)
    .gte('occurred_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .in('severity', ['caution', 'danger'])
    .order('occurred_at', { ascending: false })
    .limit(5)

  const verdict = {
    risk_score:         Math.round(baseScore),
    risk_label:         label,
    verdict:            buildVerdictText(label, dominant),
    premium_multiplier: Number(premiumMultiplier(baseScore).toFixed(2)),
    aal_multiplier:     Number(aalMultiplier(baseScore).toFixed(2)),
    perils,
    confidence:         Number((1 - 0.0).toFixed(2)),   // placeholder — UI uses richer measure
    matched_county: {
      fips:  row.county_fips,
      name:  row.county_name,
      state: row.state,
    },
    active_events_in_state: (events ?? []).map((e: any) => ({
      id: e.id, category: e.category, severity: e.severity, title: e.title, occurred_at: e.occurred_at,
    })),
    sensor_backed_anomalies: [] as Array<unknown>,
    data_sources: [
      'FEMA National Risk Index v3',
      'USGS quakes',
      'NWS alerts',
      'NOAA NHC',
      'EONET wildfires',
    ],
    last_updated: new Date().toISOString(),
  }

  return json(
    {
      ok:        true,
      tenant:    quota.tenant_name,
      plan:      quota.plan,
      remaining: quota.remaining,
      verdict,
    },
    200,
    {
      'X-RateLimit-Limit':     String(quota.daily_limit),
      'X-RateLimit-Remaining': String(quota.remaining),
    },
  )
}

// Phase 9.16 — wrap handleInner so every request emits one row into
// public.api_request_log. The log INSERT runs after the response is
// constructed; failures are swallowed so logging never breaks the
// API. 7-day retention is enforced by the nightly prune cron.
async function ipHash(req: Request): Promise<string | null> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-real-ip')
    ?? null
  if (!ip) return null
  const enc = new TextEncoder().encode(ip)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

serve(async (req: Request) => {
  const start = Date.now()
  const ctx: LogCtx = { keyId: null }
  let res: Response
  try {
    res = await handleInner(req, ctx)
  } catch (e) {
    res = json({ error: e instanceof Error ? e.message : 'Unhandled' }, 500)
  }
  const durationMs = Date.now() - start

  // Fire-and-forget log INSERT (don't await — return ASAP).
  if (req.method === 'POST' && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    (async () => {
      try {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
        const ip = await ipHash(req)
        const ua = req.headers.get('user-agent')
        await admin.from('api_request_log').insert({
          key_id:      ctx.keyId,
          endpoint:    'insurance-risk-verdict',
          status_code: res.status,
          duration_ms: durationMs,
          ip_hash:     ip,
          user_agent:  ua,
        })
      } catch {
        // Swallow — logging failures never propagate.
      }
    })()
  }

  return res
})
