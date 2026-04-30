// TerraWatch — shared helpers for the per-source ingest edge functions.
// Phase 9.0.1 split the monolithic `ingest-events` worker into one function
// per source so each gets its own ~256MB memory budget. The per-source
// functions stay tiny — fetch upstream, map to EventRow[], call runIngest()
// from this module to handle auth + upsert + prune + JSON response.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const INGEST_SECRET = Deno.env.get('INGEST_SECRET') ?? ''

export type Severity = 'safe' | 'caution' | 'danger'
export type Kind = 'seismic' | 'weather' | 'space' | 'tide' | 'ufo' | 'datasnake'

export interface EventRow {
  source: string
  external_id: string
  kind: Kind
  category: string
  severity: Severity
  title: string
  summary: string
  location: { lat: number; lon: number } | null
  location_label: string | null
  country: string | null
  region: string | null
  magnitude: number | null
  depth_km: number | null
  kp: number | null
  occurred_at: string
  expires_at: string | null
  payload: Record<string, unknown>
}

export interface UpsertResult {
  attempted: number
  upserted: number
  skipped: number
  error: string | null
}

// Hard ceiling per source per ingest run. Bump once split functions stay
// comfortably inside the worker budget for a few cycles.
export const MAX_ROWS_PER_SOURCE = 500
export const UPSERT_CHUNK = 200

const SEVERITY_RANK: Record<Severity, number> = { danger: 0, caution: 1, safe: 2 }

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ingest-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

export function quakeSeverity(m: number): Severity {
  if (m >= 5) return 'danger'
  if (m >= 3.5) return 'caution'
  return 'safe'
}

export function kpSeverity(kp: number): Severity {
  if (kp >= 7) return 'danger'
  if (kp >= 5) return 'caution'
  return 'safe'
}

export function nwsSeverity(raw: { severity?: string }): Severity {
  const s = (raw.severity ?? '').toLowerCase()
  if (s === 'extreme' || s === 'severe') return 'danger'
  if (s === 'moderate') return 'caution'
  return 'safe'
}

// NWS publishes ~120 distinct event types; we group by hazard family. Anything
// we don't recognise drops into 'weather_alert' so it still surfaces.
export function nwsCategory(event: string): string {
  const e = event.toLowerCase()
  if (e.includes('tsunami')) return 'tsunami'
  if (e.includes('tornado')) return 'tornado'
  if (e.includes('hurricane') || e.includes('tropical storm') || e.includes('typhoon')) return 'hurricane'
  if (e.includes('flood') || e.includes('seiche')) return 'flood'
  if (e.includes('thunderstorm') || e.includes('severe weather')) return 'storm'
  if (e.includes('blizzard') || e.includes('winter') || e.includes('ice storm') || e.includes('snow') || e.includes('freezing')) return 'winter_storm'
  if (e.includes('fire weather') || e.includes('red flag')) return 'fire_weather'
  if (e.includes('marine') || e.includes('gale') || e.includes('small craft') || e.includes('hurricane force wind')) return 'marine'
  if (e.includes('heat')) return 'heat'
  if (e.includes('wind') || e.includes('dust storm')) return 'wind'
  if (e.includes('avalanche')) return 'avalanche'
  if (e.includes('volcano') || e.includes('ashfall')) return 'volcano'
  if (e.includes('air quality') || e.includes('smoke')) return 'air_quality'
  return 'weather_alert'
}

export function volcanoSeverity(level: string): Severity {
  const l = (level ?? '').toLowerCase()
  if (l === 'red' || l === 'warning') return 'danger'
  if (l === 'orange' || l === 'watch') return 'caution'
  return 'safe'
}

