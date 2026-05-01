<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import EventsFilters, { type FiltersState } from './EventsFilters.vue'
import EventDetailModal from './EventDetailModal.vue'
import { fetchAllEvents, canUseEventsDb } from '@/services/events'
import { useEvents } from '@/composables/useEvents'
import { useLocationStore } from '@/stores/location'
import type { FeedEvent } from '@/types/dataSource'
import { storeToRefs } from 'pinia'

const router   = useRouter()
const location = useLocationStore()
const { coords } = storeToRefs(location)

const mapEl    = ref<HTMLDivElement | null>(null)
const map      = shallowRef<maplibregl.Map | null>(null)
const markers  = shallowRef<maplibregl.Marker[]>([])
const allEvents = ref<FeedEvent[]>([])
const loading   = ref(false)
const selected  = ref<FeedEvent | null>(null)
const filters   = ref<FiltersState>({ search: '', categories: [], severity: 'all' })
const live      = useEvents({ radiusKm: 2000, seismicSinceHours: 168 })

const source = computed<FeedEvent[]>(() =>
  canUseEventsDb() ? allEvents.value : live.events.value
)

const filtered = computed(() => {
  let ev = source.value.filter((e) => e.location)
  const { search, categories, severity } = filters.value
  if (search.trim()) {
    const q = search.toLowerCase()
    ev = ev.filter((e) => e.title.toLowerCase().includes(q) || (e.locationLabel ?? '').toLowerCase().includes(q))
  }
  if (categories.length) ev = ev.filter((e) => e.category && categories.includes(e.category))
  if (severity !== 'all') ev = ev.filter((e) => e.severity === severity)
  return ev
})

// Live severity counts — drive the corner pills, update with filters.
const severityCounts = computed(() => {
  const c = { danger: 0, caution: 0, safe: 0 }
  for (const e of filtered.value) c[e.severity]++
  return c
})

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
  for (const ev of filtered.value) {
    if (!ev.location) continue
    const el = Object.assign(document.createElement('div'), { className: '' })
    el.style.cssText = [
      `width:12px;height:12px;border-radius:9999px;cursor:pointer;`,
      `background:${severityColor[ev.severity]};`,
      `border:2px solid rgba(0,0,0,0.4);`,
      `box-shadow:0 0 0 2px ${severityColor[ev.severity]}40;`,
    ].join('')
    const m = new maplibregl.Marker({ element: el })
      .setLngLat([ev.location.lon, ev.location.lat])
      .addTo(map.value)
    el.addEventListener('click', () => { selected.value = ev })
    markers.value = [...markers.value, m]
  }
}

watch(filtered, drawMarkers)

function initMap() {
  if (!mapEl.value || map.value) return
  const center: [number, number] = coords.value
    ? [coords.value.lon, coords.value.lat]
    : [0, 20]
  map.value = new maplibregl.Map({
    container: mapEl.value,
    style: {
      version: 8,
      sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap' } },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    center,
    zoom: coords.value ? 4 : 2,
  })
  map.value.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  map.value.on('load', drawMarkers)
}

onMounted(async () => {
  initMap()
  loading.value = true
  try {
    if (canUseEventsDb()) {
      allEvents.value = await fetchAllEvents({ sinceHours: 168, maxRows: 500 })
    }
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  clearMarkers()
  map.value?.remove()
  map.value = null
})
</script>

<template>
  <div class="flex flex-col h-[calc(100dvh-4rem)] lg:h-dvh">
    <!-- toolbar -->
    <div class="shrink-0 px-4 py-3 border-b border-white/5 bg-surface-0/90 backdrop-blur space-y-2">
      <div class="flex items-center gap-3">
        <button
          class="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink-primary transition-colors"
          @click="router.push('/events')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" class="w-4 h-4"><path d="m15 18-6-6 6-6"/></svg>
          View List
        </button>
        <h1 class="text-sm font-semibold text-ink-primary flex-1">Events Map</h1>
        <span v-if="loading" class="text-ink-muted text-xs">Loading…</span>
        <span v-else class="text-ink-muted text-xs">{{ filtered.length }} events</span>
      </div>
      <EventsFilters v-model="filters" />
    </div>

    <!-- Severity count pills (top-right) -->
    <div class="absolute top-4 right-4 z-10 flex flex-col gap-1.5 items-end">
      <div class="bg-surface-1/95 backdrop-blur rounded-lg border border-white/10 px-3 py-2 flex gap-3 text-xs">
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-danger" />
          <span class="num font-semibold text-ink-primary">{{ severityCounts.danger }}</span>
          <span class="text-ink-muted">Extreme</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-caution" />
          <span class="num font-semibold text-ink-primary">{{ severityCounts.caution }}</span>
          <span class="text-ink-muted">Warning</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-safe" />
          <span class="num font-semibold text-ink-primary">{{ severityCounts.safe }}</span>
          <span class="text-ink-muted">Advisory</span>
        </div>
      </div>
    </div>

    <!-- map -->
    <div ref="mapEl" class="flex-1" />
  </div>

  <EventDetailModal :event="selected" @close="selected = null" />
</template>
