// TerraWatch — Phase 9.12: seed-fema-nri edge function.
//
// One-shot bulk loader for the FEMA National Risk Index, county-level CSV.
// Triggered manually via the `seed-fema-nri` GitHub Actions workflow_dispatch
// or by curl from the operator's machine. Idempotent on `county_fips` so
// re-running with a fresh CSV is safe.
//
// FEMA publishes the source as a ZIP wrapping a CSV. Deno's std doesn't
// have a built-in ZIP reader, so this function takes a *plain CSV URL*
// instead — the operator unpacks the ZIP locally (or uploads the CSV to a
// public bucket) and passes the URL via request body or
// FEMA_NRI_CSV_URL env var. Honest about the manual step; documented in
// DEPLOY.md.
//
// Auth: same x-ingest-secret header pattern as the per-source ingest
// functions (Phase 9.0.1).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { parse as parseCsv } from 'https://deno.land/std@0.224.0/csv/parse.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.3'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const INGEST_SECRET             = Deno.env.get('INGEST_SECRET') ?? ''
const DEFAULT_CSV_URL           = Deno.env.get('FEMA_NRI_CSV_URL') ?? ''

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

function requireSecret(req: Request): Response | null {
  if (!INGEST_SECRET) return json({ error: 'INGEST_SECRET not configured' }, 500)
  const provided = req.headers.get('x-ingest-secret') ?? ''
  if (provided !== INGEST_SECRET) return json({ error: 'Forbidden' }, 403)
  return null
}

interface FemaRow {
  county_fips:                string
  state:                      string
  state_abbrev:               string | null
  county_name:                string
  population:                 number | null
  building_value_usd:         number | null
  area_sq_mi:                 number | null
  risk_score:                 number | null
  risk_rating:                string | null
  expected_annual_loss_total: number | null
  social_vulnerability:       number | null
  community_resilience:       number | null
  eal_flood:                  number | null
  eal_wildfire:               number | null
  eal_hurricane:              number | null
  eal_tornado:                number | null
  eal_earthquake:             number | null
  eal_other:                  Record<string, number | null>
  lat:                        number | null
  lon:                        number | null
  updated_at:                 string
}

// Hazards we keep in eal_other. Each FEMA NRI column is `<HAZ>_EALT`
// (Expected Annual Loss Total) per hazard 4-letter code.
const OTHER_HAZARD_CODES = [
  'AVLN', 'CWAV', 'DRGT', 'HAIL', 'HWAV',
  'ISTM', 'LNDS', 'LTNG', 'SWND', 'TSUN',
  'VLCN', 'WNTW',
] as const

function numOrNull(raw: string | undefined): number | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed.toUpperCase() === 'NA' || trimmed.toUpperCase() === 'NULL') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

function strOrNull(raw: string | undefined): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  return trimmed === '' ? null : trimmed
}

function pad5(s: string | undefined): string | null {
  if (!s) return null
  const cleaned = s.replace(/\D/g, '')
  if (!cleaned) return null
  return cleaned.padStart(5, '0').slice(-5)
}

