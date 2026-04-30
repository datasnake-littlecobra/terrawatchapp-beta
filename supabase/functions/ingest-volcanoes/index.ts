// TerraWatch — ingest-volcanoes edge function (Phase 9.0.1).
// USGS HANS elevated-volcanoes feed. Pulled hourly from pg_cron at minute :08.
// Tiny payload (~20 rows worldwide).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  capRows,
  fetchJson,
  runIngest,
  volcanoSeverity,
  type EventRow,
} from '../_shared/ingest-common.ts'

const USGS_VOLCANOES_FEED = 'https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes'

interface Volcano {
  volcanoName?: string
  name?: string
  observatory?: string
  alertLevel?: string
  colorCode?: string
  latitude?: number
  longitude?: number
  elevation?: number
  notice?: { sent?: string }
  sent?: string
}

async function ingestVolcanoes(): Promise<EventRow[]> {
  const data = await fetchJson<unknown>(USGS_VOLCANOES_FEED)
  // USGS HANS has shifted shape over time: sometimes a bare array, sometimes
  // wrapped in { items }, { data }, or { volcanoes }. Be permissive and log
  // the actual shape when we get nothing so we can adjust quickly.
  const obj = (data ?? {}) as Record<string, unknown>
  const list: Volcano[] = Array.isArray(data)
    ? (data as Volcano[])
    : ((obj.items as Volcano[] | undefined)
        ?? (obj.data as Volcano[] | undefined)
        ?? (obj.volcanoes as Volcano[] | undefined)
        ?? [])
  if (list.length === 0) {
    const shape = Array.isArray(data)
      ? `array(${(data as unknown[]).length})`
      : `keys=${Object.keys(obj).join(',') || '<empty>'}`
    console.warn(`[ingest:volcanoes] empty list — response shape ${shape}`)
  }
  const rows: EventRow[] = []
  for (const v of list) {
    const name = v.volcanoName ?? v.name
    const lat = v.latitude
    const lon = v.longitude
    if (!name || lat == null || lon == null) continue
    const level = v.alertLevel ?? v.colorCode ?? 'unknown'
    const sent = v.notice?.sent ?? v.sent ?? new Date().toISOString()
    rows.push({
      source: 'usgs.volcanoes',
      external_id: `volcano:${name.replace(/\s+/g, '_').toLowerCase()}`,
      kind: 'seismic',
      category: 'volcano',
      severity: volcanoSeverity(level),
      title: `Volcano alert: ${name}`,
      summary: `${v.observatory ?? 'USGS'} alert level ${level}${v.elevation ? ` · ${v.elevation.toFixed(0)} m elevation` : ''}`,
      location: { lat, lon },
      location_label: name,
      country: null,
      region: v.observatory ?? null,
      magnitude: null,
      depth_km: null,
      kp: null,
      occurred_at: new Date(sent).toISOString(),
      expires_at: null,
      payload: { alertLevel: level, colorCode: v.colorCode ?? null, observatory: v.observatory ?? null },
    })
  }
  return capRows(rows)
}

serve((req) => runIngest('volcanoes', ingestVolcanoes, req))
