// TerraWatch — Phase 9.2.2: ingest-smithsonian edge function.
//
// Smithsonian Global Volcanism Program (GVP) — Weekly Volcanic Activity
// Report. Complements GDACS by catching the long-tail of volcanic activity
// (advisory / yellow-level unrest, increased seismicity, gas venting) that
// stays below GDACS's Orange+ threshold.
//
// The WVAR is published as RSS. It does not include per-item coordinates,
// so we maintain a small embedded lookup of the ~70 most-frequently-active
// volcanoes globally. Unmatched volcanoes ingest with location=null — they
// still surface in the events list and category counts, just without a
// map pin until we widen the lookup.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  capRows,
  CORS_HEADERS,
  runIngest,
  type EventRow,
  type Severity,
} from '../_shared/ingest-common.ts'

const WVAR_FEED = 'https://volcano.si.edu/news/WeeklyVolcanoRSS.xml'

// Volcano name → [lat, lon]. Names match the WVAR title's first comma-separated
// segment. Diacritics get a duplicate ASCII entry where common, since the feed
// occasionally uses one or the other.
const VOLCANO_COORDS: Record<string, [number, number]> = {
  // North America
  'Mauna Loa':         [19.475, -155.608],
  'Kilauea':           [19.421, -155.287],
  'Kīlauea':           [19.421, -155.287],
  'Mount St. Helens':  [46.200, -122.180],
  'Yellowstone':       [44.430, -110.670],
  'Pavlof':            [55.420, -161.894],
  'Cleveland':         [52.825, -169.944],
  'Shishaldin':        [54.756, -163.970],
  'Veniaminof':        [56.196, -159.389],
  'Bogoslof':          [53.930, -168.030],
  'Augustine':         [59.363, -153.435],
  'Trident':           [58.236, -155.103],
  'Great Sitkin':      [52.076, -176.130],
  'Semisopochnoi':     [51.929, 179.580],
  // Central + South America
  'Popocatépetl':      [19.023, -98.622],
  'Popocatepetl':      [19.023, -98.622],
  'Fuego':             [14.473, -90.880],
  'Pacaya':            [14.382, -90.601],
  'Santa María':       [14.756, -91.552],
  'Santa Maria':       [14.756, -91.552],
  'Santiaguito':       [14.739, -91.568],
  'Reventador':        [-0.078, -77.656],
  'Sangay':            [-2.005, -78.341],
  'Cotopaxi':          [-0.683, -78.437],
  'Tungurahua':        [-1.467, -78.442],
  'Nevado del Ruiz':   [4.892, -75.324],
  'Galeras':           [1.220, -77.359],
  'Sabancaya':         [-15.787, -71.857],
  'Ubinas':            [-16.355, -70.903],
  // Caribbean
  'Soufrière Hills':   [16.720, -62.180],
  'Soufriere Hills':   [16.720, -62.180],
  'La Soufrière':      [13.330, -61.180],
  'La Soufriere':      [13.330, -61.180],
  // Atlantic / Iceland
  'Hekla':             [63.983, -19.669],
  'Bárðarbunga':       [64.633, -17.529],
  'Bardarbunga':       [64.633, -17.529],
  'Grímsvötn':         [64.416, -17.316],
  'Grimsvotn':         [64.416, -17.316],
  'Reykjanes':         [63.880, -22.430],
  'Fagradalsfjall':    [63.900, -22.270],
  'Cumbre Vieja':      [28.570, -17.840],
  'Pico do Fogo':      [14.950, -24.350],
  // Europe
  'Etna':              [37.748, 14.999],
  'Stromboli':         [38.789, 15.213],
  'Vesuvius':          [40.821, 14.426],
  'Campi Flegrei':     [40.827, 14.139],
  // Africa
  'Nyiragongo':        [-1.520, 29.250],
  'Nyamuragira':       [-1.408, 29.200],
  'Erta Ale':          [13.601, 40.666],
  'Ol Doinyo Lengai':  [-2.764, 35.914],
  // Indonesia
  'Merapi':            [-7.540, 110.446],
  'Semeru':            [-8.108, 112.922],
  'Krakatau':          [-6.102, 105.423],
  'Anak Krakatau':     [-6.102, 105.423],
  'Ibu':               [1.488, 127.630],
  'Lewotobi':          [-8.534, 122.776],
  'Lewotobi Laki-laki':[-8.534, 122.776],
  'Marapi':            [-0.381, 100.473],
  'Sinabung':          [3.170, 98.392],
  'Dukono':            [1.693, 127.880],
  'Karangetang':       [2.781, 125.407],
  'Kerinci':           [-1.697, 101.264],
  // Philippines
  'Mayon':             [13.257, 123.685],
  'Taal':              [14.002, 120.993],
  'Pinatubo':          [15.130, 120.350],
  'Bulusan':           [12.770, 124.050],
  'Kanlaon':           [10.412, 123.132],
  // Japan
  'Sakurajima':        [31.585, 130.657],
  'Aira':              [31.593, 130.658],
  'Suwanosejima':      [29.638, 129.714],
  'Aso':               [32.884, 131.104],
  'Asosan':            [32.884, 131.104],
  'Sakurajima (Aira)': [31.585, 130.657],
  // Russia / Kamchatka
  'Sheveluch':         [56.653, 161.360],
  'Klyuchevskoy':      [56.057, 160.642],
  'Bezymianny':        [55.975, 160.595],
  'Karymsky':          [54.049, 159.443],
  'Tolbachik':         [55.832, 160.328],
  'Ebeko':             [50.686, 156.014],
  // Pacific
  'Bagana':            [-6.137, 155.196],
  'Manam':             [-4.080, 145.037],
  'Ulawun':            [-5.050, 151.330],
  'Rabaul':            [-4.271, 152.203],
  'Tinakula':          [-10.380, 165.800],
  'Yasur':             [-19.530, 169.447],
  'Ambrym':            [-16.250, 168.120],
  // New Zealand
  'Whakaari':          [-37.521, 177.182],
  'White Island':      [-37.521, 177.182],
  'Ruapehu':           [-39.281, 175.564],
  // Antarctica
  'Erebus':            [-77.530, 167.170],
  // Indian Ocean
  'Heard':             [-53.106, 73.513],
  'Piton de la Fournaise': [-21.244, 55.708],
}

