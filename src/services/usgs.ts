import { fetchJson, fetchWithCache } from './fetchWithCache'
import type { LatLon } from '@/lib/geo'
import { bboxAround, distanceKm } from '@/lib/geo'

export interface Quake {
  id: string
  magnitude: number
  place: string
  time: Date
  lat: number
  lon: number
  depthKm: number
  distanceKm?: number
}

interface FeatureCollection {
  features: Array<{
    id: string
    properties: { mag: number | null; place: string | null; time: number }
    geometry: { coordinates: [number, number, number] }
  }>
}

const BASE = 'https://earthquake.usgs.gov/fdsnws/event/1/query'

function qs(params: Record<string, string | number>): string {
  return new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString()
}

function toQuake(
  f: FeatureCollection['features'][number],
  center?: LatLon,
): Quake {
  const [lon, lat, depth] = f.geometry.coordinates
  const quake: Quake = {
    id: f.id,
    magnitude: f.properties.mag ?? 0,
    place: f.properties.place ?? 'Unknown',
    time: new Date(f.properties.time),
    lat,
    lon,
    depthKm: depth,
  }
  if (center) quake.distanceKm = distanceKm(center, { lat, lon })
  return quake
}

export async function getRecentQuakes(
  center: LatLon,
  radiusKm = 300,
  sinceHours = 72,
  minMagnitude = 2.5,
): Promise<Quake[]> {
  const key = `usgs:recent:${center.lat.toFixed(2)}:${center.lon.toFixed(2)}:${radiusKm}:${sinceHours}:${minMagnitude}`
  const starttime = new Date(Date.now() - sinceHours * 3_600_000).toISOString()
  const url = `${BASE}?${qs({
    format: 'geojson',
    starttime,
    latitude: center.lat,
    longitude: center.lon,
    maxradiuskm: radiusKm,
    minmagnitude: minMagnitude,
    orderby: 'time',
    limit: 200,
  })}`
  return fetchWithCache(key, 10 * 60_000, async () => {
    const data = await fetchJson<FeatureCollection>(url)
    return data.features.map((f) => toQuake(f, center))
  })
}

export async function getHistoricalQuakes(
  center: LatLon,
  radiusKm = 200,
  years = 5,
  minMagnitude = 4.5,
): Promise<Quake[]> {
  const key = `usgs:hist:${center.lat.toFixed(2)}:${center.lon.toFixed(2)}:${radiusKm}:${years}:${minMagnitude}`
  const starttime = new Date(Date.now() - years * 365 * 86_400_000).toISOString()
  const url = `${BASE}?${qs({
    format: 'geojson',
    starttime,
    latitude: center.lat,
    longitude: center.lon,
    maxradiuskm: radiusKm,
    minmagnitude: minMagnitude,
    orderby: 'magnitude',
    limit: 500,
  })}`
  return fetchWithCache(key, 24 * 60 * 60_000, async () => {
    const data = await fetchJson<FeatureCollection>(url)
    return data.features.map((f) => toQuake(f, center))
  })
}

export async function getBboxQuakes(
  center: LatLon,
  radiusKm = 300,
  minMagnitude = 2.5,
): Promise<Quake[]> {
  const bb = bboxAround(center, radiusKm)
  const key = `usgs:bbox:${bb.minLat.toFixed(2)}:${bb.minLon.toFixed(2)}:${bb.maxLat.toFixed(2)}:${bb.maxLon.toFixed(2)}:${minMagnitude}`
  const url = `${BASE}?${qs({
    format: 'geojson',
    minlatitude: bb.minLat,
    maxlatitude: bb.maxLat,
    minlongitude: bb.minLon,
    maxlongitude: bb.maxLon,
    minmagnitude: minMagnitude,
    orderby: 'time',
    limit: 300,
  })}`
  return fetchWithCache(key, 10 * 60_000, async () => {
    const data = await fetchJson<FeatureCollection>(url)
    return data.features.map((f) => toQuake(f, center))
  })
}
