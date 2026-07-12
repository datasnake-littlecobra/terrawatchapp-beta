<script setup lang="ts">
// TerraWatch — Phase 10.0: Oil Spill / Pollution Detection model page.
//
// MapLibre GL map centred on the Gulf of Mexico showing:
//   - GeoJSON polygon fill layer for spill extents (from metadata.polygon_geojson)
//   - Point markers for individual detection rows (lat/lon from inference log)
// Plus ConfidenceChart and InferenceLogTable below.

import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import AIModelTabStrip from './components/AIModelTabStrip.vue'
import ConfidenceChart from './components/ConfidenceChart.vue'
import InferenceLogTable from './components/InferenceLogTable.vue'
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

const results  = ref<InferenceResult[]>([])
const loading  = ref(true)
const errorMsg = ref<string | null>(null)

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
    center:    [-91.0, 27.0],
    zoom:      5.5,
    maxZoom:   14,
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
          'oil_slick', '#ef4444',
          'marine_debris', '#f97316',
          'look_alike', '#fbbf24',
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
          'oil_slick', '#ef4444',
          'marine_debris', '#f97316',
          'look_alike', '#fbbf24',
          '#94a3b8',
        ],
        'line-width': 1.5,
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
        'circle-opacity':       0.85,
        'circle-stroke-width':  1,
        'circle-stroke-color':  'rgba(0,0,0,0.4)',
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
            <div class="popup-title">${String(p.cls).replace(/_/g, ' ')}</div>
            <div class="popup-body">
              Confidence: <strong>${(Number(p.conf) * 100).toFixed(1)}%</strong><br>
              ${p.area_km2 ? `Area: <strong>${Number(p.area_km2).toFixed(2)} km²</strong><br>` : ''}
              ${p.satellite ? `Satellite: ${p.satellite}<br>` : ''}
              Source: ${p.source}
            </div>
           </div>`,
        )
        .addTo(m)
    })
    m.on('mouseenter', 'spill-circles', () => { m.getCanvas().style.cursor = 'pointer' })
    m.on('mouseleave', 'spill-circles', () => { m.getCanvas().style.cursor = '' })
  })
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
      </header>

      <!-- Model metadata row -->
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

      <!-- Map -->
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
            'oil_slick': '#ef4444',
            'look_alike': '#fbbf24',
            'marine_debris': '#f97316',
            'clean_water': '#22c55e',
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
            <p class="text-ink-primary font-medium">Sentinel-1 SAR</p>
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

      <!-- Confidence chart -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">Detection Class Confidence (latest 50)</h2>
        <ConfidenceChart :results="results" />
      </Card>

      <!-- Inference log -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">Inference Log</h2>
        <InferenceLogTable :results="results" />
      </Card>

      <!-- SQL panel -->
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
