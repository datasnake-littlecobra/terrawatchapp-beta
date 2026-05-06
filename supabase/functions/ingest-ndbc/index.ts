// TerraWatch — Phase 9.6: ingest-ndbc edge function.
//
// NOAA National Data Buoy Center bulk latest-observations feed. Single
// fixed-width text endpoint (~250KB, ~1500 stations) parsed into the
// time-series measurements table. Public-tier source — DataSnake submarine
// telemetry will plug into the same tables later as 'proprietary' tier
// (no schema change, just inserts).
//
// This function is intentionally independent of _shared/ingest-common.ts
// because the row shape is different (measurements, not events). It still
// uses the same x-ingest-secret + service-role-client pattern for
// consistency with the rest of the cron pipeline.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const INGEST_SECRET = Deno.env.get('INGEST_SECRET') ?? ''

const NDBC_FEED = 'https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ingest-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

interface SensorRow {
  id: string
  source: 'ndbc'
  source_tier: 'public'
  name: string
  domain: 'ocean'
  location: string | null    // 'SRID=4326;POINT(lon lat)' or null
  metadata: Record<string, unknown>
  active: true
}

interface MeasurementRow {
  sensor_id: string
  parameter: string
  value: number
  unit: string
  observed_at: string
}

// NDBC bulk feed columns (header line in the actual response):
//   #STN  LAT  LON  YYYY MM DD hh mm  WDIR WSPD GST  WVHT DPD  APD MWD  PRES  PTDY ATMP WTMP DEWP VIS PTDY TIDE
// Parameters we surface, with unit + display name:
const PARAMS: Array<{ col: string; key: string; unit: string }> = [
  { col: 'WDIR', key: 'wind_dir_deg',     unit: '°'   },
  { col: 'WSPD', key: 'wind_speed_mps',   unit: 'm/s' },
  { col: 'GST',  key: 'gust_mps',         unit: 'm/s' },
  { col: 'WVHT', key: 'wave_height_m',    unit: 'm'   },
  { col: 'DPD',  key: 'wave_period_s',    unit: 's'   },
  { col: 'MWD',  key: 'wave_dir_deg',     unit: '°'   },
  { col: 'PRES', key: 'pressure_hpa',     unit: 'hPa' },
  { col: 'ATMP', key: 'air_temp_c',       unit: '°C'  },
  { col: 'WTMP', key: 'sst_c',            unit: '°C'  },
  { col: 'DEWP', key: 'dew_point_c',      unit: '°C'  },
]

interface ParsedStation {
  id: string
  lat: number | null
  lon: number | null
  observed_at: string
  values: Map<string, number>  // column → value
}

