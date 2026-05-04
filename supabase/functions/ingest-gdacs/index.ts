// TerraWatch — Phase 9.2.1: ingest-gdacs edge function.
//
// GDACS = Global Disaster Alert and Coordination System (UN/EU). Single feed
// covering global volcanoes, tropical cyclones, floods, tsunamis, and
// wildfires with severity-banded alerts (Green/Orange/Red).
//
// Why we add this: USGS volcanoes is US-only (we'd never have caught the
// Mayon eruption), NWS is US-only for floods and tsunamis, and we have no
// hurricane/cyclone source at all. GDACS fills five category gaps with one
// integration. We deliberately skip eventtype=EQ (USGS already global) and
// DR (we don't have a drought category).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  capRows,
  fetchJson,
  runIngest,
  type EventRow,
  type Kind,
  type Severity,
} from '../_shared/ingest-common.ts'

// Alert filter: only Orange + Red. Green = "no humanitarian impact expected"
// — mostly non-events that would just inflate row counts.
const GDACS_FEED =
  'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP' +
  '?eventlist=VO;TC;FL;TS;WF&alertlevel=Orange;Red'

interface GdacsFeature {
  type?: 'Feature'
  geometry?: { type: 'Point'; coordinates: [number, number] } | null
  properties?: {
    eventtype?: string
    eventid?: number | string
    episodeid?: number | string
    eventname?: string
    name?: string
    description?: string
    htmldescription?: string
    alertlevel?: string
    episodealertlevel?: string
    alertscore?: number
    episodealertscore?: number
    country?: string
    iso3?: string
    fromdate?: string
    todate?: string
    severitydata?: { severity?: number; severitytext?: string; severityunit?: string }
    url?: { report?: string; details?: string; geometry?: string }
  }
}

interface GdacsResponse {
  type?: 'FeatureCollection'
  features?: GdacsFeature[]
}

// GDACS eventtype → (TerraWatch kind, category). Anything we don't recognise
// is dropped — we don't want to surface unmapped event types as 'weather_alert'
// because the user expects categorised content from this source.
const TYPE_MAP: Record<string, { kind: Kind; category: string }> = {
  VO: { kind: 'seismic', category: 'volcano' },
  TC: { kind: 'weather', category: 'hurricane' },
  FL: { kind: 'weather', category: 'flood' },
  TS: { kind: 'seismic', category: 'tsunami' },
  WF: { kind: 'weather', category: 'wildfire' },
}

function gdacsSeverity(level: string | undefined): Severity {
  const l = (level ?? '').toLowerCase()
  if (l === 'red') return 'danger'
  if (l === 'orange') return 'caution'
  return 'safe'
}

// GDACS event names are short codes ("TC HARRIET-25"); description is a
// long HTML blob. The summary should be human-readable in 1-2 sentences,
// so we prefer severitytext when available, fall back to a short slice
// of description with HTML stripped.
function summarise(p: NonNullable<GdacsFeature['properties']>): string {
  const sev = p.severitydata
  if (sev?.severitytext) {
    return sev.severityunit
      ? `${sev.severitytext} (${sev.severityunit})`
      : sev.severitytext
  }
  const raw = p.description ?? p.htmldescription ?? ''
  const stripped = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return stripped.slice(0, 240)
}

async function ingestGdacs(): Promise<EventRow[]> {
  const data = await fetchJson<GdacsResponse>(GDACS_FEED)
  const features = data.features ?? []
  if (features.length === 0) {
    console.warn('[ingest:gdacs] empty feature list — feed returned 0 events')
  }

  const rows: EventRow[] = []
  for (const f of features) {
    const p = f.properties
    if (!p) continue
    const t = (p.eventtype ?? '').toUpperCase()
    const mapped = TYPE_MAP[t]
    if (!mapped) continue

    const id = p.eventid
    if (id == null) continue

    const coords = f.geometry?.coordinates
    const location =
      Array.isArray(coords) && coords.length >= 2
        ? { lat: coords[1], lon: coords[0] }
        : null

    const occurred =
      (p.fromdate && new Date(p.fromdate).toISOString()) ||
      new Date().toISOString()
    const expires = p.todate ? new Date(p.todate).toISOString() : null

    rows.push({
      source: 'gdacs.alerts',
      external_id: `gdacs:${t}:${id}`,
      kind: mapped.kind,
      category: mapped.category,
      severity: gdacsSeverity(p.alertlevel ?? p.episodealertlevel),
      title: p.eventname ?? p.name ?? `GDACS ${t} #${id}`,
      summary: summarise(p),
      location,
      location_label: p.country ?? null,
      country: p.country ?? null,
      region: p.iso3 ?? null,
      magnitude: null,
      depth_km: null,
      kp: null,
      occurred_at: occurred,
      expires_at: expires,
      payload: {
        eventtype: t,
        alertlevel: p.alertlevel,
        episodealertlevel: p.episodealertlevel,
        alertscore: p.alertscore ?? null,
        episodealertscore: p.episodealertscore ?? null,
        severitydata: p.severitydata ?? null,
        url: p.url ?? null,
      },
    })
  }

  return capRows(rows)
}

serve((req) => runIngest('gdacs', ingestGdacs, req))
