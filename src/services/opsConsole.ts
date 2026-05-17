// TerraWatch — Phase 9.16: service layer for the Operations Console.
//
// Reads the four new surfaces from migration 0035:
//   - sensor_freshness     (materialized view)
//   - api_call_volume_7d   (regular view)
//   - api_request_log      (table, admin RLS)
//   - cron_job_status      (RPC over pg_cron)

import { supabase } from './supabase'

export type FreshnessStatus = 'fresh' | 'lagging' | 'stale' | 'never'

export interface FreshnessRow {
  id:                            string
  name:                          string
  source:                        string
  sourceTier:                    'public' | 'proprietary'
  domain:                        'ocean' | 'land' | 'air'
  active:                        boolean
  lat:                           number | null
  lon:                           number | null
  metadata:                      Record<string, unknown>
  lastObservedAt:                Date | null
  freshnessStatus:               FreshnessStatus
  secondsSinceLastObservation:   number | null
}

interface FreshnessDbRow {
  id:                              string
  name:                            string
  source:                          string
  source_tier:                     'public' | 'proprietary'
  domain:                          'ocean' | 'land' | 'air'
  active:                          boolean
  lat:                             number | null
  lon:                             number | null
  metadata:                        Record<string, unknown> | null
  last_observed_at:                string | null
  freshness_status:                FreshnessStatus
  seconds_since_last_observation:  number | null
}

export interface FreshnessFilters {
  domain?:     'ocean' | 'land' | 'air'
  sourceTier?: 'public' | 'proprietary'
  status?:     FreshnessStatus
  query?:      string                  // free-text id/name match
}

export async function fetchSensorFreshness(filters: FreshnessFilters = {}): Promise<FreshnessRow[]> {
  if (!supabase) return []
  let q = supabase.from('sensor_freshness').select('*').limit(500)
  if (filters.domain)     q = q.eq('domain', filters.domain)
  if (filters.sourceTier) q = q.eq('source_tier', filters.sourceTier)
  if (filters.status)     q = q.eq('freshness_status', filters.status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  let rows = ((data ?? []) as FreshnessDbRow[]).map((r) => ({
    id:                          r.id,
    name:                        r.name,
    source:                      r.source,
    sourceTier:                  r.source_tier,
    domain:                      r.domain,
    active:                      r.active,
    lat:                         r.lat,
    lon:                         r.lon,
    metadata:                    r.metadata ?? {},
    lastObservedAt:              r.last_observed_at ? new Date(r.last_observed_at) : null,
    freshnessStatus:             r.freshness_status,
    secondsSinceLastObservation: r.seconds_since_last_observation,
  }))
  if (filters.query) {
    const norm = filters.query.toLowerCase()
    rows = rows.filter((r) => r.id.toLowerCase().includes(norm) || r.name.toLowerCase().includes(norm))
  }
  // Sort: stale first (most urgent), then by name.
  const order: Record<FreshnessStatus, number> = { never: 0, stale: 1, lagging: 2, fresh: 3 }
  rows.sort((a, b) => order[a.freshnessStatus] - order[b.freshnessStatus] || a.name.localeCompare(b.name))
  return rows
}

// ---------------------------------------------------------------------
// API call volume (last 7 days, grouped per-day across all keys + per-key)
// ---------------------------------------------------------------------

export interface ApiVolumeRow {
  keyId:      string | null
  keyPrefix:  string | null
  tenantName: string | null
  day:        string                  // ISO date 'YYYY-MM-DD'
  count:      number
}

interface ApiVolumeDbRow {
  key_id:      string | null
  key_prefix:  string | null
  tenant_name: string | null
  day:         string
  count:       number
}

export async function fetchApiCallVolume7d(): Promise<ApiVolumeRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('api_call_volume_7d')
    .select('key_id, key_prefix, tenant_name, day, count')
    .order('day', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as ApiVolumeDbRow[]).map((r) => ({
    keyId:      r.key_id,
    keyPrefix:  r.key_prefix,
    tenantName: r.tenant_name,
    day:        r.day,
    count:      r.count,
  }))
}

// ---------------------------------------------------------------------
// API request log summary — last 24h aggregate
// ---------------------------------------------------------------------

export interface RequestLogSummary {
  total24h:    number
  errors24h:   number
  avgLatency:  number | null
  perEndpoint: Array<{ endpoint: string; count: number; errors: number }>
}

