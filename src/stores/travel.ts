import { defineStore } from 'pinia'
import type { Place } from '@/services/geocode'
import { getHistoricalQuakes, getRecentQuakes, type Quake } from '@/services/usgs'
import { getForecast, type ForecastBundle } from '@/services/openMeteo'
import { getCurrentKp, getKpForecast3day, type KpSample } from '@/services/noaaKp'
import { getNearestStation, getTidePredictions, type TideStation, type TidePrediction } from '@/services/noaaTides'
import { computeSafety, verdictFromScore, type SafetyScore } from '@/lib/scoring'
import { addDays, daysBetween } from '@/lib/date'

export type TripStyle = 'urban' | 'beach' | 'mountain' | 'general'

export interface TripRequest {
  destination: Place
  start: Date
  end: Date
  style: TripStyle
}

export interface DailyRisk {
  date: string
  score: number
  band: 'safe' | 'caution' | 'danger'
}

export interface TravelVerdict {
  request: TripRequest
  score: SafetyScore
  verdict: 'go' | 'caution' | 'reconsider'
  timeline: DailyRisk[]
  station: TideStation | null
  recentQuakes: Quake[]
  historicalQuakeCount: number
  forecast: ForecastBundle | null
  kpPeak: number
}

interface TravelState {
  request: TripRequest | null
  verdict: TravelVerdict | null
  loading: boolean
  error: string | null
}

function isCoastal(station: TideStation | null, style: TripStyle): boolean {
  if (style === 'beach') return true
  return Boolean(station && station.distanceKm <= 20)
}

export const useTravelStore = defineStore('travel', {
  state: (): TravelState => ({
    request: null,
    verdict: null,
    loading: false,
    error: null,
  }),
  actions: {
    async runAdvisory(req: TripRequest) {
      this.loading = true
      this.error = null
      this.request = req
      try {
        const loc = { lat: req.destination.lat, lon: req.destination.lon }
        const tripDays = Math.max(1, daysBetween(req.start, req.end) + 1)
        const hoursToStart = (req.start.getTime() - Date.now()) / 3_600_000

        const [recentQuakes, historicalQuakes, forecast, kpNow, kpForecast, station] =
          await Promise.all([
            getRecentQuakes(loc, 300, 72 * 4, 2.5).catch(() => []),
            getHistoricalQuakes(loc, 200, 5, 4.5).catch(() => []),
            getForecast(loc, Math.min(14, tripDays + 1)).catch(() => null),
            hoursToStart <= 72 ? getCurrentKp().catch(() => undefined) : Promise.resolve(undefined),
            hoursToStart <= 72 ? getKpForecast3day().catch(() => []) : Promise.resolve([]),
            getNearestStation(loc).catch(() => null),
          ])

        const coastal = isCoastal(station, req.style)
        let tides: TidePrediction[] | undefined
        if (coastal && station) {
          tides = await getTidePredictions(station.id, req.start, req.end).catch(() => [])
        }

        const inputs: Parameters<typeof computeSafety>[0] = {
          recentQuakes,
          historicalQuakes,
          tripDays,
          coastal,
          kpForecast: kpForecast as KpSample[],
        }
        if (forecast) inputs.forecast = forecast
        if (kpNow) inputs.kpNow = kpNow
        if (tides) inputs.tides = tides

        const score = computeSafety(inputs)
        const timeline = this.buildTimeline(req, forecast, kpForecast as KpSample[], recentQuakes)

        const verdict: TravelVerdict = {
          request: req,
          score,
          verdict: verdictFromScore(score.score),
          timeline,
          station: coastal ? station : null,
          recentQuakes: recentQuakes.slice(0, 5),
          historicalQuakeCount: historicalQuakes.length,
          forecast,
          kpPeak: Math.max(
            kpNow?.kp ?? 0,
            ...(kpForecast as KpSample[]).map((s) => s.kp),
            0,
          ),
        }
        this.verdict = verdict
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Advisory failed'
      } finally {
        this.loading = false
      }
    },
    buildTimeline(
      req: TripRequest,
      forecast: ForecastBundle | null,
      kpForecast: KpSample[],
      recentQuakes: Quake[],
    ): DailyRisk[] {
      const days = Math.max(1, daysBetween(req.start, req.end) + 1)
      const timeline: DailyRisk[] = []
      for (let i = 0; i < days; i++) {
        const date = addDays(req.start, i)
        const iso = date.toISOString().slice(0, 10)
        const daily = forecast?.daily.find((d) => d.date === iso)
        const kpOnDay = kpForecast.find((s) => s.time.toISOString().slice(0, 10) === iso)
        const inputs: Parameters<typeof computeSafety>[0] = {
          recentQuakes,
          tripDays: 1,
        }
        if (daily) {
          inputs.forecast = {
            current: { tempC: 0, windKph: 0, weatherCode: 0 },
            daily: [daily],
          }
        }
        if (kpOnDay) inputs.kpForecast = [kpOnDay]
        const s = computeSafety(inputs)
        timeline.push({ date: iso, score: s.score, band: s.band })
      }
      return timeline
    },
    reset() {
      this.request = null
      this.verdict = null
      this.error = null
    },
  },
})
