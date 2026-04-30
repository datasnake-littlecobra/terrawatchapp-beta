// TerraWatch — ingest-weather edge function (Phase 9.0.1).
// NWS active alerts only. Pulled hourly from pg_cron at minute :02.
// Isolated from other sources because NWS alert payloads (full descriptions
// + polygon geometries) were the dominant memory hog in the old monolith.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  capRows,
  fetchJson,
  geometryCentroid,
  nwsCategory,
  nwsSeverity,
  runIngest,
  type EventRow,
} from '../_shared/ingest-common.ts'

const NWS_ALERTS_FEED = 'https://api.weather.gov/alerts/active?limit=200'
const NWS_HEADERS: Record<string, string> = {
  'user-agent': '(terrawatchapp.com, ops@terrawatchapp.com)',
  accept: 'application/geo+json',
}

interface Alert {
  id: string
  properties: {
    event: string
    headline?: string
    description?: string
    severity?: string
    certainty?: string
    sent: string
    effective?: string
    ends?: string | null
    expires?: string | null
    areaDesc?: string
    senderName?: string
  }
  geometry: { type: string; coordinates: unknown } | null
}

async function ingestWeather(): Promise<EventRow[]> {
  const data = await fetchJson<{ features: Alert[] }>(NWS_ALERTS_FEED, { headers: NWS_HEADERS })
  const rows: EventRow[] = []
  for (const a of data.features) {
    const p = a.properties
    if (!p?.event || !p.sent) continue
    const centroid = geometryCentroid(a.geometry)
    const expires = p.ends ?? p.expires ?? null
    const category = nwsCategory(p.event)
    rows.push({
      source: 'nws.alerts',
      external_id: a.id,
      kind: 'weather',
      category,
      severity: nwsSeverity(p),
      title: p.event,
      summary: p.headline ?? (p.description?.slice(0, 240) ?? ''),
      location: centroid,
      location_label: p.areaDesc ?? null,
      country: 'US',
      region: p.areaDesc ?? null,
      magnitude: null,
      depth_km: null,
      kp: null,
      occurred_at: new Date(p.effective ?? p.sent).toISOString(),
      expires_at: expires ? new Date(expires).toISOString() : null,
      payload: {
        severity: p.severity ?? null,
        certainty: p.certainty ?? null,
        sender: p.senderName ?? null,
        event_raw: p.event,
      },
    })
  }
  return capRows(rows)
}

serve((req) => runIngest('weather', ingestWeather, req))
