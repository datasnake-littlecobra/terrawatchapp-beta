import { defineStore } from 'pinia'
import type { LatLon } from '@/lib/geo'

interface LocationState {
  coords: LatLon | null
  label: string | null
  status: 'idle' | 'locating' | 'granted' | 'denied' | 'manual'
  error: string | null
}

const STORAGE_KEY = 'tw:location:manual'

export const useLocationStore = defineStore('location', {
  state: (): LocationState => ({
    coords: null,
    label: null,
    status: 'idle',
    error: null,
  }),
  actions: {
    async init() {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { coords: LatLon; label: string }
          this.coords = parsed.coords
          this.label = parsed.label
          this.status = 'manual'
          return
        } catch {
          // ignore parse error
        }
      }
      await this.requestGeolocation()
    },
    async requestGeolocation() {
      if (!('geolocation' in navigator)) {
        this.status = 'denied'
        this.error = 'Geolocation not available'
        return
      }
      this.status = 'locating'
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            maximumAge: 5 * 60_000,
            timeout: 10_000,
          })
        })
        this.coords = { lat: position.coords.latitude, lon: position.coords.longitude }
        this.label = 'Current location'
        this.status = 'granted'
        this.error = null
      } catch (error) {
        this.status = 'denied'
        this.error = error instanceof Error ? error.message : 'Location unavailable'
      }
    },
    setManual(coords: LatLon, label: string) {
      this.coords = coords
      this.label = label
      this.status = 'manual'
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ coords, label }))
    },
    clearManual() {
      localStorage.removeItem(STORAGE_KEY)
      this.status = 'idle'
      void this.requestGeolocation()
    },
  },
})
