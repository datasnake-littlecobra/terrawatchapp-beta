<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useLocationStore } from '@/stores/location'
import { getRecentQuakes, type Quake } from '@/services/usgs'
import Card from '@/ui/Card.vue'
import { RouterLink } from 'vue-router'
import { en } from '@/i18n/en'

const mapEl = ref<HTMLDivElement | null>(null)
const location = useLocationStore()
const { coords } = storeToRefs(location)
const map = shallowRef<maplibregl.Map | null>(null)
const quakes = ref<Quake[]>([])

function ensureMap() {
  if (map.value || !mapEl.value || !coords.value) return
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
    center: [coords.value.lon, coords.value.lat],
    zoom: 5,
    attributionControl: false,
    interactive: false,
  })
  new maplibregl.Marker({ color: '#10B981' })
    .setLngLat([coords.value.lon, coords.value.lat])
    .addTo(map.value)
}

function renderQuakes() {
  if (!map.value) return
  for (const q of quakes.value.slice(0, 40)) {
    const el = document.createElement('div')
    const size = Math.max(8, Math.min(22, q.magnitude * 4))
    el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;background:rgba(180,107,255,0.45);border:1px solid #B46BFF`
    new maplibregl.Marker({ element: el }).setLngLat([q.lon, q.lat]).addTo(map.value)
  }
}

watch(
  coords,
  async (loc) => {
    if (!loc) return
    ensureMap()
    try {
      quakes.value = await getRecentQuakes(loc, 400, 96, 2.5)
      renderQuakes()
    } catch {
      // silently fail — preview is not critical
    }
  },
  { immediate: true },
)

onMounted(() => ensureMap())
onBeforeUnmount(() => {
  map.value?.remove()
  map.value = null
})
</script>

<template>
  <RouterLink to="/explore" class="block">
    <Card :padded="false" elevated>
      <div class="relative">
        <div ref="mapEl" class="h-56 w-full rounded-xl2 overflow-hidden" aria-hidden="true" />
        <div
          class="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between
                 bg-gradient-to-t from-surface-2/90 to-transparent rounded-b-xl2"
        >
          <div>
            <p class="text-sm text-ink-primary">{{ en.explore.title }}</p>
            <p class="num text-xs text-ink-muted mt-0.5">
              {{ quakes.length }} recent quakes in range
            </p>
          </div>
          <span class="text-accent text-sm">{{ en.explore.openFull }} →</span>
        </div>
      </div>
    </Card>
  </RouterLink>
</template>