export async function fetchApiRequestLogSummary(): Promise<RequestLogSummary> {
  if (!supabase) return { total24h: 0, errors24h: 0, avgLatency: null, perEndpoint: [] }
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data, error } = await supabase
    .from('api_request_log')
    .select('endpoint, status_code, duration_ms')
    .gte('request_at', since)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<{ endpoint: string; status_code: number; duration_ms: number | null }>
  const total24h = rows.length
  const errors24h = rows.filter((r) => r.status_code >= 400).length
  const durations = rows.map((r) => r.duration_ms).filter((d): d is number => d != null)
  const avgLatency = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null
  const byEp = new Map<string, { count: number; errors: number }>()
  for (const r of rows) {
    const cur = byEp.get(r.endpoint) ?? { count: 0, errors: 0 }
    cur.count++
    if (r.status_code >= 400) cur.errors++
    byEp.set(r.endpoint, cur)
  }
  return {
    total24h,
    errors24h,
    avgLatency,
    perEndpoint: [...byEp.entries()].map(([endpoint, v]) => ({ endpoint, ...v })),
  }
}

// ---------------------------------------------------------------------
// pg_cron job status
// ---------------------------------------------------------------------

export interface CronJobRow {
  jobname:        string
  schedule:       string
  active:         boolean
  lastRunAt:      Date | null
  lastStatus:     string | null
  successCount:   number
  failureCount:   number
}

interface CronJobDbRow {
  jobname:        string
  schedule:       string
  active:         boolean
  last_run_at:    string | null
  last_status:    string | null
  success_count:  number
  failure_count:  number
}

export async function fetchCronJobStatus(): Promise<CronJobRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('cron_job_status')
  if (error) throw new Error(error.message)
  return ((data ?? []) as CronJobDbRow[]).map((r) => ({
    jobname:       r.jobname,
    schedule:      r.schedule,
    active:        r.active,
    lastRunAt:     r.last_run_at ? new Date(r.last_run_at) : null,
    lastStatus:    r.last_status,
    successCount:  r.success_count,
    failureCount:  r.failure_count,
  }))
}

// ---------------------------------------------------------------------
// Overview hero counters — small helper that bundles the cheap counts
// ---------------------------------------------------------------------

export interface OverviewCounters {
  totalSensors:        number
  oceanSensors:        number
  groundSensors:       number
  proprietarySensors:  number
  staleSensors:        number
  measurements24h:     number
  apiRequests24h:      number
  apiErrors24h:        number
  activeApiKeys:       number
  tenants:             number
  policies:            number
  ingestFailing:       number
}

export async function fetchOverviewCounters(): Promise<OverviewCounters> {
  if (!supabase) {
    return {
      totalSensors: 0, oceanSensors: 0, groundSensors: 0, proprietarySensors: 0,
      staleSensors: 0, measurements24h: 0, apiRequests24h: 0, apiErrors24h: 0,
      activeApiKeys: 0, tenants: 0, policies: 0, ingestFailing: 0,
    }
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

  // Run in parallel; tolerate partial failures (any one query returning
  // an error just zeros that counter, doesn't break the page).
  const [
    sensorsHead,
    oceanHead,
    groundHead,
    propHead,
    staleHead,
    measHead,
    requestSummary,
    activeKeysHead,
    tenantsHead,
    policiesHead,
    healthSummary,
  ] = await Promise.allSettled([
    supabase.from('sensors').select('id', { count: 'exact', head: true }),
    supabase.from('sensors').select('id', { count: 'exact', head: true }).eq('domain', 'ocean'),
    supabase.from('sensors').select('id', { count: 'exact', head: true }).eq('domain', 'land'),
    supabase.from('sensors').select('id', { count: 'exact', head: true }).eq('source_tier', 'proprietary'),
    supabase.from('sensor_freshness').select('id', { count: 'exact', head: true }).eq('freshness_status', 'stale'),
    supabase.from('measurements').select('sensor_id', { count: 'exact', head: true }).gte('observed_at', since),
    fetchApiRequestLogSummary(),
    supabase.from('api_keys').select('id', { count: 'exact', head: true }).is('revoked_at', null),
    supabase.from('tenants').select('id', { count: 'exact', head: true }),
    supabase.from('policies').select('id', { count: 'exact', head: true }),
    supabase.rpc('health_summary'),
  ])

  function count(p: PromiseSettledResult<{ count: number | null }>): number {
    if (p.status !== 'fulfilled') return 0
    return p.value.count ?? 0
  }

  const reqSummary: RequestLogSummary = requestSummary.status === 'fulfilled'
    ? requestSummary.value
    : { total24h: 0, errors24h: 0, avgLatency: null, perEndpoint: [] }

  let ingestFailing = 0
  if (healthSummary.status === 'fulfilled') {
    const rows = (healthSummary.value.data ?? []) as Array<{ status: string }>
    ingestFailing = rows.filter((r) => r.status === 'failing').length
  }

  return {
    totalSensors:        count(sensorsHead),
    oceanSensors:        count(oceanHead),
    groundSensors:       count(groundHead),
    proprietarySensors:  count(propHead),
    staleSensors:        count(staleHead),
    measurements24h:     count(measHead),
    apiRequests24h:      reqSummary.total24h,
    apiErrors24h:        reqSummary.errors24h,
    activeApiKeys:       count(activeKeysHead),
    tenants:             count(tenantsHead),
    policies:            count(policiesHead),
    ingestFailing,
  }
}
