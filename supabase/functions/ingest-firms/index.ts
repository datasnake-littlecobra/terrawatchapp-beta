// TerraWatch — Phase 9.18.2: NASA FIRMS VIIRS active fire ingester.
//
// Hourly cron at :38 via x-ingest-secret. Pulls the last 1 day of
// VIIRS SNPP + NOAA-21 NRT detections from the FIRMS API, filters to
// confidence !== 'low', upserts to public.firms_active_fires, then
// deletes rows older than 7 days (rolling window).
//
// Requires:
//   FIRMS_MAP_KEY — free from NASA Earthdata (earthdata.nasa.gov).
//   If absent, returns { ok: true, skipped: true } silently so the
//   cron does not produce error logs before the key is configured.
//
// FIRMS CSV header:
//   latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,
//   satellite,instrument,confidence,version,bright_ti5,frp,daynight,type
//
// Auth: x-ingest-secret header (same as Phase 9.0.1 ingesters).

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.3'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')              ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const INGEST_SECRET             = Deno.env.get('INGEST_SECRET')             ?? ''
const FIRMS_MAP_KEY             = Deno.env.get('FIRMS_MAP_KEY')             ?? ''

const FIRMS_BASE   = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv'
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

interface FirmsInsertRow {
  lat:          number
  lon:          number
  location:     string
  brightness:   number | null
  frp:          number | null
  confidence:   string | null
  satellite:    string | null
  acq_datetime: string
}

function parseFirmsCsv(csv: string): FirmsInsertRow[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())

  const col = (name: string) => header.indexOf(name)
  const iLat    = col('latitude')
  const iLon    = col('longitude')
  const iBright = col('bright_ti4')
  const iFrp    = col('frp')
  const iConf   = col('confidence')
  const iSat    = col('satellite')
  const iDate   = col('acq_date')
  const iTime   = col('acq_time')

  if (iLat < 0 || iLon < 0 || iDate < 0 || iTime < 0) {
    console.error('[ingest-firms] unexpected CSV header:', lines[0])
    return []
  }

  const rows: FirmsInsertRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',')
    if (parts.length < header.length) continue

    const lat = parseFloat(parts[iLat])
    const lon = parseFloat(parts[iLon])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    // acq_date = 'YYYY-MM-DD', acq_time = 'HHMM' UTC
    const acqDate = (parts[iDate] ?? '').trim()
    const raw4    = (parts[iTime] ?? '').trim().padStart(4, '0')
    const acqDatetime = `${acqDate}T${raw4.slice(0, 2)}:${raw4.slice(2)}:00Z`

    const rawConf = (parts[iConf] ?? '').trim().toLowerCase()
    const confidence =
      rawConf === 'h' || rawConf === 'high'    ? 'high' :
      rawConf === 'n' || rawConf === 'nominal' ? 'nominal' : 'low'

    const bright = iBright >= 0 ? parseFloat(parts[iBright]) : NaN
    const frp    = iFrp    >= 0 ? parseFloat(parts[iFrp])    : NaN

    rows.push({
      lat,
      lon,
      location:     `SRID=4326;POINT(${lon} ${lat})`,
      brightness:   Number.isFinite(bright) ? bright : null,
      frp:          Number.isFinite(frp)    ? frp    : null,
      confidence,
      satellite:    iSat >= 0 ? ((parts[iSat] ?? '').trim() || null) : null,
      acq_datetime: acqDatetime,
    })
  }
  return rows
}

async function fetchFirmsSource(
  source: 'VIIRS_SNPP_NRT' | 'VIIRS_NOAA21_NRT',
): Promise<FirmsInsertRow[]> {
  const url = `${FIRMS_BASE}/${FIRMS_MAP_KEY}/${source}/world/1`
  console.log(`[ingest-firms] fetching ${source}`)
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!r.ok) {
    console.error(`[ingest-firms] ${source} HTTP ${r.status}`)
    return []
  }
  return parseFirmsCsv(await r.text())
}

serve(async (req) => {
  console.log(`[ingest-firms] ${req.method}`)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)

  const ingestSecret = req.headers.get('x-ingest-secret') ?? ''
  if (!INGEST_SECRET || ingestSecret !== INGEST_SECRET) {
    return json({ error: 'Unauthorized' }, 401)
  }

  if (!FIRMS_MAP_KEY) {
    console.log('[ingest-firms] FIRMS_MAP_KEY not configured — skipping')
    return json({ ok: true, skipped: true, reason: 'FIRMS_MAP_KEY not set' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfigured (SUPABASE secrets)' }, 500)
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const [snppRows, noaa21Rows] = await Promise.all([
    fetchFirmsSource('VIIRS_SNPP_NRT'),
    fetchFirmsSource('VIIRS_NOAA21_NRT'),
  ])

  // Deduplicate across both satellites, drop low-confidence detections.
  const seen = new Set<string>()
  const allRows: FirmsInsertRow[] = []
  for (const r of [...snppRows, ...noaa21Rows]) {
    if (r.confidence === 'low') continue
    const key = `${r.lat}|${r.lon}|${r.acq_datetime}`
    if (seen.has(key)) continue
    seen.add(key)
    allRows.push(r)
  }

  console.log(`[ingest-firms] ${allRows.length} nominal+high detections after dedup`)

  let upserted = 0
  for (let i = 0; i < allRows.length; i += UPSERT_CHUNK) {
    const chunk = allRows.slice(i, i + UPSERT_CHUNK)
    const { error } = await admin
      .from('firms_active_fires')
      .upsert(chunk, { onConflict: 'lat,lon,acq_datetime', ignoreDuplicates: true })
    if (error) {
      console.error(`[ingest-firms] upsert chunk ${i}:`, error.message)
    } else {
      upserted += chunk.length
    }
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { error: deleteErr, count: deleted } = await admin
    .from('firms_active_fires')
    .delete({ count: 'exact' })
    .lt('acq_datetime', cutoff)
  if (deleteErr) console.error('[ingest-firms] purge:', deleteErr.message)

  console.log(`[ingest-firms] done — upserted=${upserted} deleted=${deleted ?? 0}`)
  return json({ ok: true, upserted, deleted: deleted ?? 0 })
})
