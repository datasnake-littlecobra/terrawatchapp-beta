import { fetchJson, fetchWithCache } from './fetchWithCache'
import type { LatLon } from '@/lib/geo'

export interface DailyForecast {
  date: string
  tempMaxC: number
  tempMinC: number
  precipMm: number
  precipProb: number
  windMaxKph: number
  weatherCode: number
}

export interface ForecastBundle {
  current: { tempC: number; windKph: number; weatherCode: number }
  daily: DailyForecast[]
}

interface RawResponse {
  current?: { temperature_2m: number; wind_speed_10m: number; weather_code: number }
  daily?: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_sum: number[]
    precipitation_probability_max: number[]
    wind_speed_10m_max: number[]
    weather_code: number[]
  }
}

export async function getForecast(loc: LatLon, days = 7): Promise<ForecastBundle> {
  const key = `om:fc:${loc.lat.toFixed(2)}:${loc.lon.toFixed(2)}:${days}`
  const params = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    current: 'temperature_2m,wind_speed_10m,weather_code',
    daily:
      'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code',
    forecast_days: String(Math.max(1, Math.min(16, days))),
    timezone: 'auto',
    wind_speed_unit: 'kmh',
  })
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`
  return fetchWithCache(key, 30 * 60_000, async () => {
    const data = await fetchJson<RawResponse>(url)
    const current = {
      tempC: data.current?.temperature_2m ?? 0,
      windKph: data.current?.wind_speed_10m ?? 0,
      weatherCode: data.current?.weather_code ?? 0,
    }
    const daily: DailyForecast[] = (data.daily?.time ?? []).map((t, i) => ({
      date: t,
      tempMaxC: data.daily?.temperature_2m_max[i] ?? 0,
      tempMinC: data.daily?.temperature_2m_min[i] ?? 0,
      precipMm: data.daily?.precipitation_sum[i] ?? 0,
      precipProb: data.daily?.precipitation_probability_max[i] ?? 0,
      windMaxKph: data.daily?.wind_speed_10m_max[i] ?? 0,
      weatherCode: data.daily?.weather_code[i] ?? 0,
    }))
    return { current, daily }
  })
}

export function weatherCodeLabel(code: number): string {
  if (code === 0) return 'Clear'
  if (code < 3) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code < 50) return 'Fog'
  if (code < 60) return 'Drizzle'
  if (code < 70) return 'Rain'
  if (code < 80) return 'Snow'
  if (code < 90) return 'Showers'
  return 'Thunderstorm'
}
