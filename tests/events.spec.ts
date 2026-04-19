import { describe, it, expect } from 'vitest'
import {
  toSeismicEvent,
  toWeatherEvents,
  toSpaceEvents,
} from '@/composables/useEvents'
import type { Quake } from '@/services/usgs'
import type { ForecastBundle } from '@/services/openMeteo'
import type { KpSample } from '@/services/noaaKp'

const center = { lat: 40, lon: -74 }

function quake(mag: number, distanceKm = 30): Quake {
  return {
    id: `q-${mag}-${distanceKm}`,
    magnitude: mag,
    place: 'Off the coast',
    time: new Date('2026-04-18T12:00:00Z'),
    lat: 40.1,
    lon: -74.1,
    depthKm: 12,
    distanceKm,
  }
}

describe('useEvents mappers', () => {
  it('assigns danger severity to M5+ seismic events', () => {
    const e = toSeismicEvent(quake(5.2), center)
    expect(e.kind).toBe('seismic')
    expect(e.severity).toBe('danger')
    expect(e.title).toContain('M5.2')
    expect(e.distanceKm).toBeDefined()
  })

  it('assigns caution severity to M3.5 seismic events', () => {
    const e = toSeismicEvent(quake(3.6), center)
    expect(e.severity).toBe('caution')
  })

  it('drops safe-weather days from the feed', () => {
    const bundle: ForecastBundle = {
      current: { tempC: 20, windKph: 5, weatherCode: 0 },
      daily: [
        {
          date: '2026-04-19',
          tempMaxC: 22,
          tempMinC: 14,
          precipMm: 0,
          precipProb: 5,
          windMaxKph: 8,
          weatherCode: 0,
        },
        {
          date: '2026-04-20',
          tempMaxC: 21,
          tempMinC: 15,
          precipMm: 40,
          precipProb: 80,
          windMaxKph: 75,
          weatherCode: 95,
        },
      ],
    }
    const events = toWeatherEvents(bundle, center, 'Nearby')
    expect(events).toHaveLength(1)
    expect(events[0]?.severity).toBe('danger')
  })

  it('keeps only non-quiet space-weather samples', () => {
    const samples: KpSample[] = [
      { time: new Date('2026-04-19T00:00:00Z'), kp: 2.3 },
      { time: new Date('2026-04-19T03:00:00Z'), kp: 5.5 },
      { time: new Date('2026-04-19T06:00:00Z'), kp: 7.2 },
    ]
    const events = toSpaceEvents(samples)
    expect(events).toHaveLength(2)
    const byKp = events.map((e) => e.severity)
    expect(byKp).toContain('caution')
    expect(byKp).toContain('danger')
  })
})
