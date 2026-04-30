// TerraWatch — ingest-seismic edge function (Phase 9.0.1).
// USGS earthquakes only. Pulled hourly from pg_cron at minute :00.
// Deploy with --no-verify-jwt=true; auth is the shared INGEST_SECRET header.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  capRows,
  fetchJson,
  quakeSeverity,
  runIngest,
  type EventRow,
} from '../_shared/ingest-common.ts'

// 2.5+ week feed: M2.5 floor strips micro-quake noise; payload is ~10× smaller
// than all_week.geojson, JSON.parse stays cheap.
const USGS_FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson'

interface Feature {
  id: string
  properties: {
    mag: number | null
    place: string | null
    time: number | null
    updated: number | null
    url?: string
    title?: string
    tsunami?: number
  }
  geometry: { coordinates: [number, number, number] } | null
}

async function ingestSeismic(): Promise<EventRow[]> {
  const data = await fetchJson<{ features: Feature[] }>(USGS_FEED)
  const rows: EventRow[] = []
  for (const f of data.features) {
    const mag = f.properties.mag
    const coords = f.geometry?.coordinates
    const time = f.properties.time
    if (mag == null || !coords || !time) continue
    const [lon, lat, depth] = coords
    const place = f.properties.place ?? 'Unknown location'
    const tsunami = f.properties.tsunami === 1
    rows.push({
      source: 'usgs.quakes',
      external_id: f.id,
      kind: 'seismic',
      category: tsunami ? 'tsunami' : 'earthquake',
      severity: tsunami ? 'danger' : quakeSeverity(mag),
      title: tsunami ? `M${mag.toFixed(1)} earthquake (tsunami flagged)` : `M${mag.toFixed(1)} earthquake`,
      summary: `${place} · depth ${depth.toFixed(0)} km`,
      location: { lat, lon },
      location_label: place,
      country: null,
      region: null,
      magnitude: mag,
      depth_km: depth,
      kp: null,
      occurred_at: new Date(time).toISOString(),
      expires_at: null,
      payload: {
        url: f.properties.url ?? null,
        title: f.properties.title ?? null,
        tsunami,
      },
    })
  }
  return capRows(rows)
}

serve((req) => runIngest('seismic', ingestSeismic, req))
