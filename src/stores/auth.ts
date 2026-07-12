import { defineStore } from 'pinia'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '@/services/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  status: 'idle' | 'loading' | 'authed' | 'anonymous' | 'error'
  error: string | null
  initialized: boolean
  // Phase 9.8: in-app role read from public.user_profiles. Loaded once
  // when the session resolves, refreshed on auth state changes. We don't
  // refetch per-route because role doesn't change mid-session in the
  // common case; admin-promoted users are signed out and back in.
  isAdmin: boolean
  adminLoaded: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    session: null,
    status: 'idle',
    error: null,
    initialized: false,
    isAdmin: false,
    adminLoaded: false,
  }),
  getters: {
    isAuthed: (s) => s.status === 'authed' && Boolean(s.user),
    configured: () => supabaseConfigured,
    email: (s) => s.user?.email ?? null,
    // Identity providers used to authenticate (informational — drives the
    // "linked accounts" hint in settings later).
    providers: (s) => s.user?.identities?.map((i) => i.provider) ?? [],
  },
  actions: {
    async init() {
      if (this.initialized) return
      this.initialized = true
      if (!supabase) {
        this.status = 'anonymous'
        return
      }
      this.status = 'loading'
      const { data } = await supabase.auth.getSession()
      this.setSession(data.session)
      void this.loadAdminFlag()
      supabase.auth.onAuthStateChange((_event, session) => {
        this.setSession(session)
        void this.loadAdminFlag()
      })
    },
    setSession(session: Session | null) {
      this.session = session
      this.user = session?.user ?? null
      this.status = session ? 'authed' : 'anonymous'
      // Reset admin flag whenever session changes — prevents a stale
      // "true" from leaking after a sign-out/sign-in switch.
      if (!session) {
        this.isAdmin = false
        this.adminLoaded = true
      } else {
        this.adminLoaded = false
      }
    },

    // -------- Phase 9.8: admin role -------------------------------------
    // Reads the caller's row from public.user_profiles. Uses the read
    // policy from migration 0018: "auth.uid() = user_id".
    async loadAdminFlag() {
      if (!supabase || !this.user) {
        this.isAdmin = false
        this.adminLoaded = true
        return
      }
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', this.user.id)
        .maybeSingle()
      if (error) {
        // Don't break sign-in if the profile read fails (table missing on
        // a stale env, RLS hiccup, etc.). Treat as non-admin.
        this.isAdmin = false
        this.adminLoaded = true
        return
      }
      this.isAdmin = (data?.role as string | undefined) === 'admin'
      this.adminLoaded = true
    },

    // Calls the redeem_admin_code RPC from migration 0018. Returns true
    // if the code matched and the role flipped to admin. Caller should
    // refetch loadAdminFlag() after a successful redeem to update the
    // in-memory flag without a full sign-in/sign-out cycle.
    async redeemAdminCode(code: string): Promise<boolean> {
      if (!supabase) throw new Error('Auth unavailable.')
      const { data, error } = await supabase.rpc('redeem_admin_code', {
        submitted_code: code,
      })
      if (error) throw error
      const ok = data === true
      if (ok) await this.loadAdminFlag()
      return ok
    },

    // -------- Magic-link (existing) ---------------------------------------
    async signInWithEmail(email: string): Promise<void> {
      if (!supabase) throw new Error('Sign-in unavailable.')
      this.status = 'loading'
      this.error = null
      const redirectTo = `${window.location.origin}/auth/callback`
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      })
      if (error) {
        this.status = 'error'
        this.error = error.message
        throw error
      }
      this.status = 'anonymous'
    },

    // -------- Phase 10: Google OAuth --------------------------------------
    // Browser navigates away to Google's consent screen and comes back via
    // /auth/callback. No promise resolution path — function returns once the
    // SDK has triggered the redirect.
    async signInWithGoogle(): Promise<void> {
      if (!supabase) throw new Error('Sign-in unavailable.')
      this.status = 'loading'
      this.error = null
      const redirectTo = `${window.location.origin}/auth/callback`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      if (error) {
        this.status = 'error'
        this.error = error.message
        throw error
      }
    },

    // -------- Phase 10: Email + password ----------------------------------
    async signInWithPassword(email: string, password: string): Promise<void> {
      if (!supabase) throw new Error('Sign-in unavailable.')
      this.status = 'loading'
      this.error = null
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        this.status = 'error'
        this.error = error.message
        throw error
      }
      // setSession is called by the onAuthStateChange listener.
    },

    async signUpWithPassword(email: string, password: string): Promise<{ requiresConfirmation: boolean }> {
      if (!supabase) throw new Error('Sign-up unavailable.')
      this.status = 'loading'
      this.error = null
      const redirectTo = `${window.location.origin}/auth/callback`
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      })
      if (error) {
        this.status = 'error'
        this.error = error.message
        throw error
      }
      // When email confirmation is required (default Supabase config), user
      // is null until they click the link. Caller shows "check inbox" UI.
      const requiresConfirmation = data.session === null
      if (!requiresConfirmation) this.setSession(data.session)
      else this.status = 'anonymous'
      return { requiresConfirmation }
    },

    // Phase 9.16.0 — server-side signup that bypasses Supabase's email
    // confirmation step. Mirrors the signup-admin path but for non-admin
    // users. Free-tier Supabase email is throttled to ~4/hour and
    // flaky; this function calls admin.createUser({ email_confirm: true })
    // server-side, then signs the user in immediately. Custom SMTP
    // (Resend / Postmark / SES) is still the right long-term fix.
    //
    // NOTE: uses supabase.functions.invoke (NOT raw fetch) — invoke
    // attaches the apikey + Authorization: Bearer <anon> headers that
    // Supabase's Edge Function gateway requires before our function
    // runs. Raw fetch fails the gateway preflight with a CORS-shaped
    // "Failed to fetch" error.
    async signUpTenantBypass(email: string, password: string, betaCode?: string): Promise<void> {
      if (!supabase) throw new Error('Sign-up unavailable.')
      this.status = 'loading'
      this.error = null
      const { data, error } = await supabase.functions.invoke<{ ok: boolean; user_id: string; email: string; error?: string }>(
        'signup-tenant',
        { body: { email, password, beta_code: betaCode ?? '' } },
      )
      if (error) {
        // supabase-js wraps the underlying HTTP response in error.context as
        // a Response object. Need to read the body to get our function's
        // real error message — otherwise we only see the generic
        // "Edge Function returned a non-2xx status code".
        let msg = error.message || 'Sign-up failed'
        try {
          const ctx = (error as { context?: Response }).context
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.clone().json()
            if (body?.error) msg = `${body.error} (HTTP ${ctx.status})`
          }
        } catch { /* fall through to generic message */ }
        this.status = 'error'
        this.error = msg
        throw new Error(msg)
      }
      if (!data?.ok) {
        const msg = data?.error ?? 'Sign-up failed'
        this.status = 'error'
        this.error = msg
        throw new Error(msg)
      }
      // Sign in immediately so the user lands authenticated.
      await this.signInWithPassword(email, password)
    },

    // -------- Phase 10: Password reset ------------------------------------
    async resetPasswordForEmail(email: string): Promise<void> {
      if (!supabase) throw new Error('Reset unavailable.')
      const redirectTo = `${window.location.origin}/auth/reset`
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) throw error
    },

    async updatePassword(newPassword: string): Promise<void> {
      if (!supabase) throw new Error('Update unavailable.')
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
    },

    // -------- Sign out ----------------------------------------------------
    async signOut(): Promise<void> {
      if (!supabase) return
      await supabase.auth.signOut()
      this.setSession(null)
    },
  },
})
