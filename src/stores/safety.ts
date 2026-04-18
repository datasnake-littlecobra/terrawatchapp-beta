import { defineStore } from 'pinia'
import { computeSafety, type SafetyScore } from '@/lib/scoring'
import { getRecentQuakes } from '@/services/usgs'
import { getForecast } from '@/services/openMeteo'
import { getCurrentKp, getKpForecast3day } from '@/services/noaaKp'
import type { LatLon } from '@/lib/geo'

interface SafetyState {
  score: SafetyScore | null
  loading: boolean
  error: string | null
  lastUpdated: number | null
  lastKey: string | null
}

function keyFor(loc: LatLon): string {
  return `${loc.lat.toFixed(3)},${loc.lon.toFixed(3)}`
}

export const useSafetyStore = defineStore('safety', {
  state: (): SafetyState => ({
    score: null,
    loading: false,
    error: null,
    lastUpdated: null,
    lastKey: null,
  }),
  actions: {
    async load(loc: LatLon) {
      const key = keyFor(loc)
      if (this.lastKey === key && this.lastUpdated && Date.now() - this.lastUpdated < 5 * 60_000) {
        return
      }
      this.loading = true
      this.error = null
      try {
        const [quakes, forecast, kpNow, kpForecast] = await Promise.all([
          getRecentQuakes(loc).catch(() => []),
          getForecast(loc, 3).catch(() => undefined),
          getCurrentKp().catch(() => undefined),
          getKpForecast3day().catch(() => []),
        ])
        const inputs: Parameters<typeof computeSafety>[0] = {
          recentQuakes: quakes,
          kpForecast,
          tripDays: 1,
        }
        if (forecast) inputs.forecast = forecast
        if (kpNow) inputs.kpNow = kpNow
        this.score = computeSafety(inputs)
        this.lastKey = key
        this.lastUpdated = Date.now()
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load safety data'
      } finally {
        this.loading = false
      }
    },
  },
})
