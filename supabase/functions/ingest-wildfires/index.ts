// TerraWatch — ingest-wildfires edge function (Phase 9.0.1).
// NASA EONET curated wildfire events. Pulled hourly from pg_cron at minute :06.
// Replaced FIRMS CSV (20k–50k raw detections) with EONET (~50-200 events).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  capRows,
  fetchJson,
  runIngest,
  type EventRow,
  type Severity,
} from '../_shared/ingest-common.ts'

const EONET_WILDFIRES_FEED =
  'https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&days=7&status=open&limit=200'

interface EonetGeometry {
  magnitudeValue: number | null
  magnitudeUnit: string | null
  date: string
  type: string
  coordinates: number[] | number[][][]
}

interface EonetEvent {
  id: string
  title: string
  description?: string
  closed: string | null
  geometry: EonetGeometry[]
}

async function ingestWildfires(): Promise<EventRow[]> {
  const data = await fetchJson<{ events: EonetEvent[] }>(EONET_WILDFIRES_FEED)
  if (!Array.isArray(data?.events)) return []
  const rows: EventRow[] = []
  for (const e of data.events) {
    if (!e.geometry?.length) continue
    const geom = e.geometry[e.geometry.length - 1]
    let lat: number | null = null
    let lon: number | null = null
    if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
      lon = (geom.coordinates as number[])[0]
      lat = (geom.coordinates as number[])[1]
    }
    const magAcres = geom.magnitudeValue
    const sev: Severity = magAcres != null && magAcres >= 10000 ? 'danger' : 'caution'
    rows.push({
      source: 'nasa.eonet',
      external_id: e.id,
      kind: 'weather',
      category: 'wildfire',
      severity: sev,
      title: e.title,
      summary:
        e.description?.trim() ||
        (lat != null ? `Active wildfire · ${lat.toFixed(2)}°, ${lon!.toFixed(2)}°` : 'Active wildfire'),
      location: lat != null && lon != null ? { lat, lon } : null,
      location_label: null,
      country: null,
      region: null,
      magnitude: magAcres ?? null,
      depth_km: null,
      kp: null,
      occurred_at: new Date(geom.date).toISOString(),
      expires_at: null,
      payload: { eonet_id: e.id, closed: e.closed, magnitude_unit: geom.magnitudeUnit ?? 'acres' },
    })
  }
  return capRows(rows)
}

serve((req) => runIngest('wildfires', ingestWildfires, req))
