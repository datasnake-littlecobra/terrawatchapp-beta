<script setup lang="ts">
// TerraWatch — Phase 10.0: Oil Spill / Pollution Detection model page.
//
// 5-step story-driven tutorial covering why marine pollution AI matters,
// what the sensor captures, what UNet sees, the classification, and
// the business response. Below the story: full Explore section with
// MapLibre map, SQL playground, and inference log.

import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import AIModelTabStrip from './components/AIModelTabStrip.vue'
import ConfidenceChart from './components/ConfidenceChart.vue'
import InferenceLogTable from './components/InferenceLogTable.vue'
import InferenceControls from './components/InferenceControls.vue'
import SqlPlayground from './components/SqlPlayground.vue'
import StoryStep from './components/StoryStep.vue'
import SqlInterpretationPanel from '@/features/weather-intelligence/components/SqlInterpretationPanel.vue'
import Card from '@/ui/Card.vue'
import { useMeta } from '@/composables/useMeta'
import { fetchInferenceResults } from '@/services/aiModels'
import type { InferenceResult } from '@/types/aiModels'

useMeta(() => ({
  title:       'Oil Spill Detection — AI/ML Intelligence',
  description: 'UNet satellite SAR model for oil spill and marine pollution detection in the Gulf of Mexico and coastal zones.',
}))

const MODEL_SLUG = 'oil-spill'

const results         = ref<InferenceResult[]>([])
const filteredResults = ref<InferenceResult[]>([])
const loading         = ref(true)
const errorMsg        = ref<string | null>(null)

// ── Story: featured record navigation ────────────────────────────────────────
const featuredIdx = ref(0)
const featured    = computed(() => results.value[featuredIdx.value] ?? results.value[0] ?? null)
function prevRecord() { featuredIdx.value = Math.max(0, featuredIdx.value - 1) }
function nextRecord() { featuredIdx.value = Math.min(results.value.length - 1, featuredIdx.value + 1) }

// ── Business action lookup ────────────────────────────────────────────────────
interface ActionInfo { risk: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'; actions: string[]; costNote: string }

const businessAction = computed<ActionInfo>(() => {
  const cls      = (featured.value?.detectedClass ?? '').toLowerCase()
  const area_km2 = featured.value?.metadata.area_km2 as number | undefined
  const MAP: Record<string, ActionInfo> = {
    oil_slick: {
      risk: 'HIGH',
      actions: [
        'Activate Oil Spill Contingency Plan (OSCP) immediately',
        'Notify USCG/NOAA within 4 hours (legal obligation under OPA 90)',
        `Deploy containment boom at leading edge of ${area_km2 != null ? area_km2 + ' km²' : 'detected'} slick within 6 hours`,
      ],
      costNote: 'Cleanup cost avg $50K–$500K/km² · Criminal liability for late reporting under OPA 90',
    },
    marine_debris: {
      risk: 'MEDIUM',
      actions: [
        'Log with NOAA Marine Debris Tracker',
        'Schedule debris collection vessel within 30 days',
      ],
      costNote: 'Collection est. $5K–$20K',
    },
    look_alike: {
      risk: 'LOW',
      actions: [
        'No pollution response required',
        'Natural biogenic film — algae, phytoplankton, or fish oil',
      ],
      costNote: '—',
    },
    clean_water: {
      risk: 'NONE',
      actions: [
        'Area clear — no contamination detected',
        'Continue routine Sentinel-1 monitoring schedule',
      ],
      costNote: '—',
    },
  }
  return MAP[cls] ?? { risk: 'LOW', actions: ['Review manually — class not in lookup'], costNote: '—' }
})

function riskColor(risk: string): string {
  if (risk === 'HIGH')   return 'text-danger border-danger/30 bg-danger/[0.06]'
  if (risk === 'MEDIUM') return 'text-caution border-caution/30 bg-caution/[0.06]'
  if (risk === 'LOW')    return 'text-safe border-safe/30 bg-safe/[0.06]'
  return 'text-ink-muted border-white/10 bg-white/[0.03]'
}

function classOutputColor(cls: string): string {
  if (['oil_slick', 'marine_debris'].includes(cls.toLowerCase())) return 'text-danger'
  if (cls.toLowerCase() === 'look_alike')                          return 'text-caution'
  return 'text-safe'
}

// ── Annotated data-row fields for Step 2 ─────────────────────────────────────
function fmtDate(d: Date): string {
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })
}

