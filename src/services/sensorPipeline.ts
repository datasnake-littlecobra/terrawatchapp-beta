// TerraWatch — Phase 9.13.2: service layer for the /insurance/pipeline view.
//
// Three RPCs from migrations 0028 + 0029:
//   - measurements_anomalies  : rolling z-score, flags |z|>2
//   - measurements_compare    : aligned hourly pairs for two parameters
//   - measurements_correlation: pearson_r + sample count
//
// Plus a sensor-listing convenience that scopes to the DataSnake
// proprietary tier (source='datasnake', source_tier='proprietary').

import { supabase } from './supabase'
import { fetchSensors } from './measurements'
import type { Sensor } from '@/types/measurement'

// =====================================================================
// Sensor listing for the pipeline picker
// =====================================================================

export interface PipelineSensor extends Sensor {
  variant: string                // 'ds-sub-ocean' | 'ds-ground-met'
  firmware: string
  deployedAt: string
}

export async function fetchPipelineSensors(): Promise<PipelineSensor[]> {
  const sensors = await fetchSensors({ sourceTier: 'proprietary' })
  return sensors
    .filter((s) => s.source === 'datasnake')
    .map((s) => {
      const m = (s.metadata ?? {}) as Record<string, unknown>
      return {
        ...s,
        variant:    String(m['variant']    ?? ''),
        firmware:   String(m['firmware']   ?? ''),
        deployedAt: String(m['deployed_at'] ?? ''),
      } as PipelineSensor
    })
    .sort((a, b) => {
      if (a.domain !== b.domain) return a.domain.localeCompare(b.domain)
      return a.id.localeCompare(b.id)
    })
}

// Parameter sets per variant, mirroring the SQL seed spec. Used by the
// parameter picker — keeps the UI from offering a parameter the sensor
// doesn't carry.
export const VARIANT_PARAMETERS: Record<string, Array<{ key: string; label: string; unit: string }>> = {
  'ds-sub-ocean': [
    { key: 'temperature_c',        label: 'Temperature',     unit: '°C' },
    { key: 'salinity_psu',         label: 'Salinity',        unit: 'psu' },
    { key: 'pressure_dbar',        label: 'Pressure',        unit: 'dbar' },
    { key: 'dissolved_oxygen_mgl', label: 'Dissolved O₂',    unit: 'mg/L' },
    { key: 'ph',                   label: 'pH',              unit: 'pH' },
  ],
  'ds-ground-met': [
    { key: 'air_temp_c',           label: 'Air temperature', unit: '°C' },
    { key: 'humidity_pct',         label: 'Humidity',        unit: '%' },
    { key: 'soil_moisture_pct',    label: 'Soil moisture',   unit: '%' },
    { key: 'pm25_ugm3',            label: 'PM₂.₅',           unit: 'µg/m³' },
    { key: 'wind_speed_mps',       label: 'Wind speed',      unit: 'm/s' },
  ],
}

// =====================================================================
// Anomalies — rolling z-score
// =====================================================================

export interface AnomalyPoint {
  observedAt:   Date
  value:        number
  rollingMean:  number | null
  rollingStd:   number | null
  zScore:       number
  isAnomaly:    boolean
  unit:         string
}

interface AnomalyRow {
  observed_at:  string
  value:        number
  rolling_mean: number | null
  rolling_std:  number | null
  z_score:      number
  is_anomaly:   boolean
  unit:         string
}

export async function fetchAnomalies(
  sensorId: string,
  parameter: string,
  hours = 168,
): Promise<AnomalyPoint[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('measurements_anomalies', {
    sensor: sensorId,
    param:  parameter,
    hours,
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as AnomalyRow[]).map((r) => ({
    observedAt:  new Date(r.observed_at),
    value:       r.value,
    rollingMean: r.rolling_mean,
    rollingStd:  r.rolling_std,
    zScore:      r.z_score,
    isAnomaly:   r.is_anomaly,
    unit:        r.unit,
  }))
}

// =====================================================================
// Two-parameter correlation
// =====================================================================

export interface ComparePoint {
  observedAt: Date
  valueA:     number
  valueB:     number
  unitA:      string
  unitB:      string
}

interface CompareRow {
  observed_at: string
  value_a:     number
  value_b:     number
  unit_a:      string
  unit_b:      string
}

export async function fetchCompare(
  sensorId: string,
  paramA: string,
  paramB: string,
  hours = 168,
): Promise<ComparePoint[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('measurements_compare', {
    sensor:  sensorId,
    param_a: paramA,
    param_b: paramB,
    hours,
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as CompareRow[]).map((r) => ({
    observedAt: new Date(r.observed_at),
    valueA:     r.value_a,
    valueB:     r.value_b,
    unitA:      r.unit_a,
    unitB:      r.unit_b,
  }))
}

export interface CorrelationSummary {
  pearsonR:  number | null
  nSamples:  number
  unitA:     string
  unitB:     string
}

interface CorrelationRow {
  pearson_r: number | null
  n_samples: number
  unit_a:    string
  unit_b:    string
}

export async function fetchCorrelation(
  sensorId: string,
  paramA: string,
  paramB: string,
  hours = 168,
): Promise<CorrelationSummary> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('measurements_correlation', {
    sensor:  sensorId,
    param_a: paramA,
    param_b: paramB,
    hours,
  })
  if (error) throw new Error(error.message)
  const row = ((data ?? []) as CorrelationRow[])[0]
  if (!row) return { pearsonR: null, nSamples: 0, unitA: '', unitB: '' }
  return {
    pearsonR: row.pearson_r,
    nSamples: row.n_samples,
    unitA:    row.unit_a,
    unitB:    row.unit_b,
  }
}
