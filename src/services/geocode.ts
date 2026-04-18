import { fetchJson, fetchWithCache } from './fetchWithCache'

export interface Place {
  name: string
  country: string
  admin1?: string
  lat: number
  lon: number
  timezone?: string
}

interface RawResponse {
  results?: Array<{
    name: string
    country: string
    admin1?: string
    latitude: number
    longitude: number
    timezone?: string
  }>
}

export async function searchPlaces(query: string, limit = 5): Promise<Place[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const key = `geo:${q.toLowerCase()}:${limit}`
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=${limit}&language=en&format=json`
  return fetchWithCache(key, 24 * 60 * 60_000, async () => {
    const data = await fetchJson<RawResponse>(url)
    return (data.results ?? []).map((r) => {
      const place: Place = {
        name: r.name,
        country: r.country,
        lat: r.latitude,
        lon: r.longitude,
      }
      if (r.admin1) place.admin1 = r.admin1
      if (r.timezone) place.timezone = r.timezone
      return place
    })
  })
}
