import { describe, it, expect } from 'vitest'
import {
  computeSafety,
  scoreSeismic,
  scoreWeather,
  scoreSpace,
  scoreTide,
  verdictFromScore,
} from '@/lib/scoring'
import type { Quake } from '@/services/usgs'
import type { ForecastBundle } from '@/services/openMeteo'

const now = new Date()

function quake(mag: number, hoursAgo = 6, distanceKm = 20): Quake {
  return {
    id: `q-${mag}-${hoursAgo}`,
    magnitude: mag,
    place: 'Test zone',
    time: new Date(now.getTime() - hoursAgo * 3_600_000),
    lat: 0,
    lon: 0,
    depthKm: 10,
    distanceKm,
  }
}

function calmForecast(): ForecastBundle {
  return {
    current: { tempC: 20, windKph: 8, weatherCode: 0 },
    daily: Array.from({ length: 7 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      tempMaxC: 22,
      tempMinC: 12,
      precipMm: 0,
      precipProb: 10,
      windMaxKph: 12,
      weatherCode: 1,
    })),
  }
}

describe('scoring — all green', () => {
  it('returns a high score and safe band with no reasons', () => {
    const result = computeSafety({
      recentQuakes: [],
      historicalQuakes: [],
      forecast: calmForecast(),
      kpNow: { kp: 2, time: now },
      kpForecast: [{ kp: 2, time: now }],
    })
    expect(result.score).toBeGreaterThanOrEqual(90)
    expect(result.band).toBe('safe')
    expect(result.reasons).toHaveLength(0)
  })
})

describe('scoring — seismic danger', () => {
  it('drops the seismic subscore when a strong recent quake is nearby', () => {
    const s = scoreSeismic({ recentQuakes: [quake(6.1, 3, 40)] })
    expect(s.score).toBeLessThan(50)
    expect(s.reason?.source).toBe('seismic')
    expect(s.reason?.tone).toBe('danger')
  })
})

describe('scoring — weather severe', () => {
  it('penalizes thunderstorms in the trip window', () => {
    const fc = calmForecast()
    if (fc.daily[2]) fc.daily[2].weatherCode = 95
    const w = scoreWeather({ forecast: fc, tripDays: 5 })
    expect(w.score).toBeLessThan(80)
    expect(w.reason?.tone).toBe('danger')
  })
})

describe('scoring — space weather', () => {
  it('flags a Kp 7 geomagnetic storm', () => {
    const s = scoreSpace({
      kpNow: { kp: 3, time: now },
      kpForecast: [{ kp: 7, time: now }],
    })
    expect(s.score).toBeLessThanOrEqual(25)
    expect(s.reason?.source).toBe('space')
  })
})

describe('scoring — tide missing', () => {
  it('skips tide subscore when not coastal', () => {
    const t = scoreTide({ coastal: false })
    expect(t).toBeNull()
  })
  it('composite re-weights when tide is null', () => {
    const r = computeSafety({
      recentQuakes: [quake(5.0, 2, 15)],
      forecast: calmForecast(),
      kpNow: { kp: 2, time: now },
    })
    expect(r.subscores.tide).toBeNull()
    expect(r.score).toBeLessThan(100)
  })
})

describe('verdictFromScore', () => {
  it('maps score bands to verdicts', () => {
    expect(verdictFromScore(85)).toBe('go')
    expect(verdictFromScore(55)).toBe('caution')
    expect(verdictFromScore(20)).toBe('reconsider')
  })
})
