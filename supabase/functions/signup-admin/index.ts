// TerraWatch — Phase 9.8 follow-up: single-call admin signup.
//
// The original two-step flow (sign up via supabase.auth, then redeem
// admin code via RPC) breaks when email confirmation is enabled in
// Supabase Auth — the user can't get a JWT until they click the
// confirmation email, which means the redeem step never runs and they
// can't log in either. Combined with Supabase's flaky free-tier email
// delivery, this leaves new admins stuck.
//
// This function fixes that path. Anonymous callers POST email + password
// + admin code; the function:
//   1. Validates the admin code against Vault (`admin_signup_code`).
//   2. Calls supabase.auth.admin.createUser({ email_confirm: true }) so
//      the user can sign in immediately without an inbox round-trip.
//   3. Sets user_profiles.role='admin' for the new user_id.
//
// Security notes:
//   - The endpoint is anonymous (no JWT required). The admin code is
//     the gating factor — pick a long random one, rotate by updating
//     the Vault secret. A leaked code lets an attacker create unlimited
//     admin accounts; rotate immediately if exposed.
//   - We don't pre-flight email-existence checks (would leak which
//     emails have accounts). createUser will return its own error if
//     the email is already registered.
//   - No rate limiting yet. If abuse becomes an issue we can add a
//     tiny in-Postgres counter or a per-IP cap; deliberately deferred
//     for the small admin pool TerraWatch needs.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface SignupBody {
  email:    string
  password: string
  code:     string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfigured' }, 500)
  }

  let body: SignupBody
  try {
    body = await req.json() as SignupBody
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const email    = (body.email    ?? '').trim().toLowerCase()
  const password = (body.password ?? '')
  const code     = (body.code     ?? '').trim()

  if (!email || !email.includes('@')) return json({ error: 'Valid email required.' }, 400)
  if (password.length < 8)             return json({ error: 'Password must be at least 8 characters.' }, 400)
  if (!code)                           return json({ error: 'Admin signup code required.' }, 400)

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Validate admin code against Vault.
  // We use a service-role-only RPC to avoid exposing vault.decrypted_secrets
  // through PostgREST. The RPC is defined in migration 0021.
  const { data: codeOk, error: codeErr } = await admin.rpc('check_admin_signup_code', {
    submitted_code: code,
  })
  if (codeErr) {
    return json({ error: 'Code validation failed' }, 500)
  }
  if (codeOk !== true) {
    return json({ error: 'Invalid admin signup code.' }, 403)
  }

  // 2. Create user with pre-confirmed email so they can sign in immediately.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createErr || !created.user) {
    const message = createErr?.message ?? 'Sign-up failed'
    // Most common: email already exists. Surface the upstream message
    // verbatim — Supabase's wording is already user-friendly.
    return json({ error: message }, 400)
  }

  const userId = created.user.id

  // 3. Promote to admin in user_profiles. The on-auth-user-created trigger
  // already inserted a row with role='user'; upsert ensures we win even
  // if the trigger raced.
  const { error: promoteErr } = await admin
    .from('user_profiles')
    .upsert(
      { user_id: userId, role: 'admin', updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (promoteErr) {
    return json({
      error: 'Account created but role promotion failed. Run UPDATE user_profiles SET role=admin manually.',
      detail: promoteErr.message,
    }, 500)
  }

  return json({ ok: true, user_id: userId, email })
})
