// TerraWatch — Phase 8 events query layer.
// Reads from the Supabase `events` table populated by the `ingest-events`
// edge function. Consumers (e.g. useEvents) fall back to live upstream APIs
// when Supabase is unconfigured, so local dev without env vars keeps working.

import { supabase, supabaseConfigured } from './supabase'
import type { FeedEvent, FeedEventKind } from '@/types/dataSource'
import type { LatLon } from '@/lib/geo'

interface EventsNearRow {
  id: string
  source: string
  external_id: string
  kind: string
  category: string | null
  severity: 'safe' | 'caution' | 'danger'
  title: string
  summary: string
  lat: number | null
  lon: number | null
  location_label: string | null
  country: string | null
  region: string | null
  magnitude: number | null
  depth_km: number | null
  kp: number | null
  distance_km: number | null
  occurred_at: string
  expires_at: string | null
  payload: Record<string, unknown> | null
}

function normalizeKind(raw: string): FeedEventKind {
  switch (raw) {
    case 'seismic':
    case 'weather':
    case 'space':
    case 'tide':
    case 'ufo':
    case 'datasnake':
      return raw
    default:
      return 'weather'
  }
}

function rowToFeedEvent(r: EventsNearRow): FeedEvent {
  const event: FeedEvent = {
    id: `${r.source}:${r.external_id}`,
    kind: normalizeKind(r.kind),
    severity: r.severity,
    title: r.title,
    summary: r.summary,
    timestamp: new Date(r.occurred_at),
    raw: r,
  }
  if (r.category) event.category = r.category
  if (r.lat != null && r.lon != null) {
    event.location = { lat: r.lat, lon: r.lon }
  }
  if (r.location_label) event.locationLabel = r.location_label
  if (r.distance_km != null) event.distanceKm = r.distance_km
  return event
}

export interface FetchEventsOptions {
  center: LatLon
  radiusKm?: number
  sinceHours?: number
  maxRows?: number
}

export async function fetchEventsNear(opts: FetchEventsOptions): Promise<FeedEvent[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('events_near', {
    center_lat: opts.center.lat,
    center_lon: opts.center.lon,
    radius_km: opts.radiusKm ?? 500,
    since_hours: opts.sinceHours ?? 72,
    max_rows: opts.maxRows ?? 100,
  })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as EventsNearRow[]
  return rows.map(rowToFeedEvent)
}

export function canUseEventsDb(): boolean {
  return supabaseConfigured
}
