<script setup lang="ts">
import SeverityChip from '@/ui/SeverityChip.vue'
import type { FeedEvent } from '@/types/dataSource'

defineProps<{ event: FeedEvent }>()
defineEmits<{ select: [event: FeedEvent] }>()

function timeAgo(t: Date): string {
  const ms   = Date.now() - t.getTime()
  const h    = ms / 3_600_000
  const d    = h / 24
  if (h < 1)  return 'just now'
  if (h < 48) return `${Math.floor(h)}h ago`
  return `${Math.floor(d)}d ago`
}

const categoryIcons: Record<string, string> = {
  earthquake:      'M',
  tornado:         'T',
  flood:           'F',
  wildfire:        'W',
  volcano:         'V',
  geomagnetic_storm: 'S',
  storm:           'S',
  weather_alert:   'W',
}

const sourceLabels: Record<string, string> = {
  'usgs.quakes':   'USGS',
  'nws.alerts':    'NOAA',
  'noaa.swpc.kp':  'NOAA',
  'nasa.eonet':    'NASA',
  'usgs.volcanoes':'USGS',
  'gdacs.alerts':  'GDACS',
}

function sourceLabel(id: string): string {
  if (!id) return 'DATA'
  const src = id.split(':')[0] ?? id
  return sourceLabels[src] ?? src.split('.')[0]?.toUpperCase() ?? 'DATA'
}
</script>

<template>
  <article
    role="button"
    tabindex="0"
    class="bg-surface-1 hover:bg-surface-2 border border-white/5 hover:border-white/10
           rounded-xl p-4 cursor-pointer transition-colors group"
    @click="$emit('select', event)"
    @keydown.enter="$emit('select', event)"
    @keydown.space.prevent="$emit('select', event)"
  >
    <!-- top row: chip + time -->
    <div class="flex items-center justify-between gap-2 mb-3">
      <SeverityChip :severity="event.severity" />
      <span class="text-ink-muted text-xs num shrink-0">{{ timeAgo(event.timestamp) }}</span>
    </div>

    <!-- title -->
    <h3 class="font-semibold text-ink-primary leading-snug line-clamp-2 mb-1.5 group-hover:text-accent transition-colors">
      {{ event.title }}
    </h3>

    <!-- summary -->
    <p class="text-ink-muted text-sm leading-snug line-clamp-2">{{ event.summary }}</p>

    <!-- footer: location + source -->
    <div class="flex items-center justify-between mt-3 gap-2">
      <div class="flex items-center gap-1.5 min-w-0">
        <svg v-if="event.locationLabel" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.8" stroke-linecap="round" class="w-3.5 h-3.5 shrink-0 text-ink-muted/60">
          <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/>
          <circle cx="12" cy="10" r="2.5"/>
        </svg>
        <span v-if="event.locationLabel" class="text-ink-muted text-xs truncate">
          {{ event.locationLabel }}
        </span>
        <span v-if="event.distanceKm !== undefined" class="text-ink-muted/50 text-xs num shrink-0">
          · {{ event.distanceKm.toFixed(0) }} km
        </span>
      </div>
      <span class="text-[10px] font-semibold tracking-wider text-ink-muted/60 shrink-0">
        {{ sourceLabel(event.id) }}
      </span>
    </div>
  </article>
</template>
