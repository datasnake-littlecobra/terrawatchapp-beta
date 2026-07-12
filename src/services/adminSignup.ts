// TerraWatch — client wrapper for the signup-admin edge function.
//
// Single-call admin signup that bypasses Supabase's email confirmation
// flow (the function calls auth.admin.createUser({ email_confirm: true })
// server-side). After this returns ok, the caller signs in normally with
// the same credentials and is immediately admin.

import { requireSupabase } from './supabase'

export interface AdminSignupRequest {
  email:    string
  password: string
  code:     string
}

export interface AdminSignupResponse {
  ok:      boolean
  user_id: string
  email:   string
}

export class AdminSignupError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AdminSignupError'
    this.status = status
  }
}

export async function signupAdmin(req: AdminSignupRequest): Promise<AdminSignupResponse> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.functions.invoke<AdminSignupResponse>('signup-admin', {
    body: req,
  })
  if (error) {
    // supabase-js wraps the underlying HTTP response in error.context as a
    // Response object. Read its body for the real message.
    let status = 500
    let message = error.message || 'Sign-up failed'
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        status = ctx.status ?? 500
        const body = await ctx.clone().json()
        if (body?.error) message = body.error
      }
    } catch { /* keep generic */ }
    throw new AdminSignupError(message, status)
  }
  if (!data) throw new AdminSignupError('No response from server.', 500)
  return data
}