// Description-text heuristic. WVAR doesn't carry severity codes, so we infer
// from language. Big eruptions / explosions / pyroclastic flows → caution.
// Routine ongoing activity → safe. Nothing here ever flags as danger;
// danger-level events come through GDACS instead.
function smithsonianSeverity(description: string): Severity {
  const d = description.toLowerCase()
  if (
    d.includes('explosive eruption') ||
    d.includes('pyroclastic') ||
    d.includes('lava flow') ||
    d.includes('evacuat') ||
    d.includes('ash plume') ||
    d.includes('eruption column')
  ) {
    return 'caution'
  }
  return 'safe'
}

interface RssItem {
  title: string
  description: string
  pubDate: string
  link: string
  guid: string
}

// RSS structure is consistent enough to parse with regex — avoids pulling in
// an XML lib. Each item block is `<item>...</item>`; fields inside use either
// raw content or CDATA.
function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = []
  const blocks = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
  for (const m of blocks) {
    const block = m[1] ?? ''
    items.push({
      title:       extractField(block, 'title'),
      description: extractField(block, 'description'),
      pubDate:     extractField(block, 'pubDate'),
      link:        extractField(block, 'link'),
      guid:        extractField(block, 'guid'),
    })
  }
  return items
}

function extractField(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`)
  const m = block.match(re)
  if (!m) return ''
  return (m[1] ?? '').trim()
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

// Title format: "Volcano, Country" — pull the volcano portion for coords lookup.
function parseTitle(title: string): { name: string; country: string | null } {
  const idx = title.indexOf(',')
  if (idx === -1) return { name: title.trim(), country: null }
  return {
    name: title.slice(0, idx).trim(),
    country: title.slice(idx + 1).trim() || null,
  }
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'TerraWatch/ingest (contact: ops@terrawatchapp.com)',
      accept: 'application/rss+xml, application/xml, text/xml',
    },
  })
  if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`)
  return await res.text()
}

async function ingestSmithsonian(): Promise<EventRow[]> {
  const xml = await fetchText(WVAR_FEED)
  const items = parseRssItems(xml)
  if (items.length === 0) {
    console.warn('[ingest:smithsonian] WVAR feed returned 0 items')
  }

  const rows: EventRow[] = []
  for (const it of items) {
    if (!it.title || !it.guid) continue
    const { name, country } = parseTitle(it.title)
    const description = stripHtml(it.description)

    const coords = VOLCANO_COORDS[name]
    const location = coords ? { lat: coords[0], lon: coords[1] } : null

    const occurred =
      (it.pubDate && new Date(it.pubDate).toISOString()) ||
      new Date().toISOString()

    rows.push({
      source: 'smithsonian.gvp',
      external_id: `gvp:${it.guid.replace(/^GVP\./, '')}`,
      kind: 'seismic',
      category: 'volcano',
      severity: smithsonianSeverity(description),
      title: name,
      summary: description.slice(0, 280),
      location,
      location_label: name,
      country,
      region: null,
      magnitude: null,
      depth_km: null,
      kp: null,
      occurred_at: occurred,
      expires_at: null,
      payload: {
        link: it.link,
        guid: it.guid,
        full_description: description,
        has_coords: coords != null,
      },
    })
  }
  return capRows(rows)
}

// Re-export CORS_HEADERS so deno doesn't tree-shake it (used by runIngest).
void CORS_HEADERS

serve((req) => runIngest('smithsonian', ingestSmithsonian, req))