// Take the first vertex of the first ring — O(1), accurate enough for a map pin.
export function geometryCentroid(
  geom: { type: string; coordinates: unknown } | null,
): { lat: number; lon: number } | null {
  if (!geom) return null
  try {
    if (geom.type === 'Point') {
      const [lon, lat] = geom.coordinates as [number, number]
      return { lat, lon }
    }
    if (geom.type === 'Polygon') {
      const pt = (geom.coordinates as number[][][])[0]?.[0]
      if (pt) return { lat: pt[1], lon: pt[0] }
    }
    if (geom.type === 'MultiPolygon') {
      const pt = (geom.coordinates as number[][][][])[0]?.[0]?.[0]
      if (pt) return { lat: pt[1], lon: pt[0] }
    }
  } catch {
    return null
  }
  return null
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'user-agent': 'TerraWatch/ingest (contact: ops@terrawatchapp.com)',
      accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    throw new Error(`${url} → ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as T
}

// Cap rows to MAX_ROWS_PER_SOURCE, prioritising danger > caution > safe and
// then most-recent. Sort is O(n log n); negligible vs upsert cost.
export function capRows(rows: EventRow[]): EventRow[] {
  if (rows.length <= MAX_ROWS_PER_SOURCE) return rows
  rows.sort((a, b) => {
    const sevDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    if (sevDiff !== 0) return sevDiff
    return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  })
  return rows.slice(0, MAX_ROWS_PER_SOURCE)
}

function prepareRow(r: EventRow) {
  return {
    source: r.source,
    external_id: r.external_id,
    kind: r.kind,
    category: r.category,
    severity: r.severity,
    title: r.title,
    summary: r.summary,
    location: r.location ? `SRID=4326;POINT(${r.location.lon} ${r.location.lat})` : null,
    location_label: r.location_label,
    country: r.country,
    region: r.region,
    magnitude: r.magnitude,
    depth_km: r.depth_km,
    kp: r.kp,
    occurred_at: r.occurred_at,
    expires_at: r.expires_at,
    payload: r.payload,
    ingested_at: new Date().toISOString(),
  }
}

// Chunked upserts with event-loop yields between batches.
export async function upsertRows(
  admin: ReturnType<typeof createClient>,
  rows: EventRow[],
): Promise<UpsertResult> {
  if (!rows.length) return { attempted: 0, upserted: 0, skipped: 0, error: null }
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK).map(prepareRow)
    const { error } = await admin
      .from('events')
      .upsert(chunk, { onConflict: 'source,external_id', ignoreDuplicates: false })
    if (error) {
      return { attempted: rows.length, upserted: i, skipped: 0, error: error.message }
    }
    if (i + UPSERT_CHUNK < rows.length) await new Promise<void>((r) => setTimeout(r, 0))
  }
  return { attempted: rows.length, upserted: rows.length, skipped: 0, error: null }
}

function requireSecret(req: Request): Response | null {
  if (!INGEST_SECRET) return json({ error: 'INGEST_SECRET not configured' }, 500)
  const provided = req.headers.get('x-ingest-secret') ?? ''
  if (provided !== INGEST_SECRET) return json({ error: 'Forbidden' }, 403)
  return null
}

// Standard ingest request handler: auth → fetch+map via `fn` → upsert → JSON
// response → fire-and-forget prune. Each per-source function wraps its own
// `ingestX()` with this.
export async function runIngest(
  name: string,
  fn: () => Promise<EventRow[]>,
  req: Request,
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }
  const authError = requireSecret(req)
  if (authError) return authError
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfigured' }, 500)
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const started = Date.now()
  let result: UpsertResult = { attempted: 0, upserted: 0, skipped: 0, error: null }
  let ok = true

  try {
    const rows = await fn()
    result = await upsertRows(admin, rows)
    if (result.error) {
      ok = false
      console.error(`[ingest:${name}] upsert error:`, result.error)
    }
  } catch (e) {
    ok = false
    const message = e instanceof Error ? e.message : String(e)
    result = { attempted: 0, upserted: 0, skipped: 0, error: message }
    console.error(`[ingest:${name}] fetch/parse failed:`, e)
  }

  const response = json({
    ok,
    source: name,
    durationMs: Date.now() - started,
    result,
  })

  // Prune is idempotent — running it from each of the 5 functions per hour is
  // cheap and resilient (one failed worker doesn't stop pruning).
  ;(globalThis as any).EdgeRuntime?.waitUntil(
    admin
      .rpc('events_prune')
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.error(`[ingest:${name}:prune] rpc error:`, error.message)
      })
      .catch((e: unknown) => console.error(`[ingest:${name}:prune] threw:`, e))
  )

  return response
}
