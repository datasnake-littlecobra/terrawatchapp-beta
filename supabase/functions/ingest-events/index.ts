// TerraWatch — Phase 8 ingest-events edge function.
// Invoked on a 10-minute cron from GitHub Actions. Pulls from the public
// feeds (USGS earthquakes, NOAA NWS active alerts, NOAA SWPC Kp), normalizes
// each row into the unified `events` shape, and upserts into Supabase using
// the service-role key. Auth is a shared secret (`x-ingest-secret`), so the
// function is deployed with --no-verify-jwt=true.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const INGEST_SECRET = Deno.env.get('INGEST_SECRET') ?? ''

const USGS_FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
const NWS_ALERTS_FEED = 'https://api.weather.gov/alerts/active?status=actual&message_type=alert&limit=500'
const SWPC_KP_FEED = 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ingest-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Severity = 'safe' | 'caution' | 'danger'
type Kind = 'seismic' | 'weather' | 'space' | 'tide' | 'ufo' | 'datasnake'

interface EventRow {
  source: string
  external_id: string
  kind: Kind
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function quakeSeverity(m: number): Severity {
  if (m >= 5) return 'danger'
  if (m >= 3.5) return 'caution'
  return 'safe'
}

function kpSeverity(kp: number): Severity {
  if (kp >= 7) return 'danger'
  if (kp >= 5) return 'caution'
  return 'safe'
}

function nwsSeverity(raw: { severity?: string; certainty?: string }): Severity {
  const s = (raw.severity ?? '').toLowerCase()
  if (s === 'extreme' || s === 'severe') return 'danger'
  if (s === 'moderate') return 'caution'
  return 'safe'
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
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

async function ingestSeismic(): Promise<EventRow[]> {
  interface Feature {
    id: string
    properties: {
      mag: number | null
      place: string | null
      time: number | null
      updated: number | null
      url?: string
      title?: string
    }
    geometry: { coordinates: [number, number, number] } | null
  }
  const data = await fetchJson<{ features: Feature[] }>(USGS_FEED)
  const rows: EventRow[] = []
  for (const f of data.features) {
    const mag = f.properties.mag
    const coords = f.geometry?.coordinates
    const time = f.properties.time
    if (mag == null || !coords || !time) continue
    const [lon, lat, depth] = coords
    const place = f.properties.place ?? 'Unknown location'
    rows.push({
      source: 'usgs.quakes',
      external_id: f.id,
      kind: 'seismic',
      severity: quakeSeverity(mag),
      title: `M${mag.toFixed(1)} earthquake`,
      summary: `${place} · depth ${depth.toFixed(0)} km`,
      location: { lat, lon },
      location_label: place,
      country: null,
      region: null,
      magnitude: mag,
      depth_km: depth,
      kp: null,
      occurred_at: new Date(time).toISOString(),
      expires_at: null,
      payload: { url: f.properties.url ?? null, title: f.properties.title ?? null },
    })
  }
  return rows
}

async function ingestWeather(): Promise<EventRow[]> {
  interface Alert {
    id: string
    properties: {
      event: string
      headline?: string
      description?: string
      severity?: string
      certainty?: string
      sent: string
      effective?: string
      ends?: string | null
      expires?: string | null
      areaDesc?: string
      senderName?: string
    }
    geometry: { type: string; coordinates: unknown } | null
  }
  const data = await fetchJson<{ features: Alert[] }>(NWS_ALERTS_FEED)
  const rows: EventRow[] = []
  for (const a of data.features) {
    const p = a.properties
    if (!p?.event || !p.sent) continue
    const centroid = geometryCentroid(a.geometry)
    const expires = p.ends ?? p.expires ?? null
    rows.push({
      source: 'nws.alerts',
      external_id: a.id,
      kind: 'weather',
      severity: nwsSeverity(p),
      title: p.event,
      summary: p.headline ?? (p.description?.slice(0, 240) ?? ''),
      location: centroid,
      location_label: p.areaDesc ?? null,
      country: 'US',
      region: p.areaDesc ?? null,
      magnitude: null,
      depth_km: null,
      kp: null,
      occurred_at: new Date(p.effective ?? p.sent).toISOString(),
      expires_at: expires ? new Date(expires).toISOString() : null,
      payload: {
        severity: p.severity ?? null,
        certainty: p.certainty ?? null,
        sender: p.senderName ?? null,
      },
    })
  }
  return rows
}

function geometryCentroid(geom: { type: string; coordinates: unknown } | null): { lat: number; lon: number } | null {
  if (!geom) return null
  try {
    if (geom.type === 'Point') {
      const [lon, lat] = geom.coordinates as [number, number]
      return { lat, lon }
    }
    if (geom.type === 'Polygon') {
      const ring = (geom.coordinates as number[][][])[0]
      return averageCoords(ring)
    }
    if (geom.type === 'MultiPolygon') {
      const firstRing = (geom.coordinates as number[][][][])[0]?.[0]
      if (firstRing) return averageCoords(firstRing)
    }
  } catch {
    return null
  }
  return null
}

function averageCoords(ring: number[][]): { lat: number; lon: number } | null {
  if (!ring?.length) return null
  let lon = 0, lat = 0
  for (const pt of ring) {
    lon += pt[0]
    lat += pt[1]
  }
  return { lat: lat / ring.length, lon: lon / ring.length }
}

async function ingestSpace(): Promise<EventRow[]> {
  interface Sample { time_tag: string; kp_index: number | null }
  const data = await fetchJson<Sample[]>(SWPC_KP_FEED)
  if (!Array.isArray(data) || !data.length) return []
  // The 1-minute feed is noisy; bucket by UTC hour and keep the max Kp.
  // We store every hourly bucket (even quiet ones) so the feed always has a
  // current reading — 24 rows/day is trivial and gives the client something
  // to show when geomagnetic conditions are calm.
  const buckets = new Map<string, { time: string; kp: number }>()
  for (const s of data) {
    if (s.kp_index == null || !s.time_tag) continue
    const hour = s.time_tag.slice(0, 13) // 'YYYY-MM-DDTHH'
    const cur = buckets.get(hour)
    if (!cur || s.kp_index > cur.kp) {
      buckets.set(hour, { time: s.time_tag, kp: s.kp_index })
    }
  }
  const rows: EventRow[] = []
  for (const { time, kp } of buckets.values()) {
    rows.push({
      source: 'noaa.swpc.kp',
      external_id: `kp:${time.slice(0, 13)}`,
      kind: 'space',
      severity: kpSeverity(kp),
      title: `Kp ${kp.toFixed(1)} geomagnetic ${kpSeverity(kp) === 'safe' ? 'quiet' : 'activity'}`,
      summary:
        kp >= 7
          ? 'Severe storm — GPS and HF radio likely degraded; aurora visible well outside polar regions.'
          : kp >= 5
            ? 'Minor storm — aurora possible at higher latitudes, some GPS drift.'
            : kp >= 3
              ? 'Elevated geomagnetic activity.'
              : 'Quiet geomagnetic conditions.',
      location: null,
      location_label: null,
      country: null,
      region: null,
      magnitude: null,
      depth_km: null,
      kp,
      occurred_at: new Date(time).toISOString(),
      expires_at: null,
      payload: {},
    })
  }
  return rows
}

interface UpsertResult { attempted: number; upserted: number; skipped: number; error: string | null }

async function upsertRows(
  admin: ReturnType<typeof createClient>,
  rows: EventRow[],
): Promise<UpsertResult> {
  if (!rows.length) return { attempted: 0, upserted: 0, skipped: 0, error: null }
  const prepared = rows.map((r) => ({
    source: r.source,
    external_id: r.external_id,
    kind: r.kind,
    severity: r.severity,
    title: r.title,
    summary: r.summary,
    // PostGIS accepts WKT via text input on a geography column
    location: r.location
      ? `SRID=4326;POINT(${r.location.lon} ${r.location.lat})`
      : null,
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
  }))
  const { error, count } = await admin
    .from('events')
    .upsert(prepared, { onConflict: 'source,external_id', count: 'exact', ignoreDuplicates: false })
  if (error) {
    return { attempted: rows.length, upserted: 0, skipped: 0, error: error.message }
  }
  return { attempted: rows.length, upserted: count ?? rows.length, skipped: 0, error: null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (!INGEST_SECRET) return json({ error: 'INGEST_SECRET not configured' }, 500)
  const providedSecret = req.headers.get('x-ingest-secret') ?? ''
  if (providedSecret !== INGEST_SECRET) return json({ error: 'Forbidden' }, 403)

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfigured' }, 500)
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const started = Date.now()
  const results: Record<string, UpsertResult | { error: string }> = {}

  const tasks: Array<[string, () => Promise<EventRow[]>]> = [
    ['seismic', ingestSeismic],
    ['weather', ingestWeather],
    ['space', ingestSpace],
  ]

  const outcomes = await Promise.allSettled(
    tasks.map(async ([name, fn]) => {
      const rows = await fn()
      const result = await upsertRows(admin, rows)
      return [name, result] as const
    }),
  )

  let anyFailure = false
  for (let i = 0; i < outcomes.length; i++) {
    const [name] = tasks[i]
    const outcome = outcomes[i]
    if (outcome.status === 'fulfilled') {
      const result = outcome.value[1]
      results[name] = result
      if (result.error) {
        anyFailure = true
        console.error(`[ingest:${name}] upsert error:`, result.error)
      }
    } else {
      anyFailure = true
      const message = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)
      results[name] = { error: message }
      console.error(`[ingest:${name}] fetch/parse failed:`, outcome.reason)
    }
  }

  // Best-effort prune; failure doesn't fail the whole run but is logged.
  let pruned: number | null = null
  try {
    const { data, error: pruneError } = await admin.rpc('events_prune', { older_than_days: 30 })
    if (pruneError) {
      console.error('[ingest:prune] rpc error:', pruneError.message)
    } else {
      pruned = typeof data === 'number' ? data : null
    }
  } catch (e) {
    console.error('[ingest:prune] threw:', e)
  }

  return json({
    ok: !anyFailure,
    durationMs: Date.now() - started,
    results,
    pruned,
  })
})
