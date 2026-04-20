import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLocationStore } from '@/stores/location'
import { sources } from '@/services/sources'
import type { Quake } from '@/services/usgs'
import type { ForecastBundle, DailyForecast } from '@/services/openMeteo'
import type { KpSample } from '@/services/noaaKp'
import { weatherCodeLabel } from '@/services/openMeteo'
import { distanceKm, type LatLon } from '@/lib/geo'
import type { FeedEvent } from '@/types/dataSource'
import { canUseEventsDb, fetchEventsNear } from '@/services/events'

function quakeSeverity(m: number): FeedEvent['severity'] {
  if (m >= 5) return 'danger'
  if (m >= 3.5) return 'caution'
  return 'safe'
}

function weatherSeverity(d: DailyForecast): FeedEvent['severity'] {
  if (d.weatherCode >= 95 || d.windMaxKph >= 70 || d.precipMm >= 30) return 'danger'
  if (d.weatherCode >= 80 || d.windMaxKph >= 45 || d.precipMm >= 10) return 'caution'
  return 'safe'
}

function kpSeverity(kp: number): FeedEvent['severity'] {
  if (kp >= 7) return 'danger'
  if (kp >= 5) return 'caution'
  return 'safe'
}

function toSeismicEvent(q: Quake, center: LatLon): FeedEvent {
  const dist = q.distanceKm ?? distanceKm(center, { lat: q.lat, lon: q.lon })
  return {
    id: `seismic:${q.id}`,
    kind: 'seismic',
    severity: quakeSeverity(q.magnitude),
    title: `M${q.magnitude.toFixed(1)} earthquake`,
    summary: `${q.place} · ${dist.toFixed(0)} km away · depth ${q.depthKm.toFixed(0)} km`,
    timestamp: q.time,
    location: { lat: q.lat, lon: q.lon },
    locationLabel: q.place,
    distanceKm: dist,
    raw: q,
  }
}

function toWeatherEvents(bundle: ForecastBundle, center: LatLon, label: string): FeedEvent[] {
  return bundle.daily
    .map((d): FeedEvent => {
      const sev = weatherSeverity(d)
      return {
        id: `weather:${d.date}`,
        kind: 'weather',
        severity: sev,
        title: `${weatherCodeLabel(d.weatherCode)} · ${d.date.slice(5)}`,
        summary:
          `High ${d.tempMaxC.toFixed(0)}°C / Low ${d.tempMinC.toFixed(0)}°C · ` +
          `wind up to ${d.windMaxKph.toFixed(0)} km/h · ` +
          `precip ${d.precipMm.toFixed(1)} mm (${d.precipProb}% chance)`,
        timestamp: new Date(`${d.date}T00:00:00Z`),
        location: center,
        locationLabel: label,
        raw: d,
      }
    })
    .filter((e) => e.severity !== 'safe')
}

function toSpaceEvents(samples: KpSample[]): FeedEvent[] {
  return samples
    .map((s): FeedEvent => ({
      id: `space:${s.time.toISOString()}`,
      kind: 'space',
      severity: kpSeverity(s.kp),
      title: `Kp ${s.kp.toFixed(1)} geomagnetic ${kpSeverity(s.kp) === 'safe' ? 'quiet' : 'activity'}`,
      summary:
        s.kp >= 7
          ? 'Severe storm — GPS and HF radio likely degraded.'
          : s.kp >= 5
            ? 'Minor storm — aurora possible at higher latitudes, some GPS drift.'
            : 'Background activity.',
      timestamp: s.time,
      raw: s,
    }))
    .filter((e) => e.severity !== 'safe')
}

export interface UseEventsOptions {
  radiusKm?: number
  seismicSinceHours?: number
  minMagnitude?: number
  weatherDays?: number
  preferLive?: boolean
}

async function loadFromDb(
  center: LatLon,
  opts: { radiusKm: number; sinceHours: number },
): Promise<FeedEvent[]> {
  const rows = await fetchEventsNear({
    center,
    radiusKm: opts.radiusKm,
    sinceHours: opts.sinceHours,
  })
  return rows.map((e) => {
    if (e.distanceKm !== undefined || !e.location) return e
    return { ...e, distanceKm: distanceKm(center, e.location) }
  })
}

async function loadFromLive(
  center: LatLon,
  opts: {
    radiusKm: number
    seismicSinceHours: number
    minMagnitude: number
    weatherDays: number
  },
  label: string,
): Promise<FeedEvent[]> {
  const [quakes, forecast, kpForecast] = await Promise.all([
    sources.seismicRecent
      .fetch({
        center,
        radiusKm: opts.radiusKm,
        sinceHours: opts.seismicSinceHours,
        minMagnitude: opts.minMagnitude,
      })
      .catch(() => [] as Quake[]),
    sources.weatherForecast
      .fetch({ loc: center, days: opts.weatherDays })
      .catch(() => null),
    sources.spaceWeatherForecast.fetch().catch(() => [] as KpSample[]),
  ])

  return [
    ...quakes.map((q) => toSeismicEvent(q, center)),
    ...(forecast ? toWeatherEvents(forecast, center, label) : []),
    ...toSpaceEvents(kpForecast),
  ]
}

export function useEvents(options: UseEventsOptions = {}) {
  const location = useLocationStore()
  const { coords, label } = storeToRefs(location)

  const events = ref<FeedEvent[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastUpdated = ref<Date | null>(null)
  const source = ref<'db' | 'live'>('live')

  const opts = {
    radiusKm: options.radiusKm ?? 500,
    seismicSinceHours: options.seismicSinceHours ?? 72,
    minMagnitude: options.minMagnitude ?? 2.5,
    weatherDays: options.weatherDays ?? 5,
    preferLive: options.preferLive ?? false,
  }

  async function reload() {
    const center = coords.value
    if (!center) return
    loading.value = true
    error.value = null
    try {
      let out: FeedEvent[] = []
      if (!opts.preferLive && canUseEventsDb()) {
        try {
          out = await loadFromDb(center, {
            radiusKm: opts.radiusKm,
            sinceHours: opts.seismicSinceHours,
          })
          source.value = 'db'
        } catch (e) {
          // DB path failed (cold ingest, RLS tweak, network blip) — fall
          // through to live APIs so the UI never goes blank.
          console.warn('[events] db query failed, falling back to live APIs', e)
          out = await loadFromLive(center, opts, label.value ?? 'Nearby')
          source.value = 'live'
        }
      } else {
        out = await loadFromLive(center, opts, label.value ?? 'Nearby')
        source.value = 'live'
      }

      out.sort((a, b) => {
        const severityRank = { danger: 0, caution: 1, safe: 2 }
        const diff = severityRank[a.severity] - severityRank[b.severity]
        if (diff !== 0) return diff
        return b.timestamp.getTime() - a.timestamp.getTime()
      })
      events.value = out
      lastUpdated.value = new Date()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load events'
    } finally {
      loading.value = false
    }
  }

  watch(
    coords,
    (c) => {
      if (c) void reload()
    },
    { immediate: true },
  )

  const nearest = computed(() =>
    [...events.value]
      .filter((e) => e.distanceKm !== undefined)
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
      .slice(0, 3),
  )

  return { events, nearest, loading, error, lastUpdated, reload, source }
}

export { toSeismicEvent, toWeatherEvents, toSpaceEvents }