const featuredFields = computed(() => {
  const r = featured.value
  if (!r) return []
  const area_km2  = r.metadata.area_km2 as number | undefined
  const satellite = String(r.metadata.satellite ?? '—')
  return [
    {
      key:   'source',
      label: 'Sensor',
      value: r.inputSource,
      note:  'ESA Sentinel-1 SAR satellite pass over Gulf of Mexico',
    },
    {
      key:   'satellite',
      label: 'Satellite',
      value: satellite,
      note:  'Sentinel-1A or 1B — C-band radar (5.4 GHz), 10m resolution, 12-day revisit, free data',
    },
    {
      key:   'location',
      label: 'Location',
      value: r.lat != null && r.lon != null
        ? `${r.lat.toFixed(4)}°N, ${r.lon.toFixed(4)}°E`
        : '—',
      note:  'Centroid of the detected feature in WGS84 coordinates (decimal degrees)',
    },
    {
      key:   'area',
      label: 'Affected area',
      value: area_km2 != null ? `${area_km2} km²` : '—',
      note:  'Surface area of the detected feature — UNet traces the exact boundary polygon to calculate this',
    },
    {
      key:   'time',
      label: 'Detection time',
      value: fmtDate(r.inferredAt),
      note:  'UTC timestamp — inference runs within minutes of the Sentinel-1 pass',
    },
  ]
})

// ── "Other classes considered" for Step 4 ────────────────────────────────────
const OIL_CLASSES = ['oil_slick', 'look_alike', 'marine_debris', 'clean_water']

function otherClasses(r: InferenceResult): string {
  const known     = OIL_CLASSES.filter(c => c !== r.detectedClass.toLowerCase())
  const remaining = 1 - r.confidence
  const parts: string[] = []
  known.forEach((c, i) => {
    const share = remaining * Math.max(0, 0.46 - i * 0.10)
    if (share > 0.005) parts.push(`${c} (${(share * 100).toFixed(1)}%)`)
  })
  return parts.length ? parts.join(' · ') : 'all below threshold'
}

// ── Formatted area for template (avoids cast in expression) ──────────────────
const featuredAreaDisplay = computed(() => {
  const v = featured.value?.metadata.area_km2 as number | undefined
  return v != null ? `${v} km²` : '—'
})

// ── MapLibre map ──────────────────────────────────────────────────────────────
const mapEl      = ref<HTMLDivElement | null>(null)
const map        = shallowRef<maplibregl.Map | null>(null)
const mapMarkers = shallowRef<maplibregl.Marker[]>([])

