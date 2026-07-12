<script setup lang="ts">
// TerraWatch — Phase 9.18.2: Weather Intelligence Map tab.
//
// Three composited layers on a MapLibre GL map:
//   1. FEMA NFHL flood zones — WMS raster tile overlay (free, no key).
//   2. NASA FIRMS VIIRS fire detections — GeoJSON circle layer from
//      Supabase cache (ingest-firms, hourly cron).
//   3. NOAA NWS sensor markers — DOM markers from Phase 9.18.1 sensors.
//
// This is the first view in the app to use MapLibre addSource/addLayer
// (all prior maps use custom DOM markers only).

import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import WeatherIntelligenceTabStrip from './components/WeatherIntelligenceTabStrip.vue'
import WIMetricInfoPanel from './components/WIMetricInfoPanel.vue'
import SqlInterpretationPanel from './components/SqlInterpretationPanel.vue'
import { useMeta } from '@/composables/useMeta'
import { fetchFirmsDetections, fetchNoaaNwsSensors, type FirmsDetection, type NoaaNwsSensor } from '@/services/weatherIntelligence'

useMeta(() => ({
  title:       'Map — Weather Intelligence',
  description: 'Live multi-layer risk map: FEMA NFHL flood zones, NASA FIRMS active fire detections, and NOAA NWS weather stations.',
}))

const mapEl    = ref<HTMLDivElement | null>(null)
const map      = shallowRef<maplibregl.Map | null>(null)
const markers  = shallowRef<maplibregl.Marker[]>([])

const showFloodZones = ref(true)
const showFires      = ref(true)
const showSensors    = ref(true)

const firmsDetections = ref<FirmsDetection[]>([])
const noaaSensors     = ref<NoaaNwsSensor[]>([])
const firmsLoading    = ref(true)
const firmsEmpty      = ref(false)

// -----------------------------------------------------------------------
// SQL panels
// -----------------------------------------------------------------------
const firmsSql = `select id, lat, lon, frp, confidence, satellite, acq_datetime
from public.firms_active_fires
where acq_datetime >= now() - ($1 || ' days')::interval
order by frp desc nulls last
limit 2000;`

const nfhlWmsSql = `-- FEMA NFHL flood zones — WMS raster tile service
-- No SQL query: data comes from FEMA's public ArcGIS tile endpoint.
-- URL pattern:
--   https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/
--     MapServer/tile/{z}/{y}/{x}
-- Zone codes: AE = 1% annual flood (100-yr)
--             VE = coastal 1% + wave action
--             AH = shallow ponding
--             AO = shallow sheet flow
--             X  = 0.2% annual flood (500-yr) or minimal hazard
-- Data source: FEMA DFIRM panels, updated on map revision (LOMR).`

// -----------------------------------------------------------------------
// Confidence → circle color
// -----------------------------------------------------------------------
function firmsColor(confidence: FirmsDetection['confidence']): string {
  if (confidence === 'high')    return '#ef4444'  // red-500
  if (confidence === 'nominal') return '#f97316'  // orange-500
  return '#fbbf24'                                 // amber-400 (low)
}

// -----------------------------------------------------------------------
// Map initialization
// -----------------------------------------------------------------------
function buildFiresGeoJson(detections: FirmsDetection[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: detections.map((d) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
      properties: {
        id:          d.id,
        frp:         d.frp ?? 0,
        confidence:  d.confidence ?? 'low',
        satellite:   d.satellite ?? '',
        acq_time:    d.acqDatetime.toISOString(),
      },
    })),
  }
}

function removeMarkers() {
  for (const m of markers.value) m.remove()
  markers.value = []
}

function renderSensorMarkers(m: maplibregl.Map, sensors: NoaaNwsSensor[]) {
  removeMarkers()
  const newMarkers: maplibregl.Marker[] = []
  for (const s of sensors) {
    if (s.lat == null || s.lon == null) continue
    const el = document.createElement('div')
    el.className = 'noaa-marker'
    el.title = `${s.name} (${s.stationId})`

    const popup = new maplibregl.Popup({ offset: 10, closeButton: false })
      .setHTML(
        `<div class="map-popup">
          <div class="popup-title">${s.stationId}</div>
          <div class="popup-body">${s.city ?? ''}, ${s.state ?? ''}</div>
         </div>`,
      )

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([s.lon, s.lat])
      .setPopup(popup)
      .addTo(m)
    newMarkers.push(marker)
  }
  markers.value = newMarkers
}

