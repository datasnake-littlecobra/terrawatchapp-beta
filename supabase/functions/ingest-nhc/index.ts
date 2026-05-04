// TerraWatch — Phase 9.2.3a: ingest-nhc edge function.
//
// NOAA National Hurricane Center publishes a clean JSON feed of currently
// active tropical systems in the Atlantic and East Pacific basins via
// CurrentStorms.json. This is the authoritative source for storm tracks +
// intensity in those basins.
//
// W. Pacific / Indian Ocean / S. Pacific typhoons are NOT in this feed —
// JTWC (US Navy) covers those basins but publishes legacy text bulletins
// rather than JSON. GDACS already catches major Pacific typhoons at
// Orange+ severity, so this gap is partially covered. Full JTWC parsing
// deferred to Phase 9.2.3b.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  capRows,
  fetchJson,
  runIngest,
  type EventRow,
  type Severity,
} from '../_shared/ingest-common.ts'

const NHC_FEED = 'https://www.nhc.noaa.gov/CurrentStorms.json'

interface NhcStorm {
  id?: string                    // e.g. "AL082024", "EP142024"
  binNumber?: string             // e.g. "AT5", "EP3"
  name?: string                  // e.g. "Helene"
  classification?: string        // TD / TS / HU / MH / EX / PTS / SD / SS / DB
  intensity?: string             // wind speed, knots
  pressure?: string              // mb
  latitudeNumeric?: number
  longitudeNumeric?: number
  movementDir?: number
  movementSpeed?: number
  lastUpdate?: string            // ISO timestamp
  publicAdvisory?: { url?: string; advNum?: string; issuance?: string }
  forecastAdvisory?: { url?: string }
  forecastTrack?: { url?: string; kmzFile?: string }
  trackCone?: { url?: string; kmzFile?: string }
}

interface NhcResponse {
  lastUpdate?: string
  activeStorms?: NhcStorm[]
}

// Classification → human-readable label + severity. Major Hurricane (Cat 3+)
// is the danger threshold; everything weaker is caution; depressions and
// post-tropical remnants drop to safe.
function classify(storm: NhcStorm): { label: string; severity: Severity } {
  const c = (storm.classification ?? '').toUpperCase()
  const windKt = Number(storm.intensity)
  // Cat 3+ threshold is 96kt sustained winds (NHC Saffir-Simpson scale).
  const isMajor = c === 'MH' || (c === 'HU' && Number.isFinite(windKt) && windKt >= 96)

  if (isMajor) return { label: 'Major Hurricane', severity: 'danger' }
  if (c === 'HU') return { label: 'Hurricane', severity: 'caution' }
  if (c === 'TS') return { label: 'Tropical Storm', severity: 'caution' }
  if (c === 'SS') return { label: 'Subtropical Storm', severity: 'caution' }
  if (c === 'TD') return { label: 'Tropical Depression', severity: 'safe' }
  if (c === 'SD') return { label: 'Subtropical Depression', severity: 'safe' }
  if (c === 'EX' || c === 'PTC' || c === 'PTS') return { label: 'Post-Tropical', severity: 'safe' }
  if (c === 'DB') return { label: 'Disturbance', severity: 'safe' }
  return { label: 'Tropical System', severity: 'safe' }
}

// NHC stores intensity in knots. Convert to mph + km/h for the summary so
// the user doesn't have to do unit math.
function knotsToMph(kt: number): number { return Math.round(kt * 1.15078) }

function summarise(storm: NhcStorm, label: string): string {
  const parts: string[] = [label]
  const windKt = Number(storm.intensity)
  if (Number.isFinite(windKt) && windKt > 0) {
    parts.push(`${knotsToMph(windKt)} mph winds`)
  }
  const pressure = Number(storm.pressure)
  if (Number.isFinite(pressure) && pressure > 0) {
    parts.push(`${pressure.toFixed(0)} mb`)
  }
  if (Number.isFinite(storm.movementSpeed) && Number.isFinite(storm.movementDir)) {
    parts.push(`moving ${storm.movementSpeed} kt @ ${storm.movementDir}°`)
  }
  return parts.join(' · ')
}

async function ingestNhc(): Promise<EventRow[]> {
  const data = await fetchJson<NhcResponse>(NHC_FEED)
  const storms = data.activeStorms ?? []
  if (storms.length === 0) {
    // Off-season Atlantic/E.Pac is genuinely empty for ~6 months/yr — info, not warn.
    console.info('[ingest:nhc] no active storms (off-season or quiet day)')
  }

  const rows: EventRow[] = []
  for (const s of storms) {
    if (!s.id || !s.name) continue
    const lat = s.latitudeNumeric
    const lon = s.longitudeNumeric
    if (lat == null || lon == null) continue

    const { label, severity } = classify(s)
    const occurred = s.lastUpdate
      ? new Date(s.lastUpdate).toISOString()
      : new Date().toISOString()

    rows.push({
      source: 'noaa.nhc',
      external_id: `nhc:${s.id}`,
      kind: 'weather',
      category: 'hurricane',
      severity,
      title: `${label} ${s.name}`,
      summary: summarise(s, label),
      location: { lat, lon },
      location_label: s.name,
      country: null,
      region: s.id.slice(0, 2),  // 'AL' = Atlantic, 'EP' = E.Pacific, 'CP' = C.Pacific
      magnitude: Number.isFinite(Number(s.intensity)) ? Number(s.intensity) : null,
      depth_km: null,
      kp: null,
      occurred_at: occurred,
      expires_at: null,
      payload: {
        classification: s.classification,
        intensity_kt: s.intensity,
        pressure_mb: s.pressure,
        movement_dir: s.movementDir,
        movement_speed_kt: s.movementSpeed,
        bin: s.binNumber,
        advisory_url: s.publicAdvisory?.url,
        forecast_url: s.forecastAdvisory?.url,
        track_kmz: s.trackCone?.kmzFile,
      },
    })
  }

  return capRows(rows)
}

serve((req) => runIngest('nhc', ingestNhc, req))
