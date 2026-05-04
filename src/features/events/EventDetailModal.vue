<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import SeverityChip from '@/ui/SeverityChip.vue'
import type { FeedEvent } from '@/types/dataSource'

const props = defineProps<{ event: FeedEvent | null }>()
const emit  = defineEmits<{ close: [] }>()

const mapEl  = ref<HTMLDivElement | null>(null)
const map    = shallowRef<maplibregl.Map | null>(null)
const marker = shallowRef<maplibregl.Marker | null>(null)

function initMap() {
  if (!mapEl.value || !props.event?.location) return
  const { lat, lon } = props.event.location
  map.value = new maplibregl.Map({
    container: mapEl.value,
    style: {
      version: 8,
      sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap' } },
      layers:  [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    center: [lon, lat],
    zoom:   8,
    interactive: true,
    attributionControl: false,
  })
  marker.value = new maplibregl.Marker({ color: '#FF6B6B' })
    .setLngLat([lon, lat])
    .addTo(map.value)
}

function destroyMap() {
  marker.value?.remove()
  marker.value = null
  map.value?.remove()
  map.value = null
}

watch(() => props.event, (ev) => {
  destroyMap()
  if (ev?.location) {
    // allow DOM to paint the container first
    setTimeout(initMap, 50)
  }
}, { immediate: false })

onMounted(() => {
  if (props.event?.location) setTimeout(initMap, 50)
})
onBeforeUnmount(destroyMap)

function formatted(t: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(t)
}

const kindLabel: Record<string, string> = {
  seismic: 'Seismic', weather: 'Weather', space: 'Space weather',
  tide: 'Tide', ufo: 'UAP', datasnake: 'DataSnake sensor',
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="event"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <!-- backdrop -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('close')" />

      <!-- panel -->
      <div
        class="relative z-10 w-full sm:max-w-2xl bg-surface-1 sm:rounded-2xl rounded-t-2xl
               border border-white/10 shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden"
      >
        <!-- header -->
        <div class="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-white/5 shrink-0">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-2">
              <SeverityChip :severity="event.severity" />
              <span class="text-ink-muted text-xs">{{ kindLabel[event.kind] ?? event.kind }}</span>
            </div>
            <h2 class="font-semibold text-ink-primary text-base leading-snug">{{ event.title }}</h2>
          </div>
          <button
            class="shrink-0 p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-white/5 transition-colors"
            aria-label="Close"
            @click="$emit('close')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" class="w-5 h-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- body -->
        <div class="flex-1 overflow-y-auto">
          <!-- map -->
          <div v-if="event.location" ref="mapEl" class="h-48 w-full bg-surface-2" />

          <!-- details -->
          <div class="px-5 py-4 space-y-4">
            <!-- summary -->
            <p class="text-ink-primary text-sm leading-relaxed">{{ event.summary }}</p>

            <!-- meta grid -->
            <div class="grid grid-cols-2 gap-3">
              <div v-if="event.locationLabel">
                <p class="text-ink-muted text-xs uppercase tracking-wider mb-1">Location</p>
                <p class="text-ink-primary text-sm">{{ event.locationLabel }}</p>
              </div>
              <div>
                <p class="text-ink-muted text-xs uppercase tracking-wider mb-1">Time</p>
                <p class="text-ink-primary text-sm num">{{ formatted(event.timestamp) }}</p>
              </div>
              <div v-if="event.distanceKm !== undefined">
                <p class="text-ink-muted text-xs uppercase tracking-wider mb-1">Distance</p>
                <p class="text-ink-primary text-sm num">{{ event.distanceKm.toFixed(0) }} km</p>
              </div>
              <div v-if="event.location">
                <p class="text-ink-muted text-xs uppercase tracking-wider mb-1">Coordinates</p>
                <p class="text-ink-primary text-sm num">
                  {{ event.location.lat.toFixed(3) }}, {{ event.location.lon.toFixed(3) }}
                </p>
              </div>
            </div>

            <!-- raw payload fields if present -->
            <template v-if="event.raw && typeof event.raw === 'object'">
              <div v-if="(event.raw as Record<string,unknown>)['magnitude']" class="flex gap-4">
                <div>
                  <p class="text-ink-muted text-xs uppercase tracking-wider mb-1">Magnitude</p>
                  <p class="text-ink-primary text-lg font-semibold num">
                    {{ (event.raw as Record<string,unknown>)['magnitude'] }}
                  </p>
                </div>
                <div v-if="(event.raw as Record<string,unknown>)['depthKm']">
                  <p class="text-ink-muted text-xs uppercase tracking-wider mb-1">Depth</p>
                  <p class="text-ink-primary text-lg font-semibold num">
                    {{ (event.raw as Record<string,unknown>)['depthKm'] }} km
                  </p>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
