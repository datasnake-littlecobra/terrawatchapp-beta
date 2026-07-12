// TerraWatch — Phase 9.17.1: publish next approved LinkedIn post.
//
// Invoked by pg_cron Mon/Wed/Fri at 14:00 UTC via x-ingest-secret.
// Also callable manually by an admin for the "Publish now" button.
//
// Flow:
//   1. Auth: x-ingest-secret OR admin JWT.
//   2. Read the OAuth row from public.linkedin_oauth (singleton).
//   3. If access_token is expired (or within 15 min), refresh it.
//   4. Pick the oldest post where status='approved' AND
//      (scheduled_for IS NULL OR scheduled_for <= now()).
//      Lock it via update status='scheduled' before posting so a
//      concurrent run doesn't double-post.
//   5. POST to LinkedIn /rest/posts.
//   6. On 201: status='published', linkedin_urn=<x-restli-id>, published_at=now().
//   7. On 401 (token rejected after refresh attempt): mark 'failed'.
//   8. On other failure: status='failed', publish_error=<msg>.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.3'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')              ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const INGEST_SECRET             = Deno.env.get('INGEST_SECRET')             ?? ''
const LINKEDIN_CLIENT_ID        = Deno.env.get('LINKEDIN_CLIENT_ID')        ?? ''
const LINKEDIN_CLIENT_SECRET    = Deno.env.get('LINKEDIN_CLIENT_SECRET')    ?? ''

const LINKEDIN_API_VERSION = '202401'

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

interface OauthRow {
  id:                       string
  org_urn:                  string
  access_token:             string
  refresh_token:            string
  access_token_expires_at:  string
  refresh_token_expires_at: string
}

interface PostRow {
  id:        string
  content:   string
  hashtags:  string[]
}

interface Body {
  post_id?: string  // optional override for "Publish now" admin button
}

// ---------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------

async function refreshAccessToken(
  admin: ReturnType<typeof createClient>,
  oauth: OauthRow,
): Promise<string> {
  console.log(`[publish-linkedin-post] refreshing access_token for org_urn=${oauth.org_urn}`)
  const params = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: oauth.refresh_token,
    client_id:     LINKEDIN_CLIENT_ID,
    client_secret: LINKEDIN_CLIENT_SECRET,
  })
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`refresh_token exchange failed (${res.status}): ${txt.slice(0, 200)}`)
  }
  const data = await res.json() as {
    access_token: string
    expires_in: number
    refresh_token?: string                  // LinkedIn returns a new refresh token on refresh
    refresh_token_expires_in?: number
  }
  const now = new Date()
  const accessExpires  = new Date(now.getTime() + data.expires_in * 1000)
  const refreshExpires = data.refresh_token_expires_in
    ? new Date(now.getTime() + data.refresh_token_expires_in * 1000)
    : new Date(oauth.refresh_token_expires_at)
  await admin
    .from('linkedin_oauth')
    .update({
      access_token:            data.access_token,
      refresh_token:           data.refresh_token ?? oauth.refresh_token,
      access_token_expires_at: accessExpires.toISOString(),
      refresh_token_expires_at: refreshExpires.toISOString(),
      updated_at:              now.toISOString(),
    })
    .eq('id', oauth.id)
  return data.access_token
}

// ---------------------------------------------------------------------
// Build the LinkedIn /rest/posts request body
// ---------------------------------------------------------------------

function buildPostBody(orgUrn: string, content: string, hashtags: string[]): unknown {
  const commentary = hashtags.length
    ? `${content.trim()}\n\n${hashtags.join(' ')}`
    : content.trim()
  return {
    author:                     orgUrn,
    commentary,
    visibility:                 'PUBLIC',
    distribution: {
      feedDistribution:                'MAIN_FEED',
      targetEntities:                  [],
      thirdPartyDistributionChannels:  [],
    },
    lifecycleState:             'PUBLISHED',
    isReshareDisabledByAuthor:  false,
  }
}

