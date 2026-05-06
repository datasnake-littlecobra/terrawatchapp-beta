// Phase 9.6 — types for the time-series monitoring data model.
//
// Sensors are monitoring stations (NDBC buoys today, DataSnake submarines
// later). Measurements are individual (parameter, value, time) readings.
// SourceTier distinguishes public vs proprietary feeds for the UI toggle.

export type SourceTier = 'public' | 'proprietary'
export type Domain = 'ocean' | 'air' | 'land'

export interface Sensor {
  id: string                   // 'ndbc:46050'
  source: string               // 'ndbc' | 'datasnake' | future
  sourceTier: SourceTier
  name: string
  domain: Domain
  lat: number | null
  lon: number | null
  metadata: Record<string, unknown>
  distanceKm?: number          // present when fetched via sensors_near
}

// One point on a chart series. min/max equal value at raw resolution; they
// diverge when the RPC returns hourly aggregates over longer windows.
export interface MeasurementPoint {
  observedAt: Date
  value: number
  minValue: number
  maxValue: number
  unit: string
}

// Catalog of NDBC parameters we surface, with display labels. The keys
// match the `parameter` column written by ingest-ndbc.
export interface ParameterMeta {
  key: string
  label: string
  unit: string
  shortLabel: string
}

export const NDBC_PARAMETERS: ParameterMeta[] = [
  { key: 'wave_height_m',  label: 'Wave height',     unit: 'm',   shortLabel: 'Wave'  },
  { key: 'sst_c',          label: 'Sea-surface temp', unit: '°C',  shortLabel: 'SST'   },
  { key: 'wind_speed_mps', label: 'Wind speed',      unit: 'm/s', shortLabel: 'Wind'  },
  { key: 'gust_mps',       label: 'Wind gust',       unit: 'm/s', shortLabel: 'Gust'  },
  { key: 'wave_period_s',  label: 'Wave period',     unit: 's',   shortLabel: 'Period' },
  { key: 'pressure_hpa',   label: 'Air pressure',    unit: 'hPa', shortLabel: 'Press' },
  { key: 'air_temp_c',     label: 'Air temperature', unit: '°C',  shortLabel: 'Air'   },
  { key: 'dew_point_c',    label: 'Dew point',       unit: '°C',  shortLabel: 'Dew'   },
]

// Hero counters across all domains, broken out by source tier so the toggle
// can show "Public: N" vs "DataSnake: N" once that feed exists.
export interface MonitoringStats {
  domain: Domain
  sourceTier: SourceTier
  activeSensors: number
  obsLast24h: number
  freshSensors: number              // sensors that reported in the last 6h
  latestObservation: Date | null
}
