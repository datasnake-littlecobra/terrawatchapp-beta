export interface LatLon {
  lat: number
  lon: number
}

export const EARTH_RADIUS_KM = 6371

export function distanceKm(a: LatLon, b: LatLon): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLon * sinDLon
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function bboxAround(center: LatLon, radiusKm: number): {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
} {
  const dLat = radiusKm / 111
  const dLon = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180))
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLon: center.lon - dLon,
    maxLon: center.lon + dLon,
  }
}
