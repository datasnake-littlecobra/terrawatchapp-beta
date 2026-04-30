// TerraWatch — ingest-space edge function (Phase 9.0.1).
// NOAA SWPC planetary K-index only. Pulled hourly from pg_cron at minute :04.
// Stores every hourly-max sample (no Kp threshold) so quiet/elevated/storm
// gradient is always visible in the feed.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  capRows,
  fetchJson,
  kpSeverity,
  runIngest,
  type EventRow,
} from '../_shared/ingest-common.ts'

const SWPC_KP_FEED = 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json'

interface Sample {
  time_tag: string
  kp_index: number | null
}

async function ingestSpace(): Promise<EventRow[]> {
  const data = await fetchJson<Sample[]>(SWPC_KP_FEED)
  if (!Array.isArray(data) || !data.length) return []

  // Bucket by hour; keep the highest Kp in each hour as the representative sample.
  const buckets = new Map<string, { time: string; kp: number }>()
  for (const s of data) {
    if (s.kp_index == null || !s.time_tag) continue
    const hour = s.time_tag.slice(0, 13)
    const cur = buckets.get(hour)
    if (!cur || s.kp_index > cur.kp) {
      buckets.set(hour, { time: s.time_tag, kp: s.kp_index })
    }
  }

  const rows: EventRow[] = []
  for (const { time, kp } of buckets.values()) {
    rows.push({
      source: 'noaa.swpc.kp',
      external_id: `kp:${time.slice(0, 13)}`,
      kind: 'space',
      category: 'geomagnetic_storm',
      severity: kpSeverity(kp),
      title: `Kp ${kp.toFixed(1)} geomagnetic ${kpSeverity(kp) === 'safe' ? 'quiet' : 'activity'}`,
      summary:
        kp >= 7
          ? 'Severe storm — GPS and HF radio likely degraded; aurora visible well outside polar regions.'
          : kp >= 5
            ? 'Minor storm — aurora possible at higher latitudes, some GPS drift.'
            : kp >= 3
              ? 'Elevated geomagnetic activity.'
              : 'Quiet geomagnetic conditions.',
      location: null,
      location_label: null,
      country: null,
      region: null,
      magnitude: null,
      depth_km: null,
      kp,
      occurred_at: new Date(time).toISOString(),
      expires_at: null,
      payload: {},
    })
  }
  return capRows(rows)
}

serve((req) => runIngest('space', ingestSpace, req))
