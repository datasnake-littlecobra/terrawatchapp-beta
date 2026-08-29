// TerraWatch — Phase 11: shared debounced place-search behaviour.
// Extracted so new features (starting with Location Risk) don't hand-roll
// a fourth copy of the pattern already duplicated across TravelForm.vue,
// SafetyHero.vue, and SettingsView.vue.

import { ref } from 'vue'
import { searchPlaces, type Place } from '@/services/geocode'

export function usePlaceSearch(opts: { debounceMs?: number; limit?: number } = {}) {
  const debounceMs = opts.debounceMs ?? 250
  const limit = opts.limit ?? 5

  const query = ref('')
  const suggestions = ref<Place[]>([])
  const searching = ref(false)
  const picked = ref<Place | null>(null)

  let handle: number | undefined

  function onInput() {
    picked.value = null
    window.clearTimeout(handle)
    const q = query.value
    if (q.trim().length < 2) {
      suggestions.value = []
      return
    }
    handle = window.setTimeout(async () => {
      searching.value = true
      try {
        suggestions.value = await searchPlaces(q, limit)
      } finally {
        searching.value = false
      }
    }, debounceMs)
  }

  function pick(p: Place) {
    picked.value = p
    query.value = `${p.name}, ${p.admin1 ? p.admin1 + ', ' : ''}${p.country}`
    suggestions.value = []
  }

  function reset() {
    query.value = ''
    suggestions.value = []
    picked.value = null
  }

  return { query, suggestions, searching, picked, onInput, pick, reset }
}
