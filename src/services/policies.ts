// TerraWatch — Phase 9.14: policy ingest + read for a tenant.
//
// Client-side CSV parser → row validator → POST to the policies-upload
// Edge Function. RLS-protected reads via direct table queries.

import { supabase } from './supabase'

export interface PolicyUploadRow {
  policy_id_external: string
  address?:     string
  state?:       string
  county?:      string
  county_fips?: string
  lat?:         number
  lon?:         number
  exposure_usd: number
  perils?:      string[]
  premium_usd?: number
  policy_class?: string
}

export interface PolicyRow {
  id:                 string
  policy_id_external: string
  address:            string | null
  state:              string | null
  county_fips:        string | null
  lat:                number | null
  lon:                number | null
  exposure_usd:       number
  perils:             string[]
  premium_usd:        number | null
  policy_class:       string | null
  created_at:         string
}

// =====================================================================
// CSV parsing — minimal, header-row driven, no external dep.
// =====================================================================

export interface ParseResult {
  rows:    PolicyUploadRow[]
  errors:  Array<{ line: number; error: string }>
  headers: string[]
}

const REQUIRED_HEADERS = ['policy_id_external', 'exposure_usd']
const OPTIONAL_HEADERS = ['address', 'state', 'county', 'county_fips', 'lat', 'lon', 'perils', 'premium_usd', 'policy_class']

// RFC-4180 style: comma-separated, double-quote-escaped fields.
function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let i = 0
  let inQuotes = false
  while (i < line.length) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 2; continue }
      if (c === '"') { inQuotes = false; i++; continue }
      cur += c
      i++
    } else {
      if (c === ',') { cells.push(cur); cur = ''; i++; continue }
      if (c === '"' && cur === '') { inQuotes = true; i++; continue }
      cur += c
      i++
    }
  }
  cells.push(cur)
  return cells
}

export function parsePoliciesCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (!lines.length) return { rows: [], errors: [{ line: 0, error: 'Empty CSV' }], headers: [] }

  const headers = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase())
  const errors: Array<{ line: number; error: string }> = []
  for (const req of REQUIRED_HEADERS) {
    if (!headers.includes(req)) errors.push({ line: 1, error: `Required header missing: ${req}` })
  }
  for (const h of headers) {
    if (!REQUIRED_HEADERS.includes(h) && !OPTIONAL_HEADERS.includes(h)) {
      errors.push({ line: 1, error: `Unknown header: "${h}" (ignored)` })
    }
  }

  const rows: PolicyUploadRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!)
    if (cells.length === 1 && cells[0]!.trim() === '') continue
    const obj: Record<string, string> = {}
    headers.forEach((h, j) => { obj[h] = (cells[j] ?? '').trim() })
    const exposure = Number(obj['exposure_usd'])
    if (!obj['policy_id_external']) {
      errors.push({ line: i + 1, error: 'policy_id_external required' })
      continue
    }
    if (!Number.isFinite(exposure) || exposure < 0) {
      errors.push({ line: i + 1, error: `exposure_usd not a number: "${obj['exposure_usd']}"` })
      continue
    }
    const row: PolicyUploadRow = {
      policy_id_external: obj['policy_id_external'],
      exposure_usd:       exposure,
    }
    if (obj['address'])      row.address      = obj['address']
    if (obj['state'])        row.state        = obj['state']
    if (obj['county'])       row.county       = obj['county']
    if (obj['county_fips'])  row.county_fips  = obj['county_fips']
    if (obj['lat']) {
      const v = Number(obj['lat'])
      if (!Number.isFinite(v) || v < -90 || v > 90) {
        errors.push({ line: i + 1, error: `lat out of range: "${obj['lat']}"` })
        continue
      }
      row.lat = v
    }
    if (obj['lon']) {
      const v = Number(obj['lon'])
      if (!Number.isFinite(v) || v < -180 || v > 180) {
        errors.push({ line: i + 1, error: `lon out of range: "${obj['lon']}"` })
        continue
      }
      row.lon = v
    }
    if (obj['premium_usd']) {
      const v = Number(obj['premium_usd'])
      if (!Number.isFinite(v) || v < 0) {
        errors.push({ line: i + 1, error: `premium_usd must be non-negative: "${obj['premium_usd']}"` })
        continue
      }
      row.premium_usd = v
    }
    if (obj['policy_class']) row.policy_class = obj['policy_class']
    if (obj['perils']) {
      row.perils = obj['perils'].split(/[;|]/).map((p) => p.trim()).filter(Boolean)
    }
    rows.push(row)
  }
  return { rows, errors, headers }
}

// =====================================================================
// Upload — hits the Edge Function
// =====================================================================

export interface UploadResult {
  ok:           boolean
  tenant_id:    string
  submitted:    number
  inserted:     number
  failed:       number
  errors:       Array<{ index: number; error: string }>
  total_after:  number
}

export async function uploadPolicies(tenantId: string, rows: PolicyUploadRow[]): Promise<UploadResult> {
  if (!supabase) throw new Error('Supabase not configured')
  const session = (await supabase.auth.getSession()).data.session
  if (!session) throw new Error('Not signed in')
  const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
  const url = `${baseUrl}/functions/v1/policies-upload`
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ tenant_id: tenantId, rows }),
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) {
    throw new Error(body.error || `Upload failed (HTTP ${r.status})`)
  }
  return body as UploadResult
}

// =====================================================================
// Read — RLS-protected direct query
// =====================================================================

export async function fetchTenantPolicies(tenantId: string, limit = 5000): Promise<PolicyRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('policies')
    .select('id, policy_id_external, address, state, county_fips, lat, lon, exposure_usd, perils, premium_usd, policy_class, created_at')
    .eq('tenant_id', tenantId)
    .order('exposure_usd', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as PolicyRow[]).map((r) => ({
    ...r,
    exposure_usd: Number(r.exposure_usd),
    premium_usd:  r.premium_usd != null ? Number(r.premium_usd) : null,
  }))
}
