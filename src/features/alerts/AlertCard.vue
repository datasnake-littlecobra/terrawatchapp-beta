<script setup lang="ts">
import SeverityChip from '@/ui/SeverityChip.vue'
import type { FeedEvent } from '@/types/dataSource'

defineProps<{ event: FeedEvent }>()
defineEmits<{ select: [event: FeedEvent] }>()

function timeAgo(t: Date): string {
  const ms = Date.now() - t.getTime()
  const m = Math.max(0, Math.floor(ms / 60_000))
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 48) return `${h}h ago`
  return `${d}d ago`
}

const sourceLabels: Record<string, string> = {
  'usgs.quakes':     'USGS',
  'nws.alerts':      'NOAA',
  'noaa.swpc.kp':    'NOAA',
  'nasa.eonet':      'NASA',
  'usgs.volcanoes':  'USGS',
  'gdacs.alerts':    'GDACS',
  'smithsonian.gvp': 'GVP',
  'noaa.nhc':        'NHC',
  'openaq.pm25':     'OpenAQ',
}

function sourceLabel(id: string): string {
  if (!id) return 'DATA'
  const src = id.split(':')[0] ?? id
  return sourceLabels[src] ?? src.split('.')[0]?.toUpperCase() ?? 'DATA'
}

// Surface the most relevant numeric metric per category in the footer.
// Magnitude for quakes, AQI for air, intensity for hurricanes — gives the
// user a quick "how bad" signal without opening the modal.
function metric(event: FeedEvent): string | null {
  const raw = event.raw as Record<string, unknown> | undefined
  if (!raw) return null
  if (event.category === 'earthquake' && typeof raw.magnitude === 'number') {
    return `M ${raw.magnitude.toFixed(1)}`
  }
  if (event.category === 'air_quality') {
    const payload = raw.payload as Record<string, unknown> | undefined
    const aqi = payload?.aqi_us_epa
    if (typeof aqi === 'number') return `AQI ${aqi}`
  }
  if (event.category === 'hurricane') {
    const payload = raw.payload as Record<string, unknown> | undefined
    const kt = payload?.intensity_kt
    if (typeof kt === 'string' || typeof kt === 'number') {
      const n = Number(kt)
      if (Number.isFinite(n) && n > 0) return `${Math.round(n * 1.15)} mph`
    }
  }
  if (event.category === 'geomagnetic_storm' && typeof raw.kp === 'number') {
    return `Kp ${raw.kp.toFixed(1)}`
  }
  return null
}
</script>

<template>
  <article
    role="button"
    tabindex="0"
    class="bg-surface-1 hover:bg-surface-2 border border-white/10 hover:border-white/20
           rounded-2xl p-5 sm:p-6 cursor-pointer transition-colors group"
    :class="event.severity === 'danger' ? 'border-l-4 border-l-danger' : event.severity === 'caution' ? 'border-l-4 border-l-caution' : ''"
    @click="$emit('select', event)"
    @keydown.enter="$emit('select', event)"
    @keydown.space.prevent="$emit('select', event)"
  >
    <!-- Header row: severity + age + source -->
    <div class="flex items-center gap-2 mb-3">
      <SeverityChip :severity="event.severity" />
      <span class="num text-xs text-ink-muted">{{ timeAgo(event.timestamp) }}</span>
      <span class="ml-auto text-[10px] font-semibold tracking-wider text-ink-muted/60">
        {{ sourceLabel(event.id) }}
      </span>
    </div>

    <!-- Title -->
    <h2 class="text-lg sm:text-xl font-semibold text-ink-primary leading-snug group-hover:text-accent transition-colors">
      {{ event.title }}
    </h2>

    <!-- Full description (no line-clamp — readers get the full story) -->
    <p class="text-ink-muted text-sm sm:text-base leading-relaxed mt-2.5 whitespace-pre-line">
      {{ event.summary }}
    </p>

    <!-- Footer: location · metric · view link -->
    <div class="flex items-center flex-wrap gap-x-3 gap-y-1.5 mt-4 pt-4 border-t border-white/5">
      <div v-if="event.locationLabel" class="flex items-center gap-1.5 min-w-0">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" class="w-3.5 h-3.5 shrink-0 text-ink-muted/70">
          <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/>
          <circle cx="12" cy="10" r="2.5"/>
        </svg>
        <span class="text-ink-muted text-sm truncate">{{ event.locationLabel }}</span>
      </div>

      <span v-if="metric(event)" class="num text-sm text-ink-primary font-medium">
        {{ metric(event) }}
      </span>

      <span class="ml-auto text-accent text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        View details + map →
      </span>
    </div>
  </article>
</template>
