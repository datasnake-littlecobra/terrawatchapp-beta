<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useLocationStore } from '@/stores/location'
import { getBboxQuakes, type Quake } from '@/services/usgs'

const mapEl = ref<HTMLDivElement | null>(null)
const location = useLocationStore()
const { coords } = storeToRefs(location)
const map = shallowRef<maplibregl.Map | null>(null)
const quakes = ref<Quake[]>([])

onMounted(() => {
  if (!mapEl.value) return
  const center: [number, number] = coords.value
    ? [coords.value.lon, coords.value.lat]
    : [0, 20]
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
    center,
    zoom: coords.value ? 5 : 2,
  })
  map.value.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
})

watch(
  coords,
  async (loc) => {
    if (!loc) return
    try {
      quakes.value = await getBboxQuakes(loc, 800, 2.5)
      for (const q of quakes.value) {
        const el = document.createElement('div')
        const size = Math.max(8, Math.min(30, q.magnitude * 5))
        el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;background:rgba(180,107,255,0.45);border:1px solid #B46BFF;cursor:pointer`
        new maplibregl.Marker({ element: el })
          .setLngLat([q.lon, q.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 10 }).setHTML(
              `<div style="font-family:Inter"><strong>M${q.magnitude.toFixed(1)}</strong> · ${q.place}</div>`,
            ),
          )
          .addTo(map.value!)
      }
    } catch {
      // handled by caller in production; fine to swallow here
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  map.value?.remove()
  map.value = null
})
</script>

<template>
  <div class="fixed inset-0 pb-24">
    <div ref="mapEl" class="w-full h-full" />
  </div>
</template>
