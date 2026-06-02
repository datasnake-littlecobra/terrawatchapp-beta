// TerraWatch — Phase 9.18.1: service layer for /weather-intelligence
// page data fetches.

import { supabase } from './supabase'

// ---------------------------------------------------------------------
// Flash flood EP curve (UC1)
// ---------------------------------------------------------------------

export interface FlashFloodScore {
  rainfallMmWindow:    number
  rainfallMm72h:       number
  saturationEstimate:  number
  pFlood:              number
  threatLevel:         'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  samplesInWindow:     number
  lastObservationAt:   Date | null
  formula:             string
}

interface FlashFloodRow {
  rainfall_mm_window:    number | string | null
  rainfall_mm_72h:       number | string | null
  saturation_estimate:   number | string | null
  p_flood:               number | string | null
  threat_level:          'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  samples_in_window:     number
  last_observation_at:   string | null
  formula:               string
}

export async function fetchFlashFloodScore(
  sensorId: string,
  hours = 6,
): Promise<FlashFloodScore | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('weather_flash_flood_score', {
    p_sensor_id: sensorId,
    p_hours:     hours,
  })
  if (error) throw new Error(error.message)
  const row = ((data ?? []) as FlashFloodRow[])[0]
  if (!row) return null
  return {
    rainfallMmWindow:   Number(row.rainfall_mm_window  ?? 0),
    rainfallMm72h:      Number(row.rainfall_mm_72h     ?? 0),
    saturationEstimate: Number(row.saturation_estimate ?? 0.3),
    pFlood:             Number(row.p_flood             ?? 0),
    threatLevel:        row.threat_level,
    samplesInWindow:    row.samples_in_window,
    lastObservationAt:  row.last_observation_at ? new Date(row.last_observation_at) : null,
    formula:            row.formula,
  }
}

// ---------------------------------------------------------------------
// NOAA NWS sensor picker
// ---------------------------------------------------------------------

export interface NoaaNwsSensor {
  id:        string
  name:      string
  stationId: string
  city:      string | null
  state:     string | null
  lat:       number | null
  lon:       number | null
}

interface SensorRow {
  id:       string
  name:     string
  metadata: Record<string, unknown> | null
}

export async function fetchNoaaNwsSensors(): Promise<NoaaNwsSensor[]> {
  if (!supabase) return []
  // The sensors_near RPC was added in Phase 9.6. Filter to source='noaa-nws'
  // via the RPC's source_tier_filter — but the RPC filters tier, not source.
  // Just direct-select.
  const { data, error } = await supabase
    .from('sensors')
    .select('id, name, metadata, location')
    .eq('source', 'noaa-nws')
    .eq('active', true)
    .order('id', { ascending: true })
  if (error) throw new Error(error.message)
  // The location column is a PostGIS geography; we don't render the
  // geometry in the UI, just the metadata coords.
  return ((data ?? []) as SensorRow[]).map((r) => {
    const m = r.metadata ?? {}
    return {
      id:        r.id,
      name:      r.name,
      stationId: String(m['station_id'] ?? ''),
      city:      (m['city']  as string | undefined) ?? null,
      state:     (m['state'] as string | undefined) ?? null,
      lat:       null,
      lon:       null,
    }
  })
}
