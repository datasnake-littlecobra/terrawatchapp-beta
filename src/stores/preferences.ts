import { defineStore } from 'pinia'

interface PrefsState {
  units: 'metric' | 'imperial'
  theme: 'dark' | 'light' | 'system'
  pushEnabled: boolean
}

const STORAGE_KEY = 'tw:prefs'

function load(): PrefsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaults(), ...(JSON.parse(raw) as Partial<PrefsState>) }
  } catch {
    // ignore
  }
  return defaults()
}

function defaults(): PrefsState {
  return { units: 'metric', theme: 'dark', pushEnabled: false }
}

export const usePreferencesStore = defineStore('preferences', {
  state: (): PrefsState => load(),
  actions: {
    patch(update: Partial<PrefsState>) {
      Object.assign(this, update)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state))
    },
  },
})