// NDBC header is the first line starting with '#STN'. Subsequent lines are
// space-delimited records. Missing values are 'MM' or sometimes a literal
// empty string after split.
function parseFeed(text: string): ParsedStation[] {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []

  // Find the header line (first line starting with '#STN' — there's a unit
  // line right after that we skip).
  const headerIdx = lines.findIndex((l) => l.trim().startsWith('#STN'))
  if (headerIdx === -1) return []

  const header = lines[headerIdx].replace(/^#/, '').trim().split(/\s+/)
  const dataLines = lines.slice(headerIdx + 1).filter((l) => !l.startsWith('#'))

  const stations: ParsedStation[] = []
  for (const line of dataLines) {
    const cols = line.trim().split(/\s+/)
    if (cols.length < header.length) continue

    const get = (name: string): string | undefined => {
      const idx = header.indexOf(name)
      return idx >= 0 ? cols[idx] : undefined
    }
    const numOrNull = (s: string | undefined): number | null => {
      if (!s || s === 'MM' || s === 'NA') return null
      const n = Number(s)
      return Number.isFinite(n) ? n : null
    }

    const stn = get('STN')
    if (!stn) continue
    const lat = numOrNull(get('LAT'))
    const lon = numOrNull(get('LON'))

    // Build observation timestamp from YYYY/MM/DD/hh/mm columns. NDBC publishes
    // in UTC. If any timestamp component is missing, skip the row entirely —
    // we don't want to pollute the table with rows we can't time-order.
    const yyyy = numOrNull(get('YYYY'))
    const mm = numOrNull(get('MM'))
    const dd = numOrNull(get('DD'))
    const hh = numOrNull(get('hh'))
    const min = numOrNull(get('mm'))
    if (yyyy == null || mm == null || dd == null || hh == null || min == null) continue
    const observed = new Date(Date.UTC(yyyy, mm - 1, dd, hh, min, 0))
    if (Number.isNaN(observed.getTime())) continue

    const values = new Map<string, number>()
    for (const p of PARAMS) {
      const v = numOrNull(get(p.col))
      if (v != null) values.set(p.col, v)
    }

    stations.push({
      id: `ndbc:${stn}`,
      lat,
      lon,
      observed_at: observed.toISOString(),
      values,
    })
  }
  return stations
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'user-agent': 'TerraWatch/ingest (contact: ops@terrawatchapp.com)' },
  })
  if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`)
  return await res.text()
}

const UPSERT_CHUNK = 500

async function ingestNdbc(): Promise<{ stations: number; observations: number; error: string | null }> {
  const text = await fetchText(NDBC_FEED)
  const stations = parseFeed(text)
  if (stations.length === 0) {
    console.warn('[ingest:ndbc] feed parsed to 0 stations — bulk endpoint may have changed shape')
    return { stations: 0, observations: 0, error: 'empty feed' }
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Upsert sensor rows — first time seen, insert; on conflict, update name/loc
  // in case stations move or get renamed. metadata + active stay as-is.
  const sensorRows: SensorRow[] = stations.map((s) => ({
    id: s.id,
    source: 'ndbc',
    source_tier: 'public',
    name: s.id.replace('ndbc:', 'NDBC '),  // human-readable; better names not in bulk feed
    domain: 'ocean',
    location: s.lat != null && s.lon != null ? `SRID=4326;POINT(${s.lon} ${s.lat})` : null,
    metadata: { station_id: s.id.replace('ndbc:', '') },
    active: true,
  }))

  for (let i = 0; i < sensorRows.length; i += UPSERT_CHUNK) {
    const chunk = sensorRows.slice(i, i + UPSERT_CHUNK)
    const { error } = await admin
      .from('sensors')
      .upsert(chunk, { onConflict: 'id', ignoreDuplicates: false })
    if (error) {
      console.error('[ingest:ndbc] sensor upsert failed:', error.message)
      return { stations: 0, observations: 0, error: error.message }
    }
    if (i + UPSERT_CHUNK < sensorRows.length) await new Promise((r) => setTimeout(r, 0))
  }

  // Build measurement rows — one per (station, parameter) where the station
  // actually reported that parameter this cycle.
  const measRows: MeasurementRow[] = []
  for (const s of stations) {
    for (const p of PARAMS) {
      const v = s.values.get(p.col)
      if (v == null) continue
      measRows.push({
        sensor_id: s.id,
        parameter: p.key,
        value: v,
        unit: p.unit,
        observed_at: s.observed_at,
      })
    }
  }

  if (measRows.length === 0) {
    return { stations: stations.length, observations: 0, error: null }
  }

  for (let i = 0; i < measRows.length; i += UPSERT_CHUNK) {
    const chunk = measRows.slice(i, i + UPSERT_CHUNK)
    const { error } = await admin
      .from('measurements')
      .upsert(chunk, {
        onConflict: 'sensor_id,parameter,observed_at',
        ignoreDuplicates: true,  // same (sensor, param, time) always means same value
      })
    if (error) {
      console.error('[ingest:ndbc] measurement upsert failed:', error.message)
      return { stations: stations.length, observations: i, error: error.message }
    }
    if (i + UPSERT_CHUNK < measRows.length) await new Promise((r) => setTimeout(r, 0))
  }

  return { stations: stations.length, observations: measRows.length, error: null }
}

function requireSecret(req: Request): Response | null {
  if (!INGEST_SECRET) return json({ error: 'INGEST_SECRET not configured' }, 500)
  const provided = req.headers.get('x-ingest-secret') ?? ''
  if (provided !== INGEST_SECRET) return json({ error: 'Forbidden' }, 403)
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authError = requireSecret(req)
  if (authError) return authError
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfigured' }, 500)
  }

  const started = Date.now()
  try {
    const result = await ingestNdbc()
    return json({
      ok: result.error == null,
      source: 'ndbc',
      durationMs: Date.now() - started,
      result,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[ingest:ndbc] fetch/parse failed:', e)
    return json({
      ok: false,
      source: 'ndbc',
      durationMs: Date.now() - started,
      error: message,
    }, 502)
  }
})
