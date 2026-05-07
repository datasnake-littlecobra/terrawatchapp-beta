// TerraWatch — Phase 9.11 client wrappers for the research dashboards.
// All RPCs are public (anon-readable); no admin gate.

import { requireSupabase } from './supabase'

// ---------- Counters --------------------------------------------------

export interface ResearchCounters {
  // Atmosphere
  aqStations24h:      number
  aqCountries7d:      number
  aqMaxPm25_24h:      number
  wildfiresActive14d: number
  heatAdvisories7d:   number
  // Ocean
  buoysReporting24h:  number
  measurements24h:    number
  // Seismic
  quakesM5_30d:       number
  daysSinceM7:        number
  volcanoesActive30d: number
  // Meta
  generatedAt:        Date
}

export async function fetchResearchCounters(): Promise<ResearchCounters> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('research_counters')
  if (error) throw error
  const d = (data ?? {}) as Record<string, unknown>
  const num = (k: string) => Number((d[k] as number | string | undefined) ?? 0)
  const generatedAt = d['generated_at'] ? new Date(String(d['generated_at'])) : new Date()
  return {
    aqStations24h:      num('aq_stations_24h'),
    aqCountries7d:      num('aq_countries_7d'),
    aqMaxPm25_24h:      num('aq_max_pm25_24h'),
    wildfiresActive14d: num('wildfires_active_14d'),
    heatAdvisories7d:   num('heat_advisories_7d'),
    buoysReporting24h:  num('buoys_reporting_24h'),
    measurements24h:    num('measurements_24h'),
    quakesM5_30d:       num('quakes_m5_30d'),
    daysSinceM7:        num('days_since_m7'),
    volcanoesActive30d: num('volcanoes_active_30d'),
    generatedAt,
  }
}

// ---------- Atmosphere ------------------------------------------------

export interface AqStation {
  stationId:   string
  stationName: string
  country:     string
  region:      string
  pm25:        number
  observedAt:  Date
  lat:         number | null
  lon:         number | null
}

interface AqStationRow {
  station_id: string; station_name: string; country: string; region: string
  pm25: number | string; observed_at: string
  lat: number | string | null; lon: number | string | null
}

export async function fetchAqTopStations(sinceDays = 7, max = 50): Promise<AqStation[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('research_aq_top_stations', {
    since_days: sinceDays, max_rows: max,
  })
  if (error) throw error
  return ((data as AqStationRow[] | null) ?? []).map((r) => ({
    stationId:   r.station_id,
    stationName: r.station_name,
    country:     r.country,
    region:      r.region,
    pm25:        Number(r.pm25 ?? 0),
    observedAt:  new Date(r.observed_at),
    lat:         r.lat == null ? null : Number(r.lat),
    lon:         r.lon == null ? null : Number(r.lon),
  }))
}

export interface HeatAdvisoryRollup {
  region:     string
  count:      number
  mostSevere: string
  latest:     Date
}

export async function fetchHeatAdvisories(): Promise<HeatAdvisoryRollup[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('research_heat_advisories_active')
  if (error) throw error
  return ((data as Array<{ state_or_region: string; count: number | string; most_severe: string; latest: string }> | null) ?? [])
    .map((r) => ({
      region:     r.state_or_region,
      count:      Number(r.count ?? 0),
      mostSevere: r.most_severe ?? 'unknown',
      latest:     new Date(r.latest),
    }))
}

export interface ActiveWildfire {
  id:          string
  title:       string
  country:     string
  severity:    string
  occurredAt:  Date
  lat:         number | null
  lon:         number | null
}

export async function fetchActiveWildfires(max = 100): Promise<ActiveWildfire[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('research_active_wildfires', { max_rows: max })
  if (error) throw error
  return ((data as Array<{ id: string; title: string; country: string; severity: string; occurred_at: string; lat: number | string | null; lon: number | string | null }> | null) ?? [])
    .map((r) => ({
      id:         r.id,
      title:      r.title,
      country:    r.country,
      severity:   r.severity,
      occurredAt: new Date(r.occurred_at),
      lat:        r.lat == null ? null : Number(r.lat),
      lon:        r.lon == null ? null : Number(r.lon),
    }))
}

// ---------- Ocean -----------------------------------------------------

export interface BuoySst {
  sensorId:   string
  sensorName: string
  lat:        number | null
  lon:        number | null
  sstC:       number
  observedAt: Date
}

export async function fetchBuoySstLatest(sinceHours = 24): Promise<BuoySst[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('research_buoy_sst_latest', { since_hours: sinceHours })
  if (error) throw error
  return ((data as Array<{ sensor_id: string; sensor_name: string; lat: number | string | null; lon: number | string | null; sst_c: number | string; observed_at: string }> | null) ?? [])
    .map((r) => ({
      sensorId:   r.sensor_id,
      sensorName: r.sensor_name,
      lat:        r.lat == null ? null : Number(r.lat),
      lon:        r.lon == null ? null : Number(r.lon),
      sstC:       Number(r.sst_c ?? 0),
      observedAt: new Date(r.observed_at),
    }))
}

export interface WaveBucket { bucketM: number; cnt: number }

export async function fetchWaveDistribution(sinceHours = 24): Promise<WaveBucket[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('research_wave_height_distribution', { since_hours: sinceHours })
  if (error) throw error
  return ((data as Array<{ bucket_m: number | string; cnt: number | string }> | null) ?? [])
    .map((r) => ({ bucketM: Number(r.bucket_m), cnt: Number(r.cnt) }))
}

// ---------- Seismic ---------------------------------------------------

export interface MagFreqBin { magBin: number; cnt: number }

export async function fetchQuakeMagFreq(sinceDays = 90, binSize = 0.5): Promise<MagFreqBin[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('research_quake_mag_freq', {
    since_days: sinceDays, bin_size: binSize,
  })
  if (error) throw error
  return ((data as Array<{ mag_bin: number | string; cnt: number | string }> | null) ?? [])
    .map((r) => ({ magBin: Number(r.mag_bin), cnt: Number(r.cnt) }))
}

export interface QuakeRegion {
  region: string
  count:  number
  maxMag: number
}

export async function fetchQuakeTopRegions(sinceDays = 30, max = 10): Promise<QuakeRegion[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('research_quake_top_regions', {
    since_days: sinceDays, max_rows: max,
  })
  if (error) throw error
  return ((data as Array<{ region: string; cnt: number | string; max_mag: number | string }> | null) ?? [])
    .map((r) => ({ region: r.region, count: Number(r.cnt), maxMag: Number(r.max_mag) }))
}

export interface VolcanoEvent {
  occurredAt:   Date
  volcanoName:  string
  country:      string
  severity:     string
  source:       string
}

export async function fetchVolcanoTimeline(sinceDays = 90): Promise<VolcanoEvent[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('research_volcano_timeline', { since_days: sinceDays })
  if (error) throw error
  return ((data as Array<{ occurred_at: string; volcano_name: string; country: string; severity: string; source: string }> | null) ?? [])
    .map((r) => ({
      occurredAt:  new Date(r.occurred_at),
      volcanoName: r.volcano_name,
      country:     r.country,
      severity:    r.severity,
      source:      r.source,
    }))
}
