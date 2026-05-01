<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import EventCard from './EventCard.vue'
import EventDetailModal from './EventDetailModal.vue'
import EventsFilters, { type FiltersState } from './EventsFilters.vue'
import { fetchAllEvents, canUseEventsDb } from '@/services/events'
import { useEvents } from '@/composables/useEvents'
import { useLocationStore } from '@/stores/location'
import type { FeedEvent } from '@/types/dataSource'
import { storeToRefs } from 'pinia'

const router   = useRouter()
const location = useLocationStore()
const { coords } = storeToRefs(location)

const allEvents  = ref<FeedEvent[]>([])
const loading    = ref(false)
const error      = ref<string | null>(null)
const totalLoaded = ref(0)

// Live fallback composable (used when DB not configured)
const live = useEvents({ radiusKm: 2000, seismicSinceHours: 168 })

const filters = ref<FiltersState>({ search: '', categories: [], severity: 'all' })
const selected = ref<FeedEvent | null>(null)

const MAX_ROWS = 500

async function loadFromDb() {
  loading.value = true
  error.value   = null
  try {
    const rows = await fetchAllEvents({ sinceHours: 168, maxRows: MAX_ROWS })
    allEvents.value  = rows
    totalLoaded.value = rows.length
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load events'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (canUseEventsDb()) {
    void loadFromDb()
  }
  // live composable auto-loads when coords appear
})

// use DB events if available, else live
const source = computed<FeedEvent[]>(() =>
  canUseEventsDb() ? allEvents.value : live.events.value
)

const filtered = computed(() => {
  let ev = source.value
  const { search, categories, severity } = filters.value

  if (search.trim()) {
    const q = search.toLowerCase()
    ev = ev.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        (e.locationLabel ?? '').toLowerCase().includes(q),
    )
  }
  if (categories.length) {
    ev = ev.filter((e) => e.category && categories.includes(e.category))
  }
  if (severity !== 'all') {
    ev = ev.filter((e) => e.severity === severity)
  }
  return ev
})

const displayLimit = ref(30)
const displayed    = computed(() => filtered.value.slice(0, displayLimit.value))
const hasMore      = computed(() => filtered.value.length > displayLimit.value)

watch(filters, () => { displayLimit.value = 30 })
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
    <!-- header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-ink-primary">Global Events Feed</h1>
        <p class="text-ink-muted text-sm mt-0.5">Real-time environmental alerts from around the world</p>
      </div>
      <button
        class="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-sm text-ink-muted hover:text-ink-primary hover:border-white/20 transition-colors"
        @click="router.push('/events/map')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" class="w-4 h-4">
          <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z"/>
          <path d="M9 3v16M15 5v16"/>
        </svg>
        View Map
      </button>
    </div>

    <!-- filters -->
    <div class="mb-4">
      <EventsFilters v-model="filters" />
    </div>

    <!-- count -->
    <p class="text-ink-muted text-sm mb-4">
      <template v-if="loading">Loading events…</template>
      <template v-else>
        Showing {{ displayed.length }} of {{ filtered.length }} events
        <template v-if="filtered.length < totalLoaded"> (filtered from {{ totalLoaded }})</template>
        <template v-else-if="totalLoaded >= MAX_ROWS"> (limited to {{ MAX_ROWS }})</template>
      </template>
    </p>

    <p v-if="error" class="text-danger text-sm mb-4">{{ error }}</p>

    <!-- cards grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      <EventCard
        v-for="ev in displayed"
        :key="ev.id"
        :event="ev"
        @select="selected = $event"
      />
    </div>

    <!-- empty -->
    <div v-if="!loading && !displayed.length" class="text-center py-16 text-ink-muted">
      <p class="text-lg mb-2">No events match your filters.</p>
      <button class="text-accent text-sm" @click="filters = { search: '', categories: [], severity: 'all' }">
        Clear filters
      </button>
    </div>

    <!-- load more -->
    <div v-if="hasMore" class="mt-6 flex justify-center">
      <button
        class="px-6 py-2.5 rounded-lg border border-white/10 text-sm text-ink-muted hover:text-ink-primary hover:border-white/20 transition-colors"
        @click="displayLimit += 30"
      >
        Show more ({{ filtered.length - displayLimit }} remaining)
      </button>
    </div>
  </div>

  <EventDetailModal :event="selected" @close="selected = null" />
</template>
