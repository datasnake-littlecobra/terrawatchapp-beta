<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useLocationStore } from '@/stores/location'
import { getBboxQuakes, type Quake } from '@/services/usgs'
import EventsList from '@/features/events/EventsList.vue'
import { en } from '@/i18n/en'

type View = 'map' | 'list'

const route = useRoute()
const router = useRouter()
const location = useLocationStore()
const { coords } = storeToRefs(location)

const view = computed<View>(() => (route.query.view === 'list' ? 'list' : 'map'))

function setView(next: View) {
  if (next === view.value) return
  const query = { ...route.query, view: next }
  void router.replace({ query })
}

const mapEl = ref<HTMLDivElement | null>(null)
const map = shallowRef<maplibregl.Map | null>(null)
const markers = shallowRef<maplibregl.Marker[]>([])
const quakes = ref<Quake[]>([])

function clearMarkers() {
  for (const m of markers.value) m.remove()
  markers.value = []
}

async function initMap() {
  if (!mapEl.value || map.value) return
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
}

async function loadQuakes(loc: { lat: number; lon: number }) {
  try {
    quakes.value = await getBboxQuakes(loc, 800, 2.5)
    if (!map.value) return
    clearMarkers()
    for (const q of quakes.value) {
      const el = document.createElement('div')
      const size = Math.max(8, Math.min(30, q.magnitude * 5))
      el.style.cssText =
        `width:${size}px;height:${size}px;border-radius:9999px;` +
        `background:rgba(180,107,255,0.45);border:1px solid #B46BFF;cursor:pointer`
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([q.lon, q.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 10 }).setHTML(
            `<div style="font-family:Inter"><strong>M${q.magnitude.toFixed(1)}</strong> · ${q.place}</div>`,
          ),
        )
        .addTo(map.value)
      markers.value = [...markers.value, marker]
    }
  } catch {
    // non-fatal
  }
}

onMounted(() => {
  if (view.value === 'map') void initMap()
})

watch(view, async (v) => {
  if (v === 'map') {
    await initMap()
    if (coords.value) void loadQuakes(coords.value)
  }
})

watch(
  coords,
  (loc) => {
    if (!loc) return
    if (view.value === 'map') void loadQuakes(loc)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  clearMarkers()
  map.value?.remove()
  map.value = null
})
</script>

<template>
  <div class="w-full h-[calc(100dvh-5.5rem)] flex flex-col">
    <header
      class="shrink-0 px-5 pt-4 pb-3 flex items-center justify-between gap-3
             bg-surface-0/80 backdrop-blur border-b border-white/5"
    >
      <h1 class="text-sm font-semibold tracking-wide">{{ en.explore.title }}</h1>
      <div
        role="tablist"
        :aria-label="en.explore.viewLabel"
        class="inline-flex rounded-full border border-white/10 p-0.5 text-xs"
      >
        <button
          role="tab"
          :aria-selected="view === 'list'"
          class="h-8 px-4 rounded-full transition-colors"
          :class="view === 'list' ? 'bg-accent text-surface-0 font-semibold' : 'text-ink-muted'"
          @click="setView('list')"
        >
          {{ en.explore.viewList }}
        </button>
        <button
          role="tab"
          :aria-selected="view === 'map'"
          class="h-8 px-4 rounded-full transition-colors"
          :class="view === 'map' ? 'bg-accent text-surface-0 font-semibold' : 'text-ink-muted'"
          @click="setView('map')"
        >
          {{ en.explore.viewMap }}
        </button>
      </div>
    </header>

    <div v-show="view === 'map'" class="flex-1 relative">
      <div ref="mapEl" class="absolute inset-0" />
    </div>

    <div v-if="view === 'list'" class="flex-1 overflow-y-auto px-5 py-4">
      <div class="mx-auto w-full max-w-xl">
        <EventsList />
      </div>
    </div>
  </div>
</template>