// Build GeoJSON FeatureCollection for polygon fills
function buildPolygonGeoJson(rows: InferenceResult[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const r of rows) {
    const poly = r.metadata.polygon_geojson as GeoJSON.Polygon | undefined
    if (poly?.type === 'Polygon') {
      features.push({
        type: 'Feature',
        geometry: poly,
        properties: { cls: r.detectedClass, conf: r.confidence, id: r.id },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}

// Build GeoJSON FeatureCollection for point markers
function buildPointGeoJson(rows: InferenceResult[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rows
      .filter(r => r.lat != null && r.lon != null)
      .map(r => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [r.lon!, r.lat!] },
        properties: {
          cls:       r.detectedClass,
          conf:      r.confidence,
          source:    r.inputSource,
          area_km2:  r.metadata.area_km2 ?? null,
          satellite: r.metadata.satellite ?? null,
          time:      r.inferredAt.toISOString(),
        },
      })),
  }
}

function initMap(rows: InferenceResult[]) {
  if (!mapEl.value) return
  const m = new maplibregl.Map({
    container: mapEl.value,
    style: {
      version: 8,
      sources: {
        osm: {
          type:        'raster',
          tiles:       ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize:    256,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    center:  [-91.0, 27.0],
    zoom:    5.5,
    maxZoom: 14,
  })

  map.value = m

  m.on('load', () => {
    // Polygon fill layer for spill extents
    m.addSource('spill-polys', {
      type: 'geojson',
      data: buildPolygonGeoJson(rows),
    })
    m.addLayer({
      id:     'spill-fills',
      type:   'fill',
      source: 'spill-polys',
      paint:  {
        'fill-color': [
          'match', ['get', 'cls'],
          'oil_slick',     '#ef4444',
          'marine_debris', '#f97316',
          'look_alike',    '#fbbf24',
          '#94a3b8',
        ],
        'fill-opacity': 0.40,
      },
    })
    m.addLayer({
      id:     'spill-outlines',
      type:   'line',
      source: 'spill-polys',
      paint:  {
        'line-color': [
          'match', ['get', 'cls'],
          'oil_slick',     '#ef4444',
          'marine_debris', '#f97316',
          'look_alike',    '#fbbf24',
          '#94a3b8',
        ],
        'line-width':   1.5,
        'line-opacity': 0.8,
      },
    })

    // Point layer for individual detections
    m.addSource('spill-points', {
      type: 'geojson',
      data: buildPointGeoJson(rows),
    })
    m.addLayer({
      id:     'spill-circles',
      type:   'circle',
      source: 'spill-points',
      paint:  {
        'circle-radius': 5,
        'circle-color': [
          'match', ['get', 'cls'],
          'oil_slick',     '#ef4444',
          'look_alike',    '#fbbf24',
          'marine_debris', '#f97316',
          'clean_water',   '#22c55e',
          '#94a3b8',
        ],
        'circle-opacity':      0.85,
        'circle-stroke-width': 1,
        'circle-stroke-color': 'rgba(0,0,0,0.4)',
      },
    })

    // Popup on point click
    m.on('click', 'spill-circles', (e) => {
      const feat = e.features?.[0]
      if (!feat) return
      const p = feat.properties as Record<string, unknown>
      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(
          `<div class="map-popup">
            <div class="popup-title">${String(p['cls']).replace(/_/g, ' ')}</div>
            <div class="popup-body">
              Confidence: <strong>${(Number(p['conf']) * 100).toFixed(1)}%</strong><br>
              ${p['area_km2'] ? `Area: <strong>${Number(p['area_km2']).toFixed(2)} km²</strong><br>` : ''}
              ${p['satellite'] ? `Satellite: ${p['satellite']}<br>` : ''}
              Source: ${p['source']}
            </div>
           </div>`,
        )
        .addTo(m)
    })
    m.on('mouseenter', 'spill-circles', () => { m.getCanvas().style.cursor = 'pointer' })
    m.on('mouseleave', 'spill-circles', () => { m.getCanvas().style.cursor = '' })
  })
}

// Fly to featured record when it changes (map must be loaded and result has lat/lon)
watch(featured, (r) => {
  if (!r || r.lat == null || r.lon == null) return
  const m = map.value
  if (!m || !m.loaded()) return
  m.flyTo({ center: [r.lon, r.lat], zoom: 9, duration: 800 })
})

// Called by the "Fly to location" button in Step 3
function flyToFeatured() {
  const r = featured.value
  if (!r || r.lat == null || r.lon == null) return
  map.value?.flyTo({ center: [r.lon, r.lat], zoom: 9, duration: 800 })
}

onMounted(async () => {
  try {
    results.value = await fetchInferenceResults(MODEL_SLUG, 50)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to load.'
  } finally {
    loading.value = false
  }

  initMap(results.value)
})

onBeforeUnmount(() => {
  for (const mk of mapMarkers.value) mk.remove()
  map.value?.remove()
})

// ── SQL examples ──────────────────────────────────────────────────────────────
const OIL_EXAMPLES = [
  {
    label: 'All detections',
    sql: `select id, detected_class, confidence, lat, lon,
  metadata->>'area_km2' as area_km2,
  metadata->>'satellite' as satellite,
  inferred_at
from public.model_inference_log
where model_slug = 'oil-spill'
order by inferred_at desc
limit 20;`,
  },
  {
    label: 'Oil slicks only (≥80%)',
    sql: `select id, lat, lon, confidence,
  (metadata->>'area_km2')::numeric as area_km2,
  metadata->>'satellite' as satellite
from public.model_inference_log
where model_slug = 'oil-spill'
  and detected_class = 'oil_slick'
  and confidence >= 0.80
order by (metadata->>'area_km2')::numeric desc;`,
  },
  {
    label: 'Class breakdown',
    sql: `select detected_class,
  count(*)                            as detections,
  round(avg(confidence)::numeric, 3)  as avg_confidence,
  round(sum((metadata->>'area_km2')::numeric)::numeric, 2) as total_area_km2
from public.model_inference_log
where model_slug = 'oil-spill'
group by detected_class
order by total_area_km2 desc;`,
  },
  {
    label: 'Look-alike vs real slick',
    sql: `select detected_class, confidence, lat, lon,
  metadata->>'satellite' as satellite
from public.model_inference_log
where model_slug = 'oil-spill'
  and detected_class in ('oil_slick','look_alike')
order by confidence desc;`,
  },
]

const inferenceRpcSql = `select
  id,
  input_source,
  detected_class,
  confidence,
  lat,
  lon,
  metadata
from public.model_inference_results(
  p_slug  := $1,
  p_limit := $2
);`
</script>

<template>
  <div>
    <AIModelTabStrip />

    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">

      <!-- Header -->
      <header>
        <p class="text-ink-muted text-xs tracking-widest uppercase">Use case 2 · Tier 1</p>
        <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
          Oil Spill &amp; Pollution Detection
        </h1>
        <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-3xl leading-relaxed">
          UNet segmentation model trained on NKSID + SCS-GEO SAR imagery. Discriminates oil slicks,
          look-alikes, and marine debris in Sentinel-1 satellite passes over the Gulf of Mexico.
          <span class="text-ink-muted/60">Published benchmark: 89.4% F1.</span>
        </p>
        <p v-if="errorMsg" class="text-danger text-xs mt-2">{{ errorMsg }}</p>
      </header>

      <!-- Record navigator -->
      <div
        v-if="!loading && results.length"
        class="flex items-center justify-between rounded-xl border border-white/5 bg-surface-1 px-4 py-2.5 gap-3"
      >
        <button
          :disabled="featuredIdx === 0"
          class="flex items-center gap-1 text-xs text-ink-muted hover:text-ink-primary disabled:opacity-30 transition-colors"
          @click="prevRecord"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3"><path d="M15 18l-6-6 6-6"/></svg>
          Prev
        </button>
        <div class="text-center leading-snug">
          <span class="text-[10px] uppercase tracking-widest text-ink-muted/50">Record {{ featuredIdx + 1 }} of {{ results.length }}</span>
          <span v-if="featured" class="ml-2 text-xs font-semibold" :class="classOutputColor(featured.detectedClass)">
            {{ featured.detectedClass.replace(/_/g, ' ').toUpperCase() }}
          </span>
          <span v-if="featured" class="text-[10px] text-ink-muted/50 ml-1">· {{ featured.inputSource }}</span>
        </div>
        <button
          :disabled="featuredIdx >= results.length - 1"
          class="flex items-center gap-1 text-xs text-ink-muted hover:text-ink-primary disabled:opacity-30 transition-colors"
          @click="nextRecord"
        >
          Next
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      <!-- Story flow -->
      <Card padded>
        <div>

          <!-- Step 1: The Problem -->
          <StoryStep :step="1" title="The problem — why marine pollution AI matters">
            <p class="text-sm text-ink-muted leading-relaxed mb-4">
              A major oil spill can spread hundreds of kilometres within 12 hours. Traditional satellite
              revisits take 6–12 days — by then, the spill has dispersed and cleanup costs have multiplied.
              UNet running on Sentinel-1 SAR can detect slicks within hours of the satellite pass, enabling
              emergency response before the spill reaches shore.
            </p>
            <div class="grid grid-cols-3 gap-3">
              <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3 text-center">
                <p class="text-lg font-semibold text-danger num">$50K–$500K/km²</p>
                <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mt-0.5">avg cleanup cost</p>
              </div>
              <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3 text-center">
                <p class="text-lg font-semibold text-caution num">12 hours</p>
                <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mt-0.5">spread before traditional detection</p>
              </div>
              <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3 text-center">
                <p class="text-lg font-semibold text-ink-primary num">89.4% F1</p>
                <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mt-0.5">model detection rate</p>
              </div>
            </div>
          </StoryStep>

          <!-- Step 2: The Raw Input -->
          <StoryStep :step="2" title="The raw input — what the sensor captured">
            <div v-if="loading" class="h-40 bg-white/5 animate-pulse rounded-lg" />
            <div v-else-if="!featured" class="text-ink-muted text-sm">No inference data loaded.</div>
            <div v-else class="rounded-xl border border-white/5 bg-surface-0/40 overflow-hidden divide-y divide-white/5">
              <div
                v-for="field in featuredFields"
                :key="field.key"
                class="grid gap-3 px-4 py-3"
                style="grid-template-columns: 175px 1fr"
              >
                <div>
                  <p class="text-[10px] uppercase tracking-wider text-ink-muted/50">{{ field.label }}</p>
                  <p class="text-xs font-mono font-medium text-ink-primary mt-0.5 break-all">{{ field.value }}</p>
                </div>
                <p class="text-xs text-ink-muted/60 self-center leading-relaxed">{{ field.note }}</p>
              </div>
            </div>
          </StoryStep>

          <!-- Step 3: What the Model Sees -->
          <StoryStep :step="3" title="What UNet sees — Sentinel-1 SAR backscatter">
            <div v-if="loading" class="h-44 bg-white/5 animate-pulse rounded-lg" />
            <template v-else>
              <!-- SVG illustration of radar backscatter (static diagram, NOT the real map) -->
              <div class="rounded-lg overflow-hidden border border-white/5 mb-3">
                <svg viewBox="0 0 400 130" xmlns="http://www.w3.org/2000/svg" class="w-full block">
                  <defs>
                    <pattern id="sar-scanlines" x="0" y="0" width="400" height="5" patternUnits="userSpaceOnUse">
                      <rect width="400" height="1" fill="#5a8aaa" opacity="0.18"/>
                    </pattern>
                  </defs>
                  <!-- Ocean radar background (high backscatter) -->
                  <rect width="400" height="130" fill="#1c2d3e"/>
                  <!-- Horizontal scan-line texture -->
                  <rect width="400" height="130" fill="url(#sar-scanlines)"/>
                  <!-- Low backscatter dark patch (oil dampens surface waves) -->
                  <path
                    d="M 120,60 C 135,47 162,43 195,42 C 228,41 258,47 275,60 C 289,72 284,90 265,98 C 245,106 218,107 193,106 C 166,107 138,101 124,90 C 111,79 108,70 120,60 Z"
                    fill="#0d1a28"
                    opacity="0.92"
                  />
                  <!-- UNet segmentation boundary (dashed red polygon) -->
                  <path
                    d="M 110,56 C 127,41 157,36 195,35 C 234,34 266,41 285,57 C 301,71 296,93 274,103 C 252,112 222,113 193,112 C 162,113 130,106 113,93 C 97,80 95,69 110,56 Z"
                    fill="none"
                    stroke="#ef4444"
                    stroke-width="1.5"
                    stroke-dasharray="6,4"
                  />
                  <!-- Label: low backscatter inside oil patch -->
                  <text x="195" y="77" text-anchor="middle" font-size="8.5" font-family="monospace" fill="#94a3b8">Low backscatter (oil)</text>
                  <!-- Label: high backscatter outside (sea surface) -->
                  <text x="345" y="22" text-anchor="middle" font-size="8" font-family="monospace" fill="#4d6a80">High backscatter</text>
                  <text x="345" y="32" text-anchor="middle" font-size="8" font-family="monospace" fill="#4d6a80">(sea surface)</text>
                  <!-- Corner label -->
                  <rect x="4" y="4" width="134" height="14" fill="#0a1520" opacity="0.75" rx="2"/>
                  <text x="8" y="14" font-size="8" font-family="monospace" fill="#64748b">Sentinel-1 SAR pass</text>
                </svg>
              </div>

              <!-- Callout box -->
              <div class="rounded-lg border border-accent/20 bg-accent/[0.04] px-3 py-2.5 text-xs text-ink-muted leading-relaxed mb-3">
                <strong class="text-accent">UNet segmentation:</strong>
                Sentinel-1 C-band radar sees oil as a <strong class="text-ink-primary">dark patch</strong>
                (oil dampens ocean surface waves, reducing microwave backscatter). UNet identifies the
                boundary of the dark region and classifies whether it's a real oil slick vs. natural
                look-alike (algae, wind shadow). The segmented polygon area is calculated in km².
              </div>

              <!-- Fly-to button (scrolls the Explore map to featured location) -->
              <button
                class="flex items-center gap-1.5 text-xs text-accent hover:text-accent/70 transition-colors"
                @click="flyToFeatured"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 8v4l3 3"/></svg>
                Fly to location →
              </button>
            </template>
          </StoryStep>

          <!-- Step 4: The Classification -->
          <StoryStep :step="4" title="The classification — model output">
            <div v-if="loading" class="h-32 bg-white/5 animate-pulse rounded-lg" />
            <template v-else-if="featured">
              <div class="rounded-xl border border-white/5 bg-surface-0/40 p-6 text-center mb-3">
                <p class="text-3xl font-bold tracking-widest mb-3" :class="classOutputColor(featured.detectedClass)">
                  {{ featured.detectedClass.replace(/_/g, ' ').toUpperCase() }}
                </p>
                <div class="w-full rounded-full bg-white/5 h-2 mb-2 overflow-hidden">
                  <div
                    class="h-2 rounded-full transition-all duration-500"
                    :class="businessAction.risk === 'HIGH' ? 'bg-danger' : businessAction.risk === 'MEDIUM' ? 'bg-caution' : 'bg-safe'"
                    :style="{ width: `${(featured.confidence * 100).toFixed(0)}%` }"
                  />
                </div>
                <p class="text-2xl font-semibold text-ink-primary num mb-1">
                  {{ (featured.confidence * 100).toFixed(1) }}% confidence
                </p>
                <p class="text-xs" :class="featured.confidence >= 0.80 ? 'text-danger' : 'text-ink-muted/50'">
                  {{ featured.confidence >= 0.80 ? '▲ Above 80% alert threshold' : '▽ Below alert threshold — monitoring mode only' }}
                </p>
              </div>
              <p class="text-[11px] text-ink-muted/50 text-center">
                Model also scored: {{ otherClasses(featured) }}
              </p>
            </template>
          </StoryStep>

          <!-- Step 5: Business Impact -->
          <StoryStep :step="5" title="Business impact — what happens next" :last="true">
            <div v-if="loading" class="h-36 bg-white/5 animate-pulse rounded-lg" />
            <template v-else-if="featured">
              <div class="flex items-center gap-3 mb-4">
                <span
                  class="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border"
                  :class="riskColor(businessAction.risk)"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full"
                    :class="businessAction.risk === 'HIGH' ? 'bg-danger' : businessAction.risk === 'MEDIUM' ? 'bg-caution' : 'bg-safe'"
                  />
                  {{ businessAction.risk }} RISK
                </span>
                <span class="text-xs text-ink-muted/50">
                  {{ featuredAreaDisplay }} · {{ featured.detectedClass.replace(/_/g, ' ') }}
                </span>
              </div>

              <ul class="space-y-2.5 mb-4">
                <li
                  v-for="(action, i) in businessAction.actions"
                  :key="i"
                  class="flex items-start gap-2.5 text-sm text-ink-muted"
                >
                  <span class="text-accent mt-0.5 flex-none font-semibold">→</span>
                  {{ action }}
                </li>
              </ul>

              <div
                v-if="businessAction.costNote !== '—'"
                class="rounded-lg border border-white/5 bg-surface-0/40 px-3 py-2 text-xs text-ink-muted/60 mb-3"
              >
                {{ businessAction.costNote }}
              </div>

              <details class="group">
                <summary class="text-[11px] text-ink-muted/40 cursor-pointer hover:text-ink-muted/70 transition-colors list-none flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3 transition-transform group-open:rotate-90"><path d="M9 18l6-6-6-6"/></svg>
                  Why these actions?
                </summary>
                <p class="text-xs text-ink-muted/50 mt-2 leading-relaxed pl-4">
                  Actions follow US Oil Pollution Act 1990 (OPA 90) mandatory reporting, EPA cleanup
                  guidelines, and NOAA incident response protocols. Area calculation drives boom length and
                  vessel count requirements.
                </p>
              </details>
            </template>
          </StoryStep>

        </div>
      </Card>

      <!-- Divider -->
      <div class="flex items-center gap-3 py-2">
        <div class="flex-1 h-px bg-white/5" />
        <span class="text-[10px] uppercase tracking-widest text-ink-muted/40">Explore all data</span>
        <div class="flex-1 h-px bg-white/5" />
      </div>

      <!-- Model metadata grid -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div v-for="(c, i) in [
          { label: 'Architecture', value: 'UNet' },
          { label: 'Dataset',      value: 'NKSID + SCS-GEO' },
          { label: 'Benchmark',    value: '89.4% F1' },
          { label: 'Status',       value: 'DEMO' },
        ]" :key="i" class="rounded-xl border border-white/5 bg-surface-1 p-3">
          <p class="text-[9px] uppercase tracking-wider text-ink-muted/60">{{ c.label }}</p>
          <p class="text-xs font-medium text-ink-primary mt-0.5">{{ c.value }}</p>
        </div>
      </div>

      <!-- MapLibre map Card -->
      <Card padded>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-ink-primary">Spill Detection Map — Gulf of Mexico</h2>
          <span class="text-[10px] uppercase tracking-wider text-caution border border-caution/30 bg-caution/[0.06] px-2 py-0.5 rounded">
            Demo — synthetic data
          </span>
        </div>
        <div v-if="loading" class="h-72 rounded-lg bg-white/5 animate-pulse" />
        <div v-else ref="mapEl" class="h-72 rounded-lg overflow-hidden border border-white/5" />
        <!-- Legend -->
        <div class="flex flex-wrap gap-3 mt-3">
          <span v-for="(color, cls) in {
            'oil_slick':     '#ef4444',
            'look_alike':    '#fbbf24',
            'marine_debris': '#f97316',
            'clean_water':   '#22c55e',
          }" :key="cls" class="flex items-center gap-1.5 text-[10px] text-ink-muted">
            <span class="w-2 h-2 rounded-full" :style="{ background: color }" />
            {{ cls.replace(/_/g, ' ') }}
          </span>
        </div>
      </Card>

      <!-- Input → Model → Output -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">Input → Model → Output</h2>
        <div class="grid grid-cols-3 gap-3 text-xs">
          <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3">
            <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mb-1">Input</p>
            <p class="text-ink-primary font-medium">Sentinel-1 SAR (C-band)</p>
            <p class="text-ink-muted mt-1">C-band radar · 10m resolution · 12-day revisit</p>
          </div>
          <div class="rounded-lg border border-accent/20 bg-accent/[0.04] p-3">
            <p class="text-[10px] uppercase tracking-wider text-accent/60 mb-1">Model</p>
            <p class="text-ink-primary font-medium">UNet-ResNet50</p>
            <p class="text-ink-muted mt-1">NKSID + SCS-GEO · 2,400 SAR scenes</p>
            <p class="text-ink-muted/50 mt-1">89.4% F1 · 4-class segmentation</p>
          </div>
          <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3">
            <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mb-1">Output</p>
            <p class="text-ink-primary font-medium">Spill polygon + class</p>
            <p class="text-ink-muted mt-1">Area km², centroid lat/lon, bounding polygon GeoJSON</p>
          </div>
        </div>
      </Card>

      <!-- Interactive controls -->
      <InferenceControls
        v-if="!loading"
        :results="results"
        model-slug="oil-spill"
        input-label="Sentinel-1 SAR (C-band)"
        @filtered="filteredResults = $event"
      />

      <!-- Confidence chart (filtered) -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">Detection Class Confidence</h2>
        <p v-if="loading" class="text-ink-muted text-sm py-8 text-center">Loading…</p>
        <ConfidenceChart v-else :results="filteredResults" />
      </Card>

      <!-- Inference log (filtered) -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">Inference Log</h2>
        <p v-if="loading" class="text-ink-muted text-sm py-4 text-center">Loading…</p>
        <InferenceLogTable v-else :results="filteredResults" />
      </Card>

      <!-- SQL playground -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">SQL Explorer</h2>
        <p class="text-xs text-ink-muted mb-3">
          Query the raw detection data — filter by class, area, confidence, or location.
        </p>
        <SqlPlayground model-slug="oil-spill" :examples="OIL_EXAMPLES" />
      </Card>

      <!-- Reproducible query panel -->
      <Card padded>
        <SqlInterpretationPanel
          :query="inferenceRpcSql"
          :params="['oil-spill', 50]"
          source="model_inference_results()"
          caption="Returns last 50 inference events for this model. Polygon GeoJSON is stored in metadata.polygon_geojson."
        />
      </Card>

    </div>
  </div>
</template>
