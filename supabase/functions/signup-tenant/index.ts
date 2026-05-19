// TerraWatch — Phase 9.16.0: tenant signup with email-confirmation bypass.
//
// Mirrors signup-admin in pattern. The Supabase free-tier email
// service is throttled to ~4/hour and frequently fails — without
// this bypass, new tenants get stuck after submitting the signup
// form because the confirmation email never arrives.
//
// This function creates the user server-side with email_confirm=true
// so they can sign in immediately. Optional gating via a Vault
// secret 'tenant_signup_code' (see migration 0034). When the secret
// is absent, signup is open (rate-limited only by the policy_limit
// on each tenant — abuse-resistant at the data layer).
//
// Security:
// - Anonymous endpoint. The Vault code (if set) is the gating
//   factor. Rotate by updating the Vault row.
// - No pre-flight existence checks (would leak which emails have
//   accounts). createUser's own error is surfaced verbatim.

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

interface SignupBody {
  email:      string
  password:   string
  beta_code?: string
}

serve(async (req) => {
  console.log(`[signup-tenant] ${req.method} ${req.url}`)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[signup-tenant] missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return json({ error: 'Server misconfigured' }, 500)
  }

  let body: SignupBody
  try {
    body = await req.json() as SignupBody
  } catch (e) {
    console.error('[signup-tenant] invalid JSON body:', e)
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const betaCode = (body.beta_code ?? '').trim()

  console.log(`[signup-tenant] attempt email=${email} pw_len=${password.length} beta_code_present=${betaCode.length > 0}`)

  if (!email || !email.includes('@')) return json({ error: 'Valid email required.' }, 400)
  if (password.length < 8)            return json({ error: 'Password must be at least 8 characters.' }, 400)

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Validate the optional beta code against Vault. RPC returns true
  //    when no Vault secret is configured (open mode), false on mismatch.
  const { data: codeOk, error: codeErr } = await admin.rpc('check_tenant_signup_code', {
    submitted_code: betaCode,
  })
  if (codeErr) {
    console.error('[signup-tenant] check_tenant_signup_code RPC failed:', codeErr)
    return json({ error: `Code validation failed: ${codeErr.message}` }, 500)
  }
  if (codeOk !== true) {
    console.log(`[signup-tenant] code rejected (codeOk=${codeOk})`)
    return json({ error: 'Invalid signup code.' }, 403)
  }

  // 2. Create user with pre-confirmed email so they sign in immediately.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createErr || !created.user) {
    console.error('[signup-tenant] createUser failed:', createErr)
    return json({ error: createErr?.message ?? 'Sign-up failed' }, 400)
  }

  // 3. The on-auth-user-created trigger from migration 0018 already
  //    inserted a user_profiles row with role='user'. Nothing else to
  //    do — the caller signs in next via signInWithPassword.

  console.log(`[signup-tenant] success user_id=${created.user.id}`)
  return json({ ok: true, user_id: created.user.id, email })
})
