import { fetchJson, fetchWithCache } from './fetchWithCache'

export interface KpSample {
  time: Date
  kp: number
}

export async function getCurrentKp(): Promise<KpSample> {
  const url = 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json'
  return fetchWithCache('swpc:kp:now', 10 * 60_000, async () => {
    const data = await fetchJson<Array<{ time_tag: string; kp_index: number }>>(url)
    const last = data[data.length - 1]
    if (!last) return { time: new Date(), kp: 0 }
    return { time: new Date(last.time_tag), kp: last.kp_index }
  })
}

export async function getKpForecast3day(): Promise<KpSample[]> {
  const url = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json'
  return fetchWithCache('swpc:kp:forecast3', 60 * 60_000, async () => {
    const raw = await fetchJson<string[][]>(url)
    const rows = raw.slice(1) // first row is header
    return rows
      .map((r) => ({ time: new Date(`${r[0]}Z`), kp: Number(r[1]) }))
      .filter((s) => !Number.isNaN(s.kp))
  })
}

export function kpBand(kp: number): 'quiet' | 'unsettled' | 'storm' {
  if (kp < 4) return 'quiet'
  if (kp < 5) return 'unsettled'
  return 'storm'
}
