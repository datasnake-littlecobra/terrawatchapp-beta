// TerraWatch — Phase 9.18.1: NOAA NWS Observations ingester.
//
// Hourly cron. Pulls latest METAR observations from NOAA's NWS
// Observations API for every public.sensors row where source =
// 'noaa-nws' (seeded in migration 0039), parses the JSON, writes
// to public.measurements as parameter rows
// (precipitation_mm_1h, air_temp_c, humidity_pct,
// wind_speed_mps, pressure_hpa).
//
// Powers the /weather-intelligence/flash-flood page — that view
// calls public.weather_flash_flood_score(sensor_id) which reads
// the precipitation_mm_1h rows this function writes.
//
// Data source: https://api.weather.gov/stations/{stationId}/observations/latest
//   - Free, no auth.
//   - Per-station endpoint (one HTTP call per station per cycle).
//   - Returns JSON with SI-unit values + WMO unit codes.
//
// Auth: shared INGEST_SECRET via x-ingest-secret header (same
// pattern as the other Phase 9.0.1 ingesters).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.3'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')              ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const INGEST_SECRET             = Deno.env.get('INGEST_SECRET')             ?? ''

const NWS_OBS_BASE = 'https://api.weather.gov/stations'
const USER_AGENT   = 'TerraWatch (datasnake-littlecobra/terrawatchapp-beta; ops@datasnake.io)'
const UPSERT_CHUNK = 500

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
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
  id:       string
  metadata: Record<string, unknown> | null
}

interface MeasurementRow {
  sensor_id:   string
  parameter:   string
  value:       number
  unit:        string
  observed_at: string
}

// NOAA NWS observation JSON shape (the bits we care about).
interface NwsObservation {
  properties?: {
    timestamp?:                    string
    temperature?:                  { value: number | null; unitCode?: string }
    relativeHumidity?:             { value: number | null; unitCode?: string }
    windSpeed?:                    { value: number | null; unitCode?: string }
    barometricPressure?:           { value: number | null; unitCode?: string }
    precipitationLastHour?:        { value: number | null; unitCode?: string }
    precipitationLast3Hours?:      { value: number | null; unitCode?: string }
    precipitationLast6Hours?:      { value: number | null; unitCode?: string }
  }
}

// Parameter mapping: (NWS field, our parameter key, our unit, NWS native unit).
// All values are converted to the unit listed in the third column.
const PARAMS: Array<{
  field: keyof NonNullable<NwsObservation['properties']>
  key:   string
  unit:  string
  conv?: (v: number, nwsUnit: string) => number | null
}> = [
  {
    field: 'temperature',
    key:   'air_temp_c',
    unit:  '°C',
    // NWS returns wmoUnit:degC natively.
    conv:  (v) => v,
  },
  {
    field: 'relativeHumidity',
    key:   'humidity_pct',
    unit:  '%',
    conv:  (v) => v,
  },
  {
    field: 'windSpeed',
    key:   'wind_speed_mps',
    unit:  'm/s',
    // NWS returns wmoUnit:km_h-1 natively. Convert km/h → m/s.
    conv:  (v, u) => (u?.includes('km_h') ? v / 3.6 : v),
  },
  {
    field: 'barometricPressure',
    key:   'pressure_hpa',
    unit:  'hPa',
    // NWS returns wmoUnit:Pa natively. Convert Pa → hPa.
    conv:  (v, u) => (u?.includes('Pa') && !u?.includes('hPa') ? v / 100 : v),
  },
  {
    field: 'precipitationLastHour',
    key:   'precipitation_mm_1h',
    unit:  'mm',
    // NWS returns wmoUnit:mm natively. The flash-flood RPC sums
    // these for the trailing 6h window.
    conv:  (v) => v,
  },
]

async function fetchOne(stationId: string): Promise<NwsObservation | null> {
  const url = `${NWS_OBS_BASE}/${encodeURIComponent(stationId)}/observations/latest`
  const r = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept':     'application/geo+json',
    },
  })
  if (!r.ok) {
    console.error(`[ingest:noaa-nws] ${stationId} → HTTP ${r.status}`)
    return null
  }
  return (await r.json()) as NwsObservation
}

async function ingestNoaaNwsObs(): Promise<{ stations: number; observations: number; error: string | null }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { stations: 0, observations: 0, error: 'Server misconfigured' }
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Load registered NWS sensors from public.sensors.
  const { data: sensorRows, error: sensorErr } = await admin
    .from('sensors')
    .select('id, metadata')
    .eq('source', 'noaa-nws')
    .eq('active', true)
  if (sensorErr) {
    console.error('[ingest:noaa-nws] sensors fetch failed:', sensorErr.message)
    return { stations: 0, observations: 0, error: sensorErr.message }
  }
  const sensors = (sensorRows ?? []) as SensorRow[]
  console.log(`[ingest:noaa-nws] ${sensors.length} stations registered`)

  // 2. Fetch latest observation per station.
  const measRows: MeasurementRow[] = []
  let okStations = 0
  for (const s of sensors) {
    const stationId = (s.metadata?.['station_id'] as string | undefined) ?? ''
    if (!stationId) {
      console.warn(`[ingest:noaa-nws] ${s.id}: no station_id in metadata`)
      continue
    }
    const obs = await fetchOne(stationId)
    if (!obs?.properties?.timestamp) continue
    okStations++
    const observedAt = obs.properties.timestamp

    for (const p of PARAMS) {
      const slot = (obs.properties as Record<string, { value: number | null; unitCode?: string } | undefined>)[p.field as string]
      const raw = slot?.value
      if (raw == null || !Number.isFinite(raw)) continue
      const converted = p.conv ? p.conv(raw, slot?.unitCode ?? '') : raw
      if (converted == null || !Number.isFinite(converted)) continue
      measRows.push({
        sensor_id:   s.id,
        parameter:   p.key,
        value:       converted,
        unit:        p.unit,
        observed_at: observedAt,
      })
    }
  }

  // 3. Bulk upsert into measurements.
  if (measRows.length === 0) {
    return { stations: okStations, observations: 0, error: null }
  }
  for (let i = 0; i < measRows.length; i += UPSERT_CHUNK) {
    const chunk = measRows.slice(i, i + UPSERT_CHUNK)
    const { error } = await admin
      .from('measurements')
      .upsert(chunk, {
        onConflict: 'sensor_id,parameter,observed_at',
        ignoreDuplicates: true,
      })
    if (error) {
      console.error('[ingest:noaa-nws] measurement upsert failed:', error.message)
      return { stations: okStations, observations: i, error: error.message }
    }
  }
  return { stations: okStations, observations: measRows.length, error: null }
}

function requireSecret(req: Request): Response | null {
  if (!INGEST_SECRET) return json({ error: 'INGEST_SECRET not configured' }, 500)
  const provided = req.headers.get('x-ingest-secret') ?? ''
  if (provided !== INGEST_SECRET) return json({ error: 'Forbidden' }, 403)
  return null
}

serve(async (req) => {
  console.log(`[ingest:noaa-nws] ${req.method} ${req.url}`)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)

  const authError = requireSecret(req)
  if (authError) return authError

  const started = Date.now()
  try {
    const result = await ingestNoaaNwsObs()
    return json({
      ok:         result.error == null,
      source:     'noaa-nws',
      durationMs: Date.now() - started,
      result,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[ingest:noaa-nws] fetch/parse failed:', e)
    return json({
      ok:         false,
      source:     'noaa-nws',
      durationMs: Date.now() - started,
      error:      message,
    }, 502)
  }
})
