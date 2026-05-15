// TerraWatch — Phase 9.14: bulk CSV ingest for tenant policy books.
//
// POST /functions/v1/policies-upload
// Auth: Authorization: Bearer <user JWT>
// Body: { tenant_id: uuid, rows: PolicyRow[] }
//
// The client parses the CSV in the browser (so the user sees errors
// immediately) and POSTs validated rows here. Server-side this
// function:
//   1. Validates the JWT, extracts user_id.
//   2. Verifies the user is an owner|member of tenant_id.
//   3. Enforces tenant.policy_limit (total rows after insert).
//   4. Resolves county_fips from (state, county) when missing.
//   5. Bulk-upserts up to 50,000 rows in chunks of 500.
//
// Returns: { ok, inserted, updated, errors, total_after }.

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

interface PolicyRow {
  policy_id_external: string
  address?:    string
  state?:      string
  county?:     string                 // resolved to county_fips server-side
  county_fips?: string
  lat?:        number
  lon?:        number
  exposure_usd: number
  perils?:     string[]
  premium_usd?: number
  policy_class?: string
}

const MAX_ROWS_PER_REQUEST = 50_000
const CHUNK_SIZE = 500

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfigured' }, 500)
  }

  // ---- Auth ---------------------------------------------------------
  const authHeader = req.headers.get('authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return json({ error: 'Missing Authorization: Bearer <user-jwt>' }, 401)

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)
  const userId = userData.user.id

  // ---- Body ---------------------------------------------------------
  let body: { tenant_id: string; rows: PolicyRow[] }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body must be JSON' }, 400)
  }
  if (!body?.tenant_id || !Array.isArray(body.rows)) {
    return json({ error: 'Body shape: { tenant_id, rows }' }, 400)
  }
  if (body.rows.length === 0) return json({ error: 'No rows' }, 400)
  if (body.rows.length > MAX_ROWS_PER_REQUEST) {
    return json({ error: `Max ${MAX_ROWS_PER_REQUEST} rows per request` }, 413)
  }

  // ---- Membership check --------------------------------------------
  const { data: memberRows, error: memberErr } = await admin
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', body.tenant_id)
    .eq('user_id', userId)
    .maybeSingle()
  if (memberErr) return json({ error: 'Member lookup failed', detail: memberErr.message }, 500)
  const role = (memberRows as { role?: string } | null)?.role
  if (!role || !['owner', 'member'].includes(role)) {
    return json({ error: 'Forbidden: not a writer for this tenant' }, 403)
  }

  // ---- Policy_limit check ------------------------------------------
  const { data: tenantRow, error: tenantErr } = await admin
    .from('tenants')
    .select('policy_limit')
    .eq('id', body.tenant_id)
    .maybeSingle()
  if (tenantErr || !tenantRow) return json({ error: 'Tenant not found' }, 404)
  const limit = (tenantRow as { policy_limit: number }).policy_limit

  const { count: existingCount, error: countErr } = await admin
    .from('policies')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', body.tenant_id)
  if (countErr) return json({ error: 'Count check failed' }, 500)
  const remainingCapacity = Math.max(0, limit - (existingCount ?? 0))
  if (body.rows.length > remainingCapacity) {
    return json({
      error: `Tenant policy_limit (${limit}) exceeded`,
      existing: existingCount ?? 0,
      attempted: body.rows.length,
      remaining_capacity: remainingCapacity,
    }, 413)
  }

  // ---- County FIPS resolution --------------------------------------
  // For rows missing county_fips but supplying (state, county), look
  // them up in fema_nri in batch. State+county is the common case
  // for an insurer who has address strings but no FIPS column.
  const needLookup = body.rows.filter((r) => !r.county_fips && r.state && r.county)
  const lookupKey = (s: string, c: string) => `${s.toLowerCase().trim()}|${c.toLowerCase().trim()}`
  const fipsByKey = new Map<string, string>()
  if (needLookup.length) {
    const states  = [...new Set(needLookup.map((r) => r.state!.trim()).filter(Boolean))]
    const { data: fipsRows } = await admin
      .from('fema_nri')
      .select('county_fips, state, county_name')
      .in('state', states)
    for (const r of (fipsRows ?? []) as Array<{ county_fips: string; state: string; county_name: string }>) {
      fipsByKey.set(lookupKey(r.state, r.county_name), r.county_fips)
    }
  }

  // ---- Validate + normalize -----------------------------------------
  const errors: Array<{ index: number; error: string }> = []
  const validated: Array<Record<string, unknown>> = []
  body.rows.forEach((r, i) => {
    if (!r.policy_id_external?.trim()) {
      errors.push({ index: i, error: 'policy_id_external required' })
      return
    }
    if (typeof r.exposure_usd !== 'number' || !Number.isFinite(r.exposure_usd) || r.exposure_usd < 0) {
      errors.push({ index: i, error: 'exposure_usd must be a non-negative number' })
      return
    }
    let countyFips: string | null = r.county_fips ?? null
    if (!countyFips && r.state && r.county) {
      countyFips = fipsByKey.get(lookupKey(r.state, r.county)) ?? null
    }
    validated.push({
      tenant_id:          body.tenant_id,
      policy_id_external: r.policy_id_external.trim(),
      address:            r.address ?? null,
      state:              r.state ?? null,
      county_fips:        countyFips,
      lat:                r.lat ?? null,
      lon:                r.lon ?? null,
      exposure_usd:       r.exposure_usd,
      perils:             Array.isArray(r.perils) ? r.perils : [],
      premium_usd:        r.premium_usd ?? null,
      policy_class:       r.policy_class ?? null,
    })
  })

  // ---- Bulk upsert in CHUNK_SIZE batches ----------------------------
  let inserted = 0
  let failed = 0
  for (let i = 0; i < validated.length; i += CHUNK_SIZE) {
    const chunk = validated.slice(i, i + CHUNK_SIZE)
    const { error: upErr, count } = await admin
      .from('policies')
      .upsert(chunk, {
        onConflict: 'tenant_id,policy_id_external',
        count:      'exact',
      })
    if (upErr) {
      failed += chunk.length
      errors.push({ index: i, error: `Bulk upsert failed: ${upErr.message}` })
    } else {
      inserted += count ?? chunk.length
    }
  }

  const { count: totalAfter } = await admin
    .from('policies')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', body.tenant_id)

  return json({
    ok:           true,
    tenant_id:    body.tenant_id,
    submitted:    body.rows.length,
    inserted,
    failed,
    errors:       errors.slice(0, 50),
    total_after:  totalAfter ?? 0,
  })
}

serve(handle)
