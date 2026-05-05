<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AlertCard from './AlertCard.vue'
import EventDetailModal from '@/features/events/EventDetailModal.vue'
import { fetchAllEvents, canUseEventsDb } from '@/services/events'
import type { FeedEvent } from '@/types/dataSource'

// The Alerts feed is the curated severe-events surface — vertical post-style
// flow of danger-tier events globally. Caution-tier is opt-in via the toggle
// so the default view stays focused on "what genuinely needs attention right
// now". Each card opens the same EventDetailModal as Global Events, so the
// map is one click away.

type Filter = 'danger' | 'both'

const includeCaution = ref(false)
const filter = computed<Filter>(() => (includeCaution.value ? 'both' : 'danger'))

const danger = ref<FeedEvent[]>([])
const caution = ref<FeedEvent[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const lastLoadedAt = ref<Date | null>(null)

const selected = ref<FeedEvent | null>(null)

// 14-day window — danger events are rare enough that a week shows too few.
// The events_recent RPC caps at 500 anyway, plenty for severe-only filtering.
const SINCE_HOURS = 14 * 24

async function load() {
  if (!canUseEventsDb()) {
    error.value = 'Alerts feed requires the events database — not configured locally.'
    return
  }
  loading.value = true
  error.value = null
  try {
    // Two parallel queries — server-side filter is cheaper than dragging
    // 500 mixed-severity rows over the wire and bucketing client-side.
    const [d, c] = await Promise.all([
      fetchAllEvents({ sinceHours: SINCE_HOURS, maxRows: 200, severity: 'danger' }),
      fetchAllEvents({ sinceHours: SINCE_HOURS, maxRows: 200, severity: 'caution' }),
    ])
    danger.value = d
    caution.value = c
    lastLoadedAt.value = new Date()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load alerts'
  } finally {
    loading.value = false
  }
}

const merged = computed<FeedEvent[]>(() => {
  const list = filter.value === 'both' ? [...danger.value, ...caution.value] : danger.value
  return list.slice().sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
})

const dangerCount = computed(() => danger.value.length)
const cautionCount = computed(() => caution.value.length)

function lastLoadedLabel(): string {
  if (!lastLoadedAt.value) return ''
  const ms = Date.now() - lastLoadedAt.value.getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

onMounted(load)
watch(filter, () => { /* recompute is reactive; no refetch needed */ })
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
    <!-- Header -->
    <header class="mb-6">
      <div class="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary">Alerts</h1>
          <p class="text-ink-muted text-sm mt-1">
            Severe events worldwide — the ones that need attention right now.
          </p>
        </div>
        <RouterLink
          to="/settings"
          class="text-accent text-xs hover:underline whitespace-nowrap"
        >
          Notification settings →
        </RouterLink>
      </div>

      <!-- Live counts -->
      <div class="flex items-center gap-2 mt-4 flex-wrap">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-danger/15 border border-danger/30">
          <span class="w-1.5 h-1.5 rounded-full bg-danger animate-pulse"></span>
          <span class="num text-xs font-semibold text-danger">{{ dangerCount }}</span>
          <span class="text-xs text-ink-muted">extreme</span>
        </span>
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-caution/15 border border-caution/30">
          <span class="w-1.5 h-1.5 rounded-full bg-caution"></span>
          <span class="num text-xs font-semibold text-caution">{{ cautionCount }}</span>
          <span class="text-xs text-ink-muted">warning</span>
        </span>
        <button
          class="ml-auto text-xs text-ink-muted hover:text-ink-primary transition-colors"
          :disabled="loading"
          @click="load"
        >
          <span v-if="loading">Refreshing…</span>
          <span v-else-if="lastLoadedAt">Updated {{ lastLoadedLabel() }} · Refresh</span>
          <span v-else>Refresh</span>
        </button>
      </div>

      <!-- Severity toggle -->
      <div class="mt-4 inline-flex p-0.5 rounded-lg border border-white/10 bg-surface-1">
        <button
          class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          :class="!includeCaution ? 'bg-accent/20 text-accent' : 'text-ink-muted hover:text-ink-primary'"
          @click="includeCaution = false"
        >
          Extreme only
        </button>
        <button
          class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          :class="includeCaution ? 'bg-accent/20 text-accent' : 'text-ink-muted hover:text-ink-primary'"
          @click="includeCaution = true"
        >
          Extreme + Warnings
        </button>
      </div>
    </header>

    <!-- Error -->
    <p v-if="error" class="text-danger text-sm mb-4">{{ error }}</p>

    <!-- Empty -->
    <div v-if="!loading && !merged.length" class="text-center py-16">
      <div class="w-12 h-12 rounded-full bg-safe/15 border border-safe/30 flex items-center justify-center mx-auto mb-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" class="w-6 h-6 text-safe">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      </div>
      <p class="text-ink-primary font-medium">All clear</p>
      <p class="text-ink-muted text-sm mt-1">
        No {{ filter === 'both' ? 'extreme or warning' : 'extreme' }} alerts in the last 14 days.
      </p>
    </div>

    <!-- Loading skeleton (only when no data yet) -->
    <div v-if="loading && !merged.length" class="space-y-3">
      <div v-for="i in 3" :key="i" class="bg-surface-1 border border-white/5 rounded-2xl p-5 animate-pulse">
        <div class="h-4 w-24 bg-white/5 rounded mb-3"></div>
        <div class="h-5 w-3/4 bg-white/5 rounded mb-2"></div>
        <div class="h-3 w-full bg-white/5 rounded mb-1.5"></div>
        <div class="h-3 w-5/6 bg-white/5 rounded"></div>
      </div>
    </div>

    <!-- Feed -->
    <ol class="space-y-3 sm:space-y-4">
      <li v-for="ev in merged" :key="ev.id">
        <AlertCard :event="ev" @select="selected = $event" />
      </li>
    </ol>
  </div>

  <EventDetailModal :event="selected" @close="selected = null" />
</template>
