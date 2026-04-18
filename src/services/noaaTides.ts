import { fetchJson, fetchWithCache } from './fetchWithCache'
import type { LatLon } from '@/lib/geo'
import { distanceKm } from '@/lib/geo'

export interface TideStation {
  id: string
  name: string
  lat: number
  lon: number
  distanceKm: number
}

export interface TidePrediction {
  time: Date
  heightM: number
  type: 'H' | 'L'
}

interface StationListResponse {
  stations: Array<{ id: string; name: string; lat: number; lng: number }>
}

interface PredictionsResponse {
  predictions?: Array<{ t: string; v: string; type: 'H' | 'L' }>
}

const MAX_COASTAL_KM = 50

export async function getNearestStation(loc: LatLon): Promise<TideStation | null> {
  const url =
    'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions'
  const stations = await fetchWithCache('coops:stations', 24 * 60 * 60_000, async () => {
    const data = await fetchJson<StationListResponse>(url)
    return data.stations.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lng }))
  })
  let best: TideStation | null = null
  for (const s of stations) {
    const d = distanceKm(loc, { lat: s.lat, lon: s.lon })
    if (!best || d < best.distanceKm) best = { ...s, distanceKm: d }
  }
  if (!best || best.distanceKm > MAX_COASTAL_KM) return null
  return best
}

function yyyymmdd(d: Date): string {
  const yyyy = d.getUTCFullYear().toString()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

export async function getTidePredictions(
  stationId: string,
  start: Date,
  end: Date,
): Promise<TidePrediction[]> {
  const key = `coops:pred:${stationId}:${yyyymmdd(start)}:${yyyymmdd(end)}`
  const params = new URLSearchParams({
    product: 'predictions',
    application: 'TerraWatch',
    begin_date: yyyymmdd(start),
    end_date: yyyymmdd(end),
    datum: 'MLLW',
    station: stationId,
    time_zone: 'gmt',
    units: 'metric',
    interval: 'hilo',
    format: 'json',
  })
  const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${params.toString()}`
  return fetchWithCache(key, 6 * 60 * 60_000, async () => {
    const data = await fetchJson<PredictionsResponse>(url)
    return (data.predictions ?? []).map((p) => ({
      time: new Date(`${p.t.replace(' ', 'T')}Z`),
      heightM: Number(p.v),
      type: p.type,
    }))
  })
}
