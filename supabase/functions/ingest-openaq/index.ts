// TerraWatch — Phase 9.2.4: ingest-openaq edge function.
//
// OpenAQ aggregates 100+ national air-quality monitoring networks worldwide
// into one feed. Air quality data is continuous, not event-based, so we
// convert it to events by thresholding: only readings that cross the US EPA
// "Unhealthy" PM2.5 threshold (55 µg/m³) become rows. Below that, the air
// is fine and there's nothing to report.
//
// Severity tiers mirror EPA AQI categories:
//   55-150  µg/m³ → caution  (Unhealthy)
//   150-250 µg/m³ → danger   (Very Unhealthy)
//   250+    µg/m³ → danger   (Hazardous)
//
// API key is optional — without one we get rate-limited but the feed still
// works. Set OPENAQ_API_KEY via `supabase secrets set` for production.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  capRows,
  fetchJson,
  runIngest,
  type EventRow,
  type Severity,
} from '../_shared/ingest-common.ts'

// PM2.5 has parameter id 2 in OpenAQ v3. We pin the id rather than the name
// because the `/parameters/2/latest` endpoint is the only one that returns
// values inline; name-based lookups need an extra round-trip.
const OPENAQ_LATEST = 'https://api.openaq.org/v3/parameters/2/latest?limit=1000'
const OPENAQ_API_KEY = Deno.env.get('OPENAQ_API_KEY') ?? ''

const UNHEALTHY_THRESHOLD = 55          // µg/m³ — EPA "Unhealthy"
const VERY_UNHEALTHY_THRESHOLD = 150    // µg/m³ — EPA "Very Unhealthy"
const MAX_LOCATION_LOOKUPS = 50         // cap enrichment cost per run

interface OpenAqLatest {
  results?: Array<{
    locationsId?: number
    sensorsId?: number
    value?: number
    datetime?: { utc?: string; local?: string }
    coordinates?: { latitude?: number; longitude?: number }
  }>
}

interface OpenAqLocation {
  id?: number
  name?: string
  locality?: string | null
  country?: { code?: string; name?: string }
  coordinates?: { latitude?: number; longitude?: number }
}

interface OpenAqLocations {
  results?: OpenAqLocation[]
}

function pmSeverity(value: number): Severity {
  if (value >= VERY_UNHEALTHY_THRESHOLD) return 'danger'
  if (value >= UNHEALTHY_THRESHOLD) return 'caution'
  return 'safe'
}

function pmLabel(value: number): string {
  if (value >= 250) return 'Hazardous'
  if (value >= VERY_UNHEALTHY_THRESHOLD) return 'Very Unhealthy'
  if (value >= UNHEALTHY_THRESHOLD) return 'Unhealthy'
  return 'Moderate'
}

// OpenAQ accepts an optional API key via X-API-Key header. Without one the
// public rate limit kicks in around 60 req/min, which is plenty for hourly
// ingest but we set the header when we have it.
function authHeaders(): Record<string, string> {
  return OPENAQ_API_KEY ? { 'X-API-Key': OPENAQ_API_KEY } : {}
}

// Bucket the occurred_at timestamp to the hour so re-running the same cron
// cycle re-upserts the same rows (idempotent on (source, external_id)).
function hourBucket(iso: string): string {
  const d = new Date(iso)
  d.setUTCMinutes(0, 0, 0)
  return d.toISOString()
}

async function ingestOpenaq(): Promise<EventRow[]> {
  const latest = await fetchJson<OpenAqLatest>(OPENAQ_LATEST, {
    headers: authHeaders(),
  })
  const all = latest.results ?? []
  if (all.length === 0) {
    console.warn('[ingest:openaq] /parameters/2/latest returned 0 results')
    return []
  }

  // Step 1: filter to unhealthy threshold + valid coords + valid id.
  const unhealthy = all.filter((r) => {
    const v = r.value
    const lat = r.coordinates?.latitude
    const lon = r.coordinates?.longitude
    return (
      v != null && v >= UNHEALTHY_THRESHOLD &&
      lat != null && lon != null &&
      r.locationsId != null
    )
  })

  if (unhealthy.length === 0) {
    console.info('[ingest:openaq] no PM2.5 readings >= 55 µg/m³ — clean air worldwide')
    return []
  }

  // Step 2: enrich top-N with location names. Sort by value desc so the
  // worst readings always get human-readable names even if we hit the cap.
  unhealthy.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const idsToLookup = unhealthy
    .slice(0, MAX_LOCATION_LOOKUPS)
    .map((r) => r.locationsId!)
    .join(',')

  const locsByid = new Map<number, OpenAqLocation>()
  if (idsToLookup) {
    try {
      const locs = await fetchJson<OpenAqLocations>(
        `https://api.openaq.org/v3/locations?ids=${idsToLookup}&limit=${MAX_LOCATION_LOOKUPS}`,
        { headers: authHeaders() },
      )
      for (const l of locs.results ?? []) {
        if (l.id != null) locsByid.set(l.id, l)
      }
    } catch (e) {
      // Non-fatal — we'll fall back to coords-only labels.
      console.warn('[ingest:openaq] location enrichment failed:', e)
    }
  }

  // Step 3: build EventRow per unhealthy reading.
  const rows: EventRow[] = []
  for (const r of unhealthy) {
    const value = r.value!
    const lat = r.coordinates!.latitude!
    const lon = r.coordinates!.longitude!
    const occurred = hourBucket(r.datetime?.utc ?? new Date().toISOString())
    const loc = locsByid.get(r.locationsId!)

    const placeName =
      loc?.locality || loc?.name || `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`
    const country = loc?.country?.name ?? null
    const label = pmLabel(value)

    rows.push({
      source: 'openaq.pm25',
      external_id: `openaq:${r.locationsId}:${occurred.slice(0, 13)}`,  // hour bucket
      kind: 'weather',
      category: 'air_quality',
      severity: pmSeverity(value),
      title: `Air quality ${label}: ${placeName}`,
      summary: `PM2.5 reading of ${value.toFixed(0)} µg/m³ — ${label} per US EPA AQI`,
      location: { lat, lon },
      location_label: placeName,
      country,
      region: loc?.country?.code ?? null,
      magnitude: value,
      depth_km: null,
      kp: null,
      occurred_at: occurred,
      expires_at: null,
      payload: {
        pm25_ugm3: value,
        epa_label: label,
        sensor_id: r.sensorsId ?? null,
        location_id: r.locationsId,
        reading_time: r.datetime?.utc ?? null,
      },
    })
  }

  return capRows(rows)
}

serve((req) => runIngest('openaq', ingestOpenaq, req))
