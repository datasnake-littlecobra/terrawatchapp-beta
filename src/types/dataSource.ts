import type { LatLon } from '@/lib/geo'

export type SourceTier = 'public' | 'proprietary'

export interface DataSource<Req, Res> {
  id: string
  tier: SourceTier
  cacheTtlMs: number
  fetch(req: Req): Promise<Res>
}

export type FeedEventKind = 'seismic' | 'weather' | 'space' | 'tide' | 'ufo' | 'datasnake'

// Category leaves are open-ended on purpose — new ingest sources will add new
// values (e.g. 'flood', 'volcano', 'wildfire'). The UI maps unknown categories
// to a neutral icon rather than rejecting them, so we don't lock this down to
// a string-literal union.
export type FeedEventCategory = string

export interface FeedEvent {
  id: string
  kind: FeedEventKind
  category?: FeedEventCategory
  severity: 'safe' | 'caution' | 'danger'
  title: string
  summary: string
  timestamp: Date
  location?: LatLon
  locationLabel?: string
  distanceKm?: number
  raw?: unknown
}
