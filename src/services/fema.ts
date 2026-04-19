import { fetchJson, fetchWithCache } from './fetchWithCache'
import { bboxAround, distanceKm, type LatLon } from '@/lib/geo'

export interface Shelter {
  id: string
  name: string
  address: string
  city: string | null
  state: string | null
  lat: number
  lon: number
  distanceKm: number
  capacity: number | null
  accessible: boolean | null
  petsAccepted: boolean | null
}

interface RawShelter {
  shelter_id?: string
  shelter_name?: string
  address_1?: string
  city?: string | null
  state?: string | null
  latitude?: number
  longitude?: number
  evacuation_capacity?: number | null
  ada_compliant?: string | null
  pet_accommodations_code?: string | null
}

interface FemaResponse {
  NationalShelterSystemFacilities?: RawShelter[]
}

const ENDPOINT =
  'https://www.fema.gov/api/open/v1/NationalShelterSystemFacilities'

function normalize(r: RawShelter, center: LatLon): Shelter | null {
  if (
    r.latitude === undefined ||
    r.longitude === undefined ||
    !r.shelter_id ||
    !r.shelter_name
  ) {
    return null
  }
  const loc = { lat: r.latitude, lon: r.longitude }
  const parts = [r.address_1, r.city, r.state].filter(Boolean)
  return {
    id: r.shelter_id,
    name: r.shelter_name,
    address: parts.length ? parts.join(', ') : r.shelter_name,
    city: r.city ?? null,
    state: r.state ?? null,
    lat: loc.lat,
    lon: loc.lon,
    distanceKm: distanceKm(center, loc),
    capacity:
      r.evacuation_capacity !== undefined && r.evacuation_capacity !== null
        ? Number(r.evacuation_capacity)
        : null,
    accessible:
      r.ada_compliant !== undefined && r.ada_compliant !== null
        ? /^y/i.test(r.ada_compliant)
        : null,
    petsAccepted:
      r.pet_accommodations_code !== undefined && r.pet_accommodations_code !== null
        ? !/^none$/i.test(r.pet_accommodations_code) && r.pet_accommodations_code !== ''
        : null,
  }
}

export async function getNearestShelters(
  center: LatLon,
  limit = 5,
  radiusKm = 150,
): Promise<Shelter[]> {
  const bb = bboxAround(center, radiusKm)
  const key = `fema:${bb.minLat.toFixed(2)}:${bb.minLon.toFixed(2)}:${bb.maxLat.toFixed(2)}:${bb.maxLon.toFixed(2)}`
  const filter =
    `latitude ge ${bb.minLat} and latitude le ${bb.maxLat} and ` +
    `longitude ge ${bb.minLon} and longitude le ${bb.maxLon}`
  const params = new URLSearchParams({
    $filter: filter,
    $top: '200',
    $orderby: 'shelter_name',
  })
  const url = `${ENDPOINT}?${params.toString()}`
  return fetchWithCache(key, 6 * 60 * 60_000, async () => {
    const data = await fetchJson<FemaResponse>(url)
    const raw = data.NationalShelterSystemFacilities ?? []
    const list: Shelter[] = []
    for (const r of raw) {
      const n = normalize(r, center)
      if (n) list.push(n)
    }
    list.sort((a, b) => a.distanceKm - b.distanceKm)
    return list.slice(0, limit)
  })
}
