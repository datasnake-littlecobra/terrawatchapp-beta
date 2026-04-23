import { defineStore } from 'pinia'
import { supabase } from '@/services/supabase'
import { useAuthStore } from './auth'

export type BookmarkKind = 'home' | 'work' | 'trip' | 'custom'

export interface Bookmark {
  id: string
  label: string
  lat: number
  lon: number
  kind: BookmarkKind
  createdAt: string
}

interface BookmarksState {
  items: Bookmark[]
  loading: boolean
  error: string | null
  loadedForUser: string | null
}

interface RawBookmark {
  id: string
  label: string
  lat: number
  lon: number
  kind: BookmarkKind
  created_at: string
}

function toBookmark(r: RawBookmark): Bookmark {
  return {
    id: r.id,
    label: r.label,
    lat: r.lat,
    lon: r.lon,
    kind: r.kind,
    createdAt: r.created_at,
  }
}

export const useBookmarksStore = defineStore('bookmarks', {
  state: (): BookmarksState => ({
    items: [],
    loading: false,
    error: null,
    loadedForUser: null,
  }),
  actions: {
    async load() {
      const auth = useAuthStore()
      if (!supabase || !auth.isAuthed || !auth.user) {
        this.items = []
        this.loadedForUser = null
        return
      }
      if (this.loadedForUser === auth.user.id) return
      this.loading = true
      this.error = null
      try {
        const { data, error } = await supabase
          .from('bookmarks')
          .select('id,label,lat,lon,kind,created_at')
          .order('created_at', { ascending: false })
        if (error) throw error
        this.items = (data ?? []).map((r) => toBookmark(r as RawBookmark))
        this.loadedForUser = auth.user.id
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load bookmarks'
      } finally {
        this.loading = false
      }
    },
    async add(input: { label: string; lat: number; lon: number; kind?: BookmarkKind }) {
      const auth = useAuthStore()
      if (!supabase || !auth.user) throw new Error('Sign in to save locations.')
      const payload = {
        user_id: auth.user.id,
        label: input.label,
        lat: input.lat,
        lon: input.lon,
        kind: input.kind ?? 'custom',
      }
      const { data, error } = await supabase
        .from('bookmarks')
        .insert(payload)
        .select('id,label,lat,lon,kind,created_at')
        .single()
      if (error) throw error
      if (data) {
        const bm = toBookmark(data as RawBookmark)
        this.items = [bm, ...this.items]
        return bm
      }
      return null
    },
    async remove(id: string) {
      if (!supabase) return
      const prev = this.items
      this.items = this.items.filter((b) => b.id !== id)
      const { error } = await supabase.from('bookmarks').delete().eq('id', id)
      if (error) {
        this.items = prev
        throw error
      }
    },
    reset() {
      this.items = []
      this.loadedForUser = null
      this.error = null
    },
  },
})
