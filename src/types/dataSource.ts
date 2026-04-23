import type { LatLon } from '@/lib/geo'

export type SourceTier = 'public' | 'proprietary'

export interface DataSource<Req, Res> {
  id: string
  tier: SourceTier
  cacheTtlMs: number
  fetch(req: Req): Promise<Res>
}

export type FeedEventKind = 'seismic' | 'weather' | 'space' | 'tide' | 'ufo' | 'datasnake'

export interface FeedEvent {
  id: string
  kind: FeedEventKind
  severity: 'safe' | 'caution' | 'danger'
  title: string
  summary: string
  timestamp: Date
  location?: LatLon
  locationLabel?: string
  distanceKm?: number
  raw?: unknown
}
