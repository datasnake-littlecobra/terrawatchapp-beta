// TerraWatch — Phase 9.10 client wrapper for the health-monitor RPCs.
// Used by AdminHealthView. Both RPCs guard on is_admin() server-side, so
// non-admin callers just see empty results (no error).

import { requireSupabase } from './supabase'

export type HealthStatus = 'healthy' | 'degraded' | 'failing' | 'unknown'

export interface HealthSummaryRow {
  source:          string
  latestStatus:    HealthStatus
  latestTakenAt:   Date | null
  rows24h:         number
  rows7d:          number
  lastEventAt:     Date | null
  details:         Record<string, unknown>
}

export interface HealthTrendPoint {
  source: string
  bucket: Date
  status: HealthStatus
  cnt:    number
}

interface SummaryRow {
  source:          string
  latest_status:   string
  latest_taken_at: string | null
  rows_24h:        number | string
  rows_7d:         number | string
  last_event_at:   string | null
  details:         Record<string, unknown> | null
}

interface TrendRow {
  source:  string
  bucket:  string
  status:  string
  cnt:     number | string
}

function asStatus(s: string): HealthStatus {
  if (s === 'healthy' || s === 'degraded' || s === 'failing' || s === 'unknown') return s
  return 'unknown'
}

export async function fetchHealthSummary(): Promise<HealthSummaryRow[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('health_summary')
  if (error) throw error
  return ((data as SummaryRow[] | null) ?? []).map((r) => ({
    source:        r.source,
    latestStatus:  asStatus(r.latest_status),
    latestTakenAt: r.latest_taken_at ? new Date(r.latest_taken_at) : null,
    rows24h:       Number(r.rows_24h ?? 0),
    rows7d:        Number(r.rows_7d ?? 0),
    lastEventAt:   r.last_event_at ? new Date(r.last_event_at) : null,
    details:       r.details ?? {},
  }))
}

export async function fetchHealthTrend(sinceHours = 168): Promise<HealthTrendPoint[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('health_trend', { since_hours: sinceHours })
  if (error) throw error
  return ((data as TrendRow[] | null) ?? []).map((r) => ({
    source: r.source,
    bucket: new Date(r.bucket),
    status: asStatus(r.status),
    cnt:    Number(r.cnt ?? 0),
  }))
}
