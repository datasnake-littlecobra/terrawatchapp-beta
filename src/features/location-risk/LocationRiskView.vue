<script setup lang="ts">
// TerraWatch — Phase 11: Location Risk. Search a place, see its historical
// disaster record pulled from the existing events_near RPC. Replaces the
// synthetic-demo AI Models section with a real feature over real ingested
// data (USGS/GDACS/NASA FIRMS via the events pipeline).
import { computed, ref } from 'vue'
import { fetchEventsNear, canUseEventsDb } from '@/services/events'
import type { Place } from '@/services/geocode'
import type { FeedEvent } from '@/types/dataSource'
import { useMeta } from '@/composables/useMeta'
import Card from '@/ui/Card.vue'
import LocationRiskSearch from './components/LocationRiskSearch.vue'
import LocationRiskMap from './components/LocationRiskMap.vue'
import LocationRiskSummary from './components/LocationRiskSummary.vue'
import LocationRiskEventList from './components/LocationRiskEventList.vue'

useMeta(() => ({
  title: 'Location Risk — TerraWatch',
  description:
    "Search any location and see its historical disaster record — earthquakes, wildfires, floods, storms, and volcanic activity — pulled from TerraWatch's tracked event history.",
}))

const RADIUS_KM   = 200
const SINCE_HOURS = 10 * 365 * 24 // ~10 years — this is a history lookup, not live monitoring
const MAX_ROWS    = 300

const picked  = ref<Place | null>(null)
const events  = ref<FeedEvent[]>([])
const loading = ref(false)
const error   = ref('')

const dbAvailable = canUseEventsDb()

async function onPick(place: Place) {
  picked.value = place
  error.value = ''
  events.value = []

  if (!dbAvailable) {
    error.value = 'Historical event data is unavailable right now.'
    return
  }

  loading.value = true
  try {
    events.value = await fetchEventsNear({
      center: { lat: place.lat, lon: place.lon },
      radiusKm: RADIUS_KM,
      sinceHours: SINCE_HOURS,
      maxRows: MAX_ROWS,
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load event history.'
  } finally {
    loading.value = false
  }
}

const hasSearched = computed(() => picked.value !== null)
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
    <header class="mb-6">
      <p class="text-ink-muted text-xs tracking-widest uppercase">Verticals · Location Risk</p>
      <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
        How disaster-prone is this place?
      </h1>
      <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-2xl">
        Search any location to see its recorded history of earthquakes, wildfires, floods, storms,
        and volcanic activity — pulled from TerraWatch's tracked event data within {{ RADIUS_KM }}km.
      </p>
    </header>

    <Card padded class="mb-6">
      <LocationRiskSearch @pick="onPick" />
    </Card>

    <template v-if="!hasSearched">
      <div class="text-center py-16 text-ink-muted text-sm">
        Search a location above to see its disaster history.
      </div>
    </template>

    <template v-else-if="error">
      <div class="rounded-xl border border-danger/30 bg-danger/5 p-5 text-danger text-sm">
        {{ error }}
      </div>
    </template>

    <template v-else-if="loading">
      <div class="text-center py-16 text-ink-muted text-sm">Loading…</div>
    </template>

    <template v-else-if="picked">
      <div v-if="events.length === 0" class="rounded-xl border border-white/10 bg-surface-1 p-6 text-ink-muted text-sm">
        No recorded events within {{ RADIUS_KM }}km of {{ picked.name }} in TerraWatch's tracked history.
        This reflects what TerraWatch has ingested so far, not a guarantee of safety.
      </div>
      <div v-else class="space-y-6">
        <LocationRiskSummary :events="events" :place="picked" :radius-km="RADIUS_KM" />
        <LocationRiskMap :events="events" :center="{ lat: picked.lat, lon: picked.lon }" />
        <LocationRiskEventList :events="events" />
      </div>
    </template>
  </div>
</template>