function initLayers(m: maplibregl.Map) {
  // Layer 1: FEMA NFHL WMS raster tiles
  m.addSource('nfhl', {
    type: 'raster',
    tiles: [
      'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/tile/{z}/{y}/{x}',
    ],
    tileSize: 256,
    attribution: '<a href="https://msc.fema.gov" target="_blank">FEMA NFHL</a>',
  })
  m.addLayer({
    id:     'nfhl-layer',
    type:   'raster',
    source: 'nfhl',
    paint:  { 'raster-opacity': 0.55 },
  })

  // Layer 2: NASA FIRMS fire detections (GeoJSON circle layer)
  m.addSource('firms', {
    type: 'geojson',
    data: buildFiresGeoJson(firmsDetections.value),
  })
  m.addLayer({
    id:     'firms-circles',
    type:   'circle',
    source: 'firms',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['get', 'frp'],
        0, 4,
        50, 8,
        200, 16,
      ],
      'circle-color': [
        'match', ['get', 'confidence'],
        'high',    '#ef4444',
        'nominal', '#f97316',
        '#fbbf24',
      ],
      'circle-opacity': 0.82,
      'circle-stroke-width': 1,
      'circle-stroke-color': 'rgba(0,0,0,0.3)',
    },
  })

  // Fire popup on click
  m.on('click', 'firms-circles', (e) => {
    const feat = e.features?.[0]
    if (!feat) return
    const props = feat.properties as { frp: number; confidence: string; satellite: string; acq_time: string }
    const acq = new Date(props.acq_time).toUTCString()
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(
        `<div class="map-popup">
          <div class="popup-title">Active Fire Detection</div>
          <div class="popup-body">
            FRP: <strong>${props.frp.toFixed(1)} MW</strong><br>
            Confidence: <strong>${props.confidence}</strong><br>
            Satellite: ${props.satellite}<br>
            Acquired: ${acq}
          </div>
         </div>`,
      )
      .addTo(m)
  })
  m.on('mouseenter', 'firms-circles', () => { m.getCanvas().style.cursor = 'pointer' })
  m.on('mouseleave', 'firms-circles', () => { m.getCanvas().style.cursor = '' })

  // Layer 3: NOAA sensor DOM markers
  renderSensorMarkers(m, noaaSensors.value)
}

// Toggle visibility helpers — called reactively via the chip buttons.
function setFloodZoneVisibility(visible: boolean) {
  const m = map.value
  if (!m || !m.getLayer('nfhl-layer')) return
  m.setLayoutProperty('nfhl-layer', 'visibility', visible ? 'visible' : 'none')
}

function setFiresVisibility(visible: boolean) {
  const m = map.value
  if (!m || !m.getLayer('firms-circles')) return
  m.setLayoutProperty('firms-circles', 'visibility', visible ? 'visible' : 'none')
}

function setSensorsVisibility(visible: boolean) {
  for (const mk of markers.value) {
    const el = mk.getElement()
    el.style.display = visible ? '' : 'none'
  }
}

function toggleFloodZones() {
  showFloodZones.value = !showFloodZones.value
  setFloodZoneVisibility(showFloodZones.value)
}
function toggleFires() {
  showFires.value = !showFires.value
  setFiresVisibility(showFires.value)
}
function toggleSensors() {
  showSensors.value = !showSensors.value
  setSensorsVisibility(showSensors.value)
}

onMounted(async () => {
  // Load data before map init so GeoJSON source is populated on first render.
  const [detections, sensors] = await Promise.all([
    fetchFirmsDetections(3),
    fetchNoaaNwsSensors(),
  ])
  firmsDetections.value = detections
  noaaSensors.value     = sensors
  firmsLoading.value    = false
  firmsEmpty.value      = detections.length === 0

  if (!mapEl.value) return

  const m = new maplibregl.Map({
    container: mapEl.value,
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        },
      },
      layers: [{
        id: 'osm',
        type: 'raster',
        source: 'osm',
        paint: {
          'raster-saturation': -0.5,
          'raster-brightness-min': 0.08,
          'raster-brightness-max': 0.6,
        },
      }],
    },
    center: [-80.3, 25.8],
    zoom: 6,
  })

  m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

  m.on('load', () => {
    initLayers(m)
    map.value = m
  })
})

onBeforeUnmount(() => {
  removeMarkers()
  map.value?.remove()
})
</script>

