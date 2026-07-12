// TerraWatch — Phase 9.17.1: LinkedIn OAuth code → token exchange.
//
// Called by the AdminLinkedinCallbackView page after LinkedIn redirects
// the admin back with ?code=...&state=.... The page POSTs the code +
// the redirect_uri it sent originally (must match exactly).
//
// We:
//   1. Verify the caller is an admin (JWT + is_admin()).
//   2. Exchange the code for access_token + refresh_token via LinkedIn.
//   3. Look up the admin's organizations via /v2/organizationAcls.
//   4. Pick the DataSnake org (or the first ADMINISTRATOR org if vanity
//      doesn't match).
//   5. Upsert into public.linkedin_oauth (one row per org_urn).
//   6. Return redacted status to the UI.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.3'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')              ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const LINKEDIN_CLIENT_ID        = Deno.env.get('LINKEDIN_CLIENT_ID')        ?? ''
const LINKEDIN_CLIENT_SECRET    = Deno.env.get('LINKEDIN_CLIENT_SECRET')    ?? ''

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Body {
  code:         string
  redirect_uri: string
  state?:       string
}

interface TokenResponse {
  access_token:               string
  expires_in:                 number   // seconds until access_token expiry (typically 5184000 = 60d)
  refresh_token:              string
  refresh_token_expires_in:   number   // seconds until refresh_token expiry (typically 31536000 = 365d)
  scope:                      string
}

interface OrgAclElement {
  organization:           string                    // 'urn:li:organization:12345'
  'organization~'?: {
    id?:            number
    vanityName?:    string
    localizedName?: string
  }
  role:                   string                    // 'ADMINISTRATOR' | ...
  state:                  string                    // 'APPROVED' | ...
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  console.log(`[linkedin-oauth-callback] ${req.method}`)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfigured (SUPABASE secrets)' }, 500)
  }
  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
    console.error('[linkedin-oauth-callback] missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET')
    return json({ error: 'Server misconfigured (LINKEDIN secrets)' }, 500)
  }

  // ---- Auth: admin JWT ----------------------------------------------
  const authHeader = req.headers.get('authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)
  const userId = userData.user.id

  const { data: profile } = await admin
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return json({ error: 'Admin access required' }, 403)
  }

  // ---- Body ---------------------------------------------------------
  let body: Body
  try { body = await req.json() as Body }
  catch { return json({ error: 'Invalid JSON' }, 400) }
  if (!body.code || !body.redirect_uri) {
    return json({ error: 'code and redirect_uri required' }, 400)
  }

  // ---- Exchange code for tokens -------------------------------------
  const tokenParams = new URLSearchParams({
    grant_type:    'authorization_code',
    code:          body.code,
    redirect_uri:  body.redirect_uri,
    client_id:     LINKEDIN_CLIENT_ID,
    client_secret: LINKEDIN_CLIENT_SECRET,
  })
  console.log(`[linkedin-oauth-callback] exchanging code redirect_uri=${body.redirect_uri}`)
  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams.toString(),
  })
  if (!tokenRes.ok) {
    const txt = await tokenRes.text()
    console.error(`[linkedin-oauth-callback] token exchange failed status=${tokenRes.status} body=${txt}`)
    return json({ error: `LinkedIn token exchange failed (${tokenRes.status}): ${txt.slice(0, 300)}` }, 502)
  }
  const tokens = await tokenRes.json() as TokenResponse
  console.log(`[linkedin-oauth-callback] tokens received scope=${tokens.scope} expires_in=${tokens.expires_in}`)

  // ---- Look up the org(s) the admin manages -------------------------
  // The Community Management API requires the r_organization_admin scope.
  const orgRes = await fetch(
    'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organization~(id,vanityName,localizedName)))',
    {
      headers: {
        'Authorization':              `Bearer ${tokens.access_token}`,
        'X-Restli-Protocol-Version':  '2.0.0',
        'LinkedIn-Version':           '202401',
      },
    },
  )
  let orgUrn         = ''
  let orgName: string | null = null
  let orgVanity: string | null = null
  if (orgRes.ok) {
    const orgData = await orgRes.json() as { elements?: OrgAclElement[] }
    const elements = orgData.elements ?? []
    console.log(`[linkedin-oauth-callback] orgs returned: ${elements.length}`)
    // Prefer the DataSnake org (vanityName === 'datasnake'); fall back to first.
    const datasnake = elements.find((e) => e['organization~']?.vanityName === 'datasnake')
    const chosen = datasnake ?? elements[0]
    if (chosen) {
      orgUrn    = chosen.organization
      orgName   = chosen['organization~']?.localizedName ?? null
      orgVanity = chosen['organization~']?.vanityName    ?? null
    }
  } else {
    const txt = await orgRes.text()
    console.error(`[linkedin-oauth-callback] org lookup failed ${orgRes.status}: ${txt}`)
    // Continue; we'll require the admin to set the org URN manually if lookup fails.
  }

  if (!orgUrn) {
    return json({
      error: 'Could not look up your LinkedIn organizations. Confirm the LinkedIn app has the r_organization_admin scope + Community Management API product enabled, and that your LinkedIn account is an admin of the DataSnake company page.',
    }, 422)
  }

  // ---- Upsert into linkedin_oauth -----------------------------------
  const now = new Date()
  const accessExpires  = new Date(now.getTime() + tokens.expires_in              * 1000)
  const refreshExpires = new Date(now.getTime() + tokens.refresh_token_expires_in * 1000)

  const { error: upsertErr } = await admin
    .from('linkedin_oauth')
    .upsert(
      {
        org_urn:                    orgUrn,
        org_name:                   orgName,
        org_vanity_name:            orgVanity,
        access_token:               tokens.access_token,
        refresh_token:              tokens.refresh_token,
        access_token_expires_at:    accessExpires.toISOString(),
        refresh_token_expires_at:   refreshExpires.toISOString(),
        scope:                      tokens.scope,
        connected_at:               now.toISOString(),
        connected_by:               userId,
        updated_at:                 now.toISOString(),
      },
      { onConflict: 'org_urn' },
    )
  if (upsertErr) {
    console.error('[linkedin-oauth-callback] upsert failed:', upsertErr)
    return json({ error: `DB upsert failed: ${upsertErr.message}` }, 500)
  }

  console.log(`[linkedin-oauth-callback] connected org_urn=${orgUrn} org_name=${orgName}`)
  return json({
    ok:               true,
    org_urn:          orgUrn,
    org_name:         orgName,
    org_vanity_name:  orgVanity,
    scope:            tokens.scope,
    access_token_expires_at:  accessExpires.toISOString(),
    refresh_token_expires_at: refreshExpires.toISOString(),
  })
})
