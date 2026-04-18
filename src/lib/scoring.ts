import type { Quake } from '@/services/usgs'
import type { ForecastBundle } from '@/services/openMeteo'
import type { KpSample } from '@/services/noaaKp'
import type { TidePrediction } from '@/services/noaaTides'
import { relativeHours } from './date'

export type Band = 'safe' | 'caution' | 'danger'

export interface Reason {
  source: 'seismic' | 'weather' | 'space' | 'tide'
  tone: Band
  headline: string
  detail?: string
}

export interface SafetyScore {
  score: number
  band: Band
  reasons: Reason[]
  subscores: {
    seismic: number
    weather: number
    space: number
    tide: number | null
  }
}

export interface ScoringInputs {
  recentQuakes?: Quake[]
  historicalQuakes?: Quake[]
  forecast?: ForecastBundle
  kpNow?: KpSample
  kpForecast?: KpSample[]
  tides?: TidePrediction[]
  tripDays?: number
  coastal?: boolean
}

export const SCORING_WEIGHTS = {
  seismic: 0.4,
  weather: 0.35,
  space: 0.1,
  tide: 0.15,
} as const

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function bandFromScore(score: number): Band {
  if (score >= 70) return 'safe'
  if (score >= 40) return 'caution'
  return 'danger'
}

export function scoreSeismic(inputs: Pick<ScoringInputs, 'recentQuakes' | 'historicalQuakes'>): {
  score: number
  reason?: Reason
} {
  const recent = inputs.recentQuakes ?? []
  const strongRecent = recent.filter((q) => q.magnitude >= 4.0)
  const topRecent = recent.reduce<Quake | null>(
    (best, q) => (!best || q.magnitude > best.magnitude ? q : best),
    null,
  )
  const historical = inputs.historicalQuakes ?? []
  const majorHistorical = historical.filter((q) => q.magnitude >= 6.0).length

  let penalty = 0
  if (topRecent) {
    penalty += Math.max(0, (topRecent.magnitude - 2.5) * 12)
    const hrs = relativeHours(topRecent.time)
    if (hrs < 24) penalty += 10
  }
  penalty += strongRecent.length * 6
  penalty += Math.min(20, majorHistorical * 2)

  const score = Math.round(100 - clamp01(penalty / 100) * 100)
  let reason: Reason | undefined
  if (topRecent && topRecent.magnitude >= 3.5) {
    const km = topRecent.distanceKm?.toFixed(0) ?? '—'
    reason = {
      source: 'seismic',
      tone: topRecent.magnitude >= 5 ? 'danger' : 'caution',
      headline: `M${topRecent.magnitude.toFixed(1)} quake ${km} km away`,
      detail: `${topRecent.place} · ${Math.round(relativeHours(topRecent.time))} h ago`,
    }
  } else if (majorHistorical >= 3) {
    reason = {
      source: 'seismic',
      tone: 'caution',
      headline: `${majorHistorical} major quakes here in recent years`,
      detail: 'This region has seismic history. Know your shelter plan.',
    }
  }
  return reason ? { score, reason } : { score }
}

export function scoreWeather(inputs: Pick<ScoringInputs, 'forecast' | 'tripDays'>): {
  score: number
  reason?: Reason
} {
  const fc = inputs.forecast
  if (!fc) return { score: 100 }
  const range = fc.daily.slice(0, Math.max(1, inputs.tripDays ?? 3))
  if (range.length === 0) return { score: 100 }
  const maxWind = Math.max(...range.map((d) => d.windMaxKph))
  const maxPrecip = Math.max(...range.map((d) => d.precipMm))
  const maxPrecipProb = Math.max(...range.map((d) => d.precipProb))
  const severeCodes = range.filter((d) => d.weatherCode >= 95).length

  let penalty = 0
  if (maxWind > 40) penalty += (maxWind - 40) * 1.2
  if (maxPrecip > 20) penalty += (maxPrecip - 20) * 0.8
  if (maxPrecipProb > 70) penalty += (maxPrecipProb - 70) * 0.4
  penalty += severeCodes * 25

  const score = Math.round(100 - clamp01(penalty / 100) * 100)
  let reason: Reason | undefined
  if (severeCodes > 0) {
    reason = {
      source: 'weather',
      tone: 'danger',
      headline: 'Thunderstorms expected',
      detail: `${severeCodes} day${severeCodes > 1 ? 's' : ''} with storm activity in the forecast.`,
    }
  } else if (maxWind > 50) {
    reason = {
      source: 'weather',
      tone: 'caution',
      headline: `High winds up to ${Math.round(maxWind)} km/h`,
    }
  } else if (maxPrecip > 30) {
    reason = {
      source: 'weather',
      tone: 'caution',
      headline: `Heavy rain expected (${maxPrecip.toFixed(0)} mm)`,
    }
  }
  return reason ? { score, reason } : { score }
}

