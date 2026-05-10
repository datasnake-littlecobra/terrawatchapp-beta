<script setup lang="ts">
// TerraWatch / DataSnake — Module 2: Command Center Map.
//
// Live map showing geographic risk distribution across an insured
// portfolio. Each point is a city-cluster aggregate (in production
// this would be H3 hex cells from a PostGIS polyfill — same data shape).

import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useRouter } from 'vue-router'
import Card from '@/ui/Card.vue'
import InsuranceTabStrip from './components/InsuranceTabStrip.vue'
import DemoBadge from './components/DemoBadge.vue'
import { useMeta } from '@/composables/useMeta'
import {
  RISK_CELLS,
  riskColor,
  fmtUsd,
  type Peril,
  type RiskCell,
} from '@/data/insurance-mock'

useMeta(() => ({
  title:       'Command Center — Insurance Intelligence',
  description: 'Live geographic risk distribution across an insurance portfolio. Color-coded cells by composite risk; layer-toggle by peril.',
}))

const router = useRouter()
const mapEl = ref<HTMLDivElement | null>(null)
const map = shallowRef<maplibregl.Map | null>(null)
const markers = shallowRef<maplibregl.Marker[]>([])

type Layer = 'all' | Peril
const layer = ref<Layer>('all')

const LAYERS: Array<{ key: Layer; label: string }> = [
  { key: 'all',      label: 'All perils' },
  { key: 'flood',    label: 'Flood' },
  { key: 'seismic',  label: 'Seismic' },
  { key: 'wind',     label: 'Wind' },
  { key: 'wildfire', label: 'Wildfire' },
  { key: 'surge',    label: 'Storm Surge' },
]

const visibleCells = computed<RiskCell[]>(() =>
  layer.value === 'all'
    ? RISK_CELLS
    : RISK_CELLS.filter((c) => c.dominant_peril === layer.value),
)

const totals = computed(() => {
  const all = RISK_CELLS
  return {
    exposure:  all.reduce((s, c) => s + c.exposure_usd * 1e9, 0),
    high:      all.filter((c) => c.risk_score >= 70).length,
    rising:    all.filter((c) => c.trend === 'rising').length,
    sensors:   all.length * 47,                  // pretend each cell has ~47 sensors active
  }
})

const risingFeed = computed(() =>
  [...RISK_CELLS]
    .filter((c) => c.trend === 'rising')
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 8),
)

function trendArrow(c: RiskCell): string {
  if (c.trend === 'rising')  return '↑'
  if (c.trend === 'falling') return '↓'
  return '→'
}
function trendClass(c: RiskCell): string {
  if (c.trend === 'rising')  return 'text-danger'
  if (c.trend === 'falling') return 'text-safe'
  return 'text-ink-muted'
}

function buildPopup(c: RiskCell): maplibregl.Popup {
  const color = riskColor(c.risk_score)
  return new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(`
    <div style="font-family: inherit; min-width: 180px;">
      <p style="font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.6); margin: 0 0 2px;">${c.cell_id.slice(0, 9)}…</p>
      <p style="font-size: 14px; font-weight: 600; color: #E6EDF7; margin: 0 0 6px;">${c.city}</p>
      <p style="font-size: 12px; color: #8A97B1; margin: 0 0 8px;">
        Risk score
        <span style="color: ${color}; font-weight: 600; margin-left: 6px;">${c.risk_score}/100</span>
      </p>
      <p style="font-size: 11px; color: #8A97B1; margin: 0;">Dominant: ${c.dominant_peril}</p>
      <p style="font-size: 11px; color: #8A97B1; margin: 0;">Exposure: $${c.exposure_usd.toFixed(1)}B</p>
      <p style="font-size: 11px; color: #8A97B1; margin: 4px 0 0;">Trend: ${c.trend}</p>
    </div>
  `)
}

function renderMarkers() {
  const m = map.value
  if (!m) return
  for (const mk of markers.value) mk.remove()
  const next: maplibregl.Marker[] = []
  for (const c of visibleCells.value) {
    const el = document.createElement('div')
    el.className = 'risk-cell-marker'
    const color = riskColor(c.risk_score)
    const size = 16 + Math.min(28, c.exposure_usd / 4)
    el.style.cssText = `
      width: ${size}px; height: ${size}px;
      border-radius: 9999px;
      background: ${color}33;
      border: 2px solid ${color};
      box-shadow: 0 0 0 4px ${color}1a;
      cursor: pointer;
      transition: transform 200ms ease;
    `
    el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.2)' })
    el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })
    el.addEventListener('click', () => {
      router.push({ path: '/insurance/verdict', query: { q: c.city } })
    })
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([c.lon, c.lat])
      .setPopup(buildPopup(c))
      .addTo(m)
    next.push(marker)
  }
  markers.value = next
}

onMounted(() => {
  if (!mapEl.value) return
  const m = new maplibregl.Map({
    container: mapEl.value,
    style: {
      version: 8,
      sources: {
        'osm': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.6, 'raster-brightness-min': 0.1, 'raster-brightness-max': 0.55 } }],
    },
    center: [-95, 38],
    zoom: 3.4,
    attributionControl: { compact: true },
  })
  map.value = m
  m.on('load', () => renderMarkers())
})

onBeforeUnmount(() => {
  for (const mk of markers.value) mk.remove()
  if (map.value) map.value.remove()
})

watch(layer, () => renderMarkers())
</script>

