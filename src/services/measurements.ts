// Phase 9.6 — service layer for the monitoring (time-series) data model.
// Mirrors src/services/events.ts in shape so callers feel familiar.

import { supabase, supabaseConfigured } from './supabase'
import type {
  Sensor,
  MeasurementPoint,
  MonitoringStats,
  Domain,
  SourceTier,
} from '@/types/measurement'

interface SensorsNearRow {
  id: string
  source: string
  source_tier: SourceTier
  name: string
  domain: Domain
  lat: number | null
  lon: number | null
  metadata: Record<string, unknown> | null
  distance_km: number | null
}

interface SeriesRow {
  observed_at: string
  value: number
  min_value: number
  max_value: number
  unit: string
}

interface StatsRow {
  domain: Domain
  source_tier: SourceTier
  active_sensors: number | string
  obs_last_24h: number | string
  fresh_sensors: number | string
  latest_observation: string | null
}

function rowToSensor(r: SensorsNearRow): Sensor {
  const s: Sensor = {
    id: r.id,
    source: r.source,
    sourceTier: r.source_tier,
    name: r.name,
    domain: r.domain,
    lat: r.lat,
    lon: r.lon,
    metadata: r.metadata ?? {},
  }
  if (r.distance_km != null) s.distanceKm = r.distance_km
  return s
}

export interface FetchSensorsOptions {
  centerLat?: number
  centerLon?: number
  radiusKm?: number
  domain?: Domain
  sourceTier?: SourceTier
  maxRows?: number
}

export async function fetchSensors(opts: FetchSensorsOptions = {}): Promise<Sensor[]> {
  if (!supabase) throw new Error('Supabase not configured')
  // sensors_near defaults to (0, 0, 1000km) which is uselessly small;
  // use a giant radius when caller doesn't pass coords so we still get
  // a global list. The RPC clamps max_rows to 500 internally.
  const { data, error } = await supabase.rpc('sensors_near', {
    center_lat:        opts.centerLat ?? 0,
    center_lon:        opts.centerLon ?? 0,
    radius_km:         opts.radiusKm  ?? 200_000,
    domain_filter:     opts.domain    ?? null,
    source_tier_filter:opts.sourceTier ?? null,
    max_rows:          opts.maxRows   ?? 500,
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as SensorsNearRow[]).map(rowToSensor)
}

export interface FetchSeriesOptions {
  sensorId: string
  parameter: string
  hours?: number
}

export async function fetchSeries(opts: FetchSeriesOptions): Promise<MeasurementPoint[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('measurements_series', {
    sensor: opts.sensorId,
    param:  opts.parameter,
    hours:  opts.hours ?? 168,
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as SeriesRow[]).map((r) => ({
    observedAt: new Date(r.observed_at),
    value:      r.value,
    minValue:   r.min_value ?? r.value,
    maxValue:   r.max_value ?? r.value,
    unit:       r.unit,
  }))
}

export async function fetchMonitoringStats(): Promise<MonitoringStats[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('monitoring_stats').select('*')
  if (error) throw new Error(error.message)
  return ((data ?? []) as StatsRow[]).map((r) => ({
    domain:            r.domain,
    sourceTier:        r.source_tier,
    activeSensors:     Number(r.active_sensors),
    obsLast24h:        Number(r.obs_last_24h),
    freshSensors:      Number(r.fresh_sensors),
    latestObservation: r.latest_observation ? new Date(r.latest_observation) : null,
  }))
}

export function canUseMonitoringDb(): boolean {
  return supabaseConfigured
}
