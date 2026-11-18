<script setup lang="ts">
// TerraWatch — Phase 11: Location Risk map. Point markers only (no
// clustering/vector layers needed for a bounded ≤300-row result set),
// modeled on the marker pattern in features/events/EventsMapView.vue but
// centered/zoomed on the searched place rather than the viewer's location.
import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeedEvent } from '@/types/dataSource'
import type { LatLon } from '@/lib/geo'

const props = defineProps<{
  events: FeedEvent[]
  center: LatLon
}>()

const emit = defineEmits<{ select: [event: FeedEvent] }>()

const mapEl    = shallowRef<HTMLDivElement | null>(null)
const map      = shallowRef<maplibregl.Map | null>(null)
const markers  = shallowRef<maplibregl.Marker[]>([])

const severityColor: Record<string, string> = {
  danger:  '#FF6B6B',
  caution: '#F5B74A',
  safe:    '#3DDC97',
}

function clearMarkers() {
  markers.value.forEach((m) => m.remove())
  markers.value = []
}

function drawMarkers() {
  if (!map.value) return
  clearMarkers()
  for (const ev of props.events) {
    if (!ev.location) continue
    const el = document.createElement('div')
    el.style.cssText = [
      'width:12px;height:12px;border-radius:9999px;cursor:pointer;',
      `background:${severityColor[ev.severity]};`,
      'border:2px solid rgba(0,0,0,0.4);',
      `box-shadow:0 0 0 2px ${severityColor[ev.severity]}40;`,
    ].join('')
    const m = new maplibregl.Marker({ element: el })
      .setLngLat([ev.location.lon, ev.location.lat])
      .addTo(map.value)
    el.addEventListener('click', () => emit('select', ev))
    markers.value = [...markers.value, m]
  }
}

function initMap() {
  if (!mapEl.value || map.value) return
  map.value = new maplibregl.Map({
    container: mapEl.value,
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    center: [props.center.lon, props.center.lat],
    zoom: 7,
  })
  map.value.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

  const centerEl = document.createElement('div')
  centerEl.style.cssText =
    'width:14px;height:14px;border-radius:9999px;background:#7DD3FC;border:2px solid #0B1220;'
  new maplibregl.Marker({ element: centerEl })
    .setLngLat([props.center.lon, props.center.lat])
    .addTo(map.value)

  map.value.on('load', drawMarkers)
}

watch(() => props.events, drawMarkers)
watch(
  () => props.center,
  (c) => {
    map.value?.flyTo({ center: [c.lon, c.lat], zoom: 7 })
  },
)

onMounted(initMap)
onBeforeUnmount(() => {
  clearMarkers()
  map.value?.remove()
  map.value = null
})
</script>

<template>
  <div ref="mapEl" class="h-[380px] rounded-2xl overflow-hidden border border-white/10" />
</template>