export function scoreSpace(inputs: Pick<ScoringInputs, 'kpNow' | 'kpForecast'>): {
  score: number
  reason?: Reason
} {
  const peak = Math.max(
    inputs.kpNow?.kp ?? 0,
    ...(inputs.kpForecast ?? []).map((s) => s.kp),
  )
  if (peak <= 0) return { score: 100 }
  let score = 100
  if (peak >= 5) score = 60
  if (peak >= 6) score = 45
  if (peak >= 7) score = 25
  if (peak >= 8) score = 10
  if (peak < 4) return { score }
  return {
    score,
    reason: {
      source: 'space',
      tone: peak >= 7 ? 'danger' : 'caution',
      headline: `Geomagnetic storm (Kp ${peak.toFixed(0)})`,
      detail: peak >= 5 ? 'GPS and HF radio may be affected. Aurora possible.' : 'Mildly unsettled.',
    },
  }
}

export function scoreTide(inputs: Pick<ScoringInputs, 'tides' | 'coastal'>): {
  score: number
  reason?: Reason
} | null {
  if (!inputs.coastal || !inputs.tides || inputs.tides.length === 0) return null
  const highs = inputs.tides.filter((t) => t.type === 'H').map((t) => t.heightM)
  if (highs.length === 0) return { score: 100 }
  const maxHigh = Math.max(...highs)
  let score = 100
  let reason: Reason | undefined
  if (maxHigh > 3.0) {
    score = 65
    reason = {
      source: 'tide',
      tone: 'caution',
      headline: `Large tides up to ${maxHigh.toFixed(1)} m`,
      detail: 'Watch for strong currents at coastal access points.',
    }
  }
  return reason ? { score, reason } : { score }
}

export function computeSafety(inputs: ScoringInputs): SafetyScore {
  const seismic = scoreSeismic(inputs)
  const weather = scoreWeather(inputs)
  const space = scoreSpace(inputs)
  const tide = scoreTide(inputs)

  const subscores = {
    seismic: seismic.score,
    weather: weather.score,
    space: space.score,
    tide: tide ? tide.score : null,
  }

  let score: number
  if (subscores.tide === null) {
    const w = SCORING_WEIGHTS.seismic + SCORING_WEIGHTS.weather + SCORING_WEIGHTS.space
    score =
      (subscores.seismic * SCORING_WEIGHTS.seismic +
        subscores.weather * SCORING_WEIGHTS.weather +
        subscores.space * SCORING_WEIGHTS.space) /
      w
  } else {
    score =
      subscores.seismic * SCORING_WEIGHTS.seismic +
      subscores.weather * SCORING_WEIGHTS.weather +
      subscores.space * SCORING_WEIGHTS.space +
      subscores.tide * SCORING_WEIGHTS.tide
  }
  score = Math.round(score)
  const band = bandFromScore(score)

  const reasons: Reason[] = []
  if (seismic.reason) reasons.push(seismic.reason)
  if (weather.reason) reasons.push(weather.reason)
  if (space.reason) reasons.push(space.reason)
  if (tide?.reason) reasons.push(tide.reason)

  reasons.sort((a, b) => {
    const order: Record<Band, number> = { danger: 0, caution: 1, safe: 2 }
    return order[a.tone] - order[b.tone]
  })

  return { score, band, reasons, subscores }
}

export function verdictFromScore(score: number): 'go' | 'caution' | 'reconsider' {
  if (score >= 70) return 'go'
  if (score >= 45) return 'caution'
  return 'reconsider'
}