async function callPostsApi(accessToken: string, body: unknown): Promise<{ urn: string }> {
  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      'Authorization':              `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version':  '2.0.0',
      'LinkedIn-Version':           LINKEDIN_API_VERSION,
      'Content-Type':               'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`LinkedIn /rest/posts ${res.status}: ${txt.slice(0, 400)}`)
  }
  // The created URN is returned in the x-restli-id header.
  const urn = res.headers.get('x-restli-id')
    ?? res.headers.get('x-linkedin-id')
    ?? ''
  return { urn }
}

// ---------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------

serve(async (req) => {
  console.log(`[publish-linkedin-post] ${req.method}`)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfigured (SUPABASE secrets)' }, 500)
  }
  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
    return json({ error: 'Server misconfigured (LINKEDIN_CLIENT_ID/SECRET)' }, 500)
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ---- Auth ---------------------------------------------------------
  let viaCron = false
  const ingestSecret = req.headers.get('x-ingest-secret') ?? ''
  if (INGEST_SECRET && ingestSecret === INGEST_SECRET) {
    viaCron = true
  } else {
    const authHeader = req.headers.get('authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ error: 'Unauthorized' }, 401)
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)
    const { data: profile } = await admin
      .from('user_profiles')
      .select('role')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if ((profile as { role?: string } | null)?.role !== 'admin') {
      return json({ error: 'Admin access required' }, 403)
    }
  }
  console.log(`[publish-linkedin-post] auth ok viaCron=${viaCron}`)

  // ---- Body (optional post_id override) -----------------------------
  let body: Body = {}
  try { body = await req.json() as Body } catch { /* empty is fine */ }

  // ---- Get OAuth row -----------------------------------------------
  const { data: oauthRowRaw, error: oauthErr } = await admin
    .from('linkedin_oauth')
    .select('*')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (oauthErr) return json({ error: `OAuth row read failed: ${oauthErr.message}` }, 500)
  if (!oauthRowRaw) {
    return json({ error: 'LinkedIn not connected. Visit /admin/linkedin/connect first.' }, 412)
  }
  const oauth = oauthRowRaw as OauthRow

  // Check refresh-token expiry
  if (new Date(oauth.refresh_token_expires_at).getTime() < Date.now()) {
    return json({ error: 'LinkedIn refresh_token expired. Reconnect at /admin/linkedin/connect.' }, 412)
  }

  // Refresh access_token if expiring within 15 min
  let accessToken = oauth.access_token
  if (new Date(oauth.access_token_expires_at).getTime() < Date.now() + 15 * 60 * 1000) {
    try {
      accessToken = await refreshAccessToken(admin, oauth)
    } catch (e) {
      console.error('[publish-linkedin-post] refresh failed:', e)
      return json({ error: e instanceof Error ? e.message : 'token refresh failed' }, 502)
    }
  }

  // ---- Pick the next post ------------------------------------------
  let pickQuery = admin
    .from('linkedin_posts')
    .select('id, content, hashtags')
    .eq('status', 'approved')
    .order('scheduled_for', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(1)

  if (body.post_id) {
    pickQuery = admin
      .from('linkedin_posts')
      .select('id, content, hashtags')
      .eq('id', body.post_id)
      .in('status', ['approved', 'failed'])           // allow re-publish from failed
      .limit(1)
  } else {
    // For cron picks, only post if scheduled_for has elapsed (or is NULL)
    pickQuery = pickQuery.or('scheduled_for.is.null,scheduled_for.lte.' + new Date().toISOString())
  }

  const { data: pickedRows, error: pickErr } = await pickQuery
  if (pickErr) return json({ error: `pick failed: ${pickErr.message}` }, 500)
  const post = (pickedRows as PostRow[] | null)?.[0]
  if (!post) {
    console.log(`[publish-linkedin-post] no approved post to publish viaCron=${viaCron}`)
    return json({ ok: true, picked: null, message: 'No approved post is ready to publish.' })
  }

  // ---- Lock it (status='scheduled') so a concurrent run skips it ---
  const { error: lockErr } = await admin
    .from('linkedin_posts')
    .update({ status: 'scheduled', updated_at: new Date().toISOString() })
    .eq('id', post.id)
    .eq('status', 'approved')                       // CAS — only if still approved
  if (lockErr) return json({ error: `lock failed: ${lockErr.message}` }, 500)

  // ---- POST to LinkedIn --------------------------------------------
  let urn = ''
  try {
    const result = await callPostsApi(accessToken, buildPostBody(oauth.org_urn, post.content, post.hashtags))
    urn = result.urn
    console.log(`[publish-linkedin-post] published post_id=${post.id} urn=${urn}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[publish-linkedin-post] publish failed post_id=${post.id}:`, msg)
    await admin
      .from('linkedin_posts')
      .update({
        status:        'failed',
        publish_error: msg.slice(0, 1000),
        updated_at:    new Date().toISOString(),
      })
      .eq('id', post.id)
    return json({ ok: false, picked: post.id, error: msg }, 502)
  }

  // ---- Mark published ----------------------------------------------
  const { error: pubErr } = await admin
    .from('linkedin_posts')
    .update({
      status:        'published',
      linkedin_urn:  urn,
      published_at:  new Date().toISOString(),
      publish_error: null,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', post.id)
  if (pubErr) {
    console.error('[publish-linkedin-post] mark-published failed:', pubErr)
    return json({ ok: true, picked: post.id, linkedin_urn: urn, warn: pubErr.message })
  }

  return json({ ok: true, picked: post.id, linkedin_urn: urn })
})
