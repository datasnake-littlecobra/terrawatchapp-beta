import { defineStore } from 'pinia'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '@/services/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  status: 'idle' | 'loading' | 'authed' | 'anonymous' | 'error'
  error: string | null
  initialized: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    session: null,
    status: 'idle',
    error: null,
    initialized: false,
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
      supabase.auth.onAuthStateChange((_event, session) => {
        this.setSession(session)
      })
    },
    setSession(session: Session | null) {
      this.session = session
      this.user = session?.user ?? null
      this.status = session ? 'authed' : 'anonymous'
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