<template>
  <div>
    <InsuranceTabStrip />

    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header class="flex items-start justify-between gap-3 mb-5">
        <div>
          <p class="text-ink-muted text-xs tracking-widest uppercase">Module · Command Center</p>
          <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
            Portfolio risk distribution
          </h1>
          <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-2xl">
            Cells colored by composite risk score. Size scales with
            modeled exposure ($). Click any cell to drop into the
            address-level Risk Verdict for that market.
          </p>
        </div>
        <DemoBadge class="hidden sm:inline-flex" />
      </header>

      <!-- KPI strip -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
        <div class="rounded-2xl border border-white/5 bg-surface-1 p-3 sm:p-4">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Total exposure monitored</p>
          <p class="num text-2xl font-semibold text-ink-primary mt-1">{{ fmtUsd(totals.exposure) }}</p>
        </div>
        <div class="rounded-2xl border border-danger/30 bg-danger/[0.05] p-3 sm:p-4">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">High-risk zones</p>
          <p class="num text-2xl font-semibold text-danger mt-1">{{ totals.high }}</p>
        </div>
        <div class="rounded-2xl border border-caution/30 bg-caution/[0.05] p-3 sm:p-4">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Rising-risk alerts</p>
          <p class="num text-2xl font-semibold text-caution mt-1">{{ totals.rising }}</p>
        </div>
        <div class="rounded-2xl border border-accent/30 bg-accent/[0.05] p-3 sm:p-4">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">Sensors active</p>
          <p class="num text-2xl font-semibold text-accent mt-1">{{ totals.sensors.toLocaleString() }}</p>
        </div>
      </div>

      <!-- Layer toggles -->
      <div class="flex flex-wrap items-center gap-1.5 mb-3">
        <span class="text-[10px] uppercase tracking-widest text-ink-muted/60 mr-1">Layer:</span>
        <button
          v-for="l in LAYERS"
          :key="l.key"
          class="text-xs px-3 py-1.5 rounded-full border transition-colors"
          :class="layer === l.key
            ? 'border-accent bg-accent/15 text-accent'
            : 'border-white/10 text-ink-muted hover:text-ink-primary hover:border-white/20'"
          @click="layer = l.key"
        >{{ l.label }}</button>
      </div>

      <!-- Map + sidebar -->
      <div class="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">
        <div class="rounded-2xl border border-white/5 overflow-hidden bg-surface-1 relative">
          <div ref="mapEl" class="w-full h-[480px]"></div>
          <!-- Color legend -->
          <div class="absolute bottom-3 left-3 rounded-lg bg-surface-0/90 backdrop-blur border border-white/10 px-3 py-2 text-[10px] uppercase tracking-widest text-ink-muted">
            <p class="mb-1.5">Risk score</p>
            <div class="flex items-center gap-2">
              <span class="inline-block w-2.5 h-2.5 rounded-full" style="background:#3DDC97"></span>
              <span>&lt;40 low</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="inline-block w-2.5 h-2.5 rounded-full" style="background:#F5B74A"></span>
              <span>40-70 med</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="inline-block w-2.5 h-2.5 rounded-full" style="background:#FF6B6B"></span>
              <span>&gt;70 high</span>
            </div>
          </div>
        </div>

        <Card padded>
          <h3 class="text-sm font-semibold text-ink-primary mb-3">Rising-risk markets</h3>
          <p v-if="!risingFeed.length" class="text-ink-muted text-sm">No markets trending up.</p>
          <ul v-else class="text-sm space-y-2">
            <li
              v-for="c in risingFeed"
              :key="c.cell_id"
              class="flex items-baseline justify-between gap-2"
            >
              <button
                class="text-left flex-1 truncate hover:text-accent transition-colors"
                @click="router.push({ path: '/insurance/verdict', query: { q: c.city } })"
              >
                <span class="text-ink-primary">{{ c.city }}</span>
                <span class="text-ink-muted/60 text-[10px] ml-1">{{ c.dominant_peril }}</span>
              </button>
              <span class="num text-xs tabular-nums" :class="trendClass(c)">
                {{ c.risk_score }} {{ trendArrow(c) }}
              </span>
            </li>
          </ul>
        </Card>
      </div>

      <p class="text-ink-muted/60 text-xs mt-5 max-w-3xl">
        <strong class="text-ink-muted">How to read this:</strong>
        Marker size reflects modeled $ exposure; color reflects
        composite risk score. Trend arrows in the sidebar are computed
        as a 30-day delta vs the prior 30 days. Production deployment
        would replace the city-level aggregates with PostGIS H3 cells
        at zoom-dependent resolution (cell H3-9 at country zoom, H3-12
        at parcel zoom).
      </p>
    </div>
  </div>
</template>

<style>
.risk-cell-marker { cursor: pointer; }
.maplibregl-popup-content {
  background: rgba(7, 21, 37, 0.96) !important;
  color: #E6EDF7 !important;
  border: 1px solid rgba(255,255,255,0.1) !important;
  border-radius: 8px !important;
  padding: 10px 12px !important;
}
.maplibregl-popup-tip {
  border-top-color: rgba(7, 21, 37, 0.96) !important;
  border-bottom-color: rgba(7, 21, 37, 0.96) !important;
}
.maplibregl-ctrl-attrib {
  background: rgba(7, 21, 37, 0.7) !important;
  color: rgba(230, 237, 247, 0.6) !important;
}
.maplibregl-ctrl-attrib a { color: rgba(63, 169, 245, 0.7) !important; }
</style>
