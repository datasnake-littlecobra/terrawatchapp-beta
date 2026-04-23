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
    async signOut(): Promise<void> {
      if (!supabase) return
      await supabase.auth.signOut()
      this.setSession(null)
    },
  },
})