<template>
  <div class="min-h-screen bg-surface-0 text-ink-primary">
    <WeatherIntelligenceTabStrip />

    <div class="max-w-6xl mx-auto px-4 py-8 space-y-8">

      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold">Risk Map</h1>
        <p class="mt-1 text-ink-muted text-sm">
          FEMA NFHL flood zones · NASA FIRMS active fire detections · NOAA NWS weather stations
        </p>
      </div>

      <!-- Layer toggles -->
      <div class="flex flex-wrap gap-2">
        <button
          class="layer-chip"
          :class="showFloodZones ? 'chip-active chip-blue' : 'chip-inactive'"
          @click="toggleFloodZones"
        >
          <span class="chip-swatch bg-blue-400/60"></span>
          Flood Zones
        </button>
        <button
          class="layer-chip"
          :class="showFires ? 'chip-active chip-red' : 'chip-inactive'"
          @click="toggleFires"
        >
          <span class="chip-swatch bg-red-500/80"></span>
          Fire Detections
          <span v-if="!firmsLoading && firmsEmpty" class="ml-1 text-xs text-ink-muted">(awaiting data)</span>
          <span v-else-if="!firmsLoading" class="ml-1 text-xs text-ink-muted">{{ firmsDetections.length }}</span>
        </button>
        <button
          class="layer-chip"
          :class="showSensors ? 'chip-active chip-cyan' : 'chip-inactive'"
          @click="toggleSensors"
        >
          <span class="chip-swatch bg-cyan-400/80"></span>
          NOAA Stations
          <span class="ml-1 text-xs text-ink-muted">{{ noaaSensors.length }}</span>
        </button>
      </div>

      <!-- Map container -->
      <div class="rounded-xl overflow-hidden border border-white/8 relative" style="height: 520px;">
        <div ref="mapEl" class="w-full h-full"></div>

        <!-- Legend overlay -->
        <div class="map-legend">
          <div v-if="showFloodZones" class="legend-group">
            <div class="legend-title">Flood Zones</div>
            <div class="legend-row"><span class="legend-swatch" style="background:#4477aa"></span>AE — 100-yr</div>
            <div class="legend-row"><span class="legend-swatch" style="background:#44aaaa"></span>VE — Coastal</div>
            <div class="legend-row"><span class="legend-swatch" style="background:#aa66aa"></span>AH/AO — Shallow</div>
            <div class="legend-row"><span class="legend-swatch" style="background:#888"></span>X — Minimal</div>
          </div>
          <div v-if="showFires" class="legend-group">
            <div class="legend-title">Fire Detections</div>
            <div class="legend-row"><span class="legend-swatch" style="background:#ef4444"></span>High confidence</div>
            <div class="legend-row"><span class="legend-swatch" style="background:#f97316"></span>Nominal</div>
            <div class="legend-row text-xs text-ink-muted">Circle size = FRP (MW)</div>
          </div>
        </div>

        <!-- FIRMS empty state banner -->
        <div
          v-if="!firmsLoading && firmsEmpty && showFires"
          class="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-surface-1/95 border border-amber-400/30 rounded-lg px-4 py-2 text-sm text-amber-300 shadow-lg"
        >
          Fire detection layer inactive — FIRMS_MAP_KEY not yet configured.
          <a href="https://earthdata.nasa.gov/" target="_blank" rel="noopener" class="underline ml-1">Get free key</a>
        </div>
      </div>

      <!-- Explainer panels -->
      <WIMetricInfoPanel id="map.flood-zones" />
      <WIMetricInfoPanel id="map.firms-fires" />

      <!-- SQL panels -->
      <SqlInterpretationPanel
        :query="firmsSql"
        :params="[3]"
        source="public.firms_active_fires"
        caption="Fetches fire detections from the last 3 days, ordered by fire radiative power (FRP). Used to populate the red/orange circles on the map."
      />

      <SqlInterpretationPanel
        :query="nfhlWmsSql"
        :params="[]"
        source="FEMA NFHL WMS"
        caption="The flood zone raster tiles come directly from FEMA's public ArcGIS tile server — no SQL query runs in Supabase for this layer."
      />

    </div>
  </div>
</template>

<style scoped>
/* Layer toggle chips */
.layer-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 500;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.chip-active   { color: #fff; }
.chip-blue     { background: rgba(59,130,246,0.18); border-color: rgba(59,130,246,0.45); }
.chip-red      { background: rgba(239,68,68,0.18);  border-color: rgba(239,68,68,0.45); }
.chip-cyan     { background: rgba(34,211,238,0.14); border-color: rgba(34,211,238,0.4); }
.chip-inactive { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); color: rgba(255,255,255,0.45); }
.chip-swatch   { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }

/* Map legend overlay */
.map-legend {
  position: absolute;
  bottom: 28px;
  left: 10px;
  z-index: 5;
  background: rgba(7, 21, 37, 0.92);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.75);
  pointer-events: none;
}
.legend-group { display: flex; flex-direction: column; gap: 4px; }
.legend-title { font-weight: 600; color: rgba(255,255,255,0.5); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
.legend-row   { display: flex; align-items: center; gap: 6px; }
.legend-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; opacity: 0.85; }

/* NOAA sensor DOM markers */
:deep(.noaa-marker) {
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  background: #22d3ee;
  border: 2px solid rgba(255,255,255,0.7);
  cursor: pointer;
  box-shadow: 0 0 6px rgba(34,211,238,0.5);
}

/* MapLibre popup theme */
:deep(.maplibregl-popup-content) {
  background: rgba(7, 21, 37, 0.96);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 0;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
}
:deep(.maplibregl-popup-tip) {
  border-top-color: rgba(7, 21, 37, 0.96);
}
:deep(.map-popup) {
  padding: 10px 12px;
  min-width: 160px;
}
:deep(.popup-title) {
  font-weight: 600;
  font-size: 0.8rem;
  color: #fff;
  margin-bottom: 4px;
}
:deep(.popup-body) {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.65);
  line-height: 1.5;
}
</style>