function rowFromCsv(rec: Record<string, string>): FemaRow | null {
  // FEMA NRI uses STCOFIPS; some derivative releases use COUNTYFIPS or
  // GEOID. Accept all three.
  const fips = pad5(rec['STCOFIPS'] ?? rec['COUNTYFIPS'] ?? rec['GEOID'] ?? rec['geoid'])
  if (!fips) return null

  const state       = strOrNull(rec['STATE']     ?? rec['state'])
  const stateAbbrev = strOrNull(rec['STATEABBRV'] ?? rec['state_abbrev'])
  const countyName  = strOrNull(rec['COUNTY']    ?? rec['county'])
  if (!state || !countyName) return null

  // Per-hazard total EAL (USD). Coastal + riverine roll up into "flood".
  const cflEal = numOrNull(rec['CFLD_EALT'])
  const rflEal = numOrNull(rec['RFLD_EALT'])
  const flood  = (cflEal == null && rflEal == null)
    ? null
    : (cflEal ?? 0) + (rflEal ?? 0)

  // Catch-all bag for remaining hazards. Stored as plain JSON keyed by
  // FEMA's 4-letter hazard code.
  const eal_other: Record<string, number | null> = {}
  for (const code of OTHER_HAZARD_CODES) {
    const v = numOrNull(rec[`${code}_EALT`])
    if (v != null) eal_other[code] = v
  }
  // Coastal-flood and riverine-flood both go into eal_flood, but we keep
  // them in eal_other too so analysts can split them later if needed.
  if (cflEal != null) eal_other['CFLD'] = cflEal
  if (rflEal != null) eal_other['RFLD'] = rflEal

  // Some derivative releases include centroid columns (LAT, LON or
  // CENTROID_LAT etc.). Default null otherwise — the schema is nullable.
  const lat = numOrNull(rec['LAT']  ?? rec['CENTROID_LAT'] ?? rec['lat'])
  const lon = numOrNull(rec['LON']  ?? rec['CENTROID_LON'] ?? rec['lon'])

  return {
    county_fips:                fips,
    state,
    state_abbrev:               stateAbbrev,
    county_name:                countyName,
    population:                 numOrNull(rec['POPULATION']) as number | null,
    building_value_usd:         numOrNull(rec['BUILDVALUE']),
    area_sq_mi:                 numOrNull(rec['AREA']),
    risk_score:                 numOrNull(rec['RISK_SCORE']),
    risk_rating:                strOrNull(rec['RISK_RATNG']),
    expected_annual_loss_total: numOrNull(rec['EAL_VALT']),
    social_vulnerability:       numOrNull(rec['SOVI_SCORE']),
    community_resilience:       numOrNull(rec['RESL_SCORE']),
    eal_flood:                  flood,
    eal_wildfire:               numOrNull(rec['WFIR_EALT']),
    eal_hurricane:              numOrNull(rec['HRCN_EALT']),
    eal_tornado:                numOrNull(rec['TRND_EALT']),
    eal_earthquake:             numOrNull(rec['ERQK_EALT']),
    eal_other:                  Object.keys(eal_other).length ? eal_other : {},
    lat,
    lon,
    updated_at:                 new Date().toISOString(),
  }
}

async function fetchCsvText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'TerraWatch/seed-fema-nri (contact: ops@terrawatchapp.com)',
      accept: 'text/csv, text/plain, */*',
    },
  })
  if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`)
  return await res.text()
}

const UPSERT_CHUNK = 500

async function seed(opts: {
  csvUrl: string
  dryRun: boolean
}): Promise<{
  ok: boolean
  fetched: number
  parsed: number
  upserted: number
  sample: FemaRow | null
  error: string | null
}> {
  const text = await fetchCsvText(opts.csvUrl)
  const records = parseCsv(text, { skipFirstRow: true, strip: true }) as Record<string, string>[]
  const rows: FemaRow[] = []
  for (const rec of records) {
    const row = rowFromCsv(rec)
    if (row) rows.push(row)
  }
  if (rows.length === 0) {
    return { ok: false, fetched: records.length, parsed: 0, upserted: 0, sample: null, error: 'CSV parsed to 0 valid rows — column-name mismatch?' }
  }

  if (opts.dryRun) {
    return { ok: true, fetched: records.length, parsed: rows.length, upserted: 0, sample: rows[0] ?? null, error: null }
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let upserted = 0
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK)
    const { error } = await admin
      .from('fema_nri')
      .upsert(chunk, { onConflict: 'county_fips', ignoreDuplicates: false })
    if (error) {
      console.error('[seed-fema-nri] upsert chunk failed:', error.message)
      return { ok: false, fetched: records.length, parsed: rows.length, upserted, sample: rows[0] ?? null, error: error.message }
    }
    upserted += chunk.length
    if (i + UPSERT_CHUNK < rows.length) await new Promise((r) => setTimeout(r, 0))
  }

  return { ok: true, fetched: records.length, parsed: rows.length, upserted, sample: rows[0] ?? null, error: null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405)

  const authError = requireSecret(req)
  if (authError) return authError
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfigured' }, 500)
  }

  let body: { csv_url?: string; dry_run?: boolean } = {}
  try {
    const text = await req.text()
    if (text.trim().length) body = JSON.parse(text) as typeof body
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const csvUrl = body.csv_url ?? DEFAULT_CSV_URL
  if (!csvUrl) {
    return json({
      error: 'csv_url not provided. Pass via request body { "csv_url": "..." } or set FEMA_NRI_CSV_URL env var.',
    }, 400)
  }

  const started = Date.now()
  try {
    const result = await seed({ csvUrl, dryRun: body.dry_run === true })
    return json({
      source: 'fema-nri',
      durationMs: Date.now() - started,
      csvUrl,
      ...result,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[seed-fema-nri] failed:', e)
    return json({
      ok: false,
      source: 'fema-nri',
      durationMs: Date.now() - started,
      csvUrl,
      error: message,
    }, 502)
  }
})
