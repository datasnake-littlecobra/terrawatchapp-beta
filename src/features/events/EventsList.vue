<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEvents } from '@/composables/useEvents'
import EventCard from './EventCard.vue'
import EventDetailModal from './EventDetailModal.vue'
import Button from '@/ui/Button.vue'
import { en } from '@/i18n/en'
import type { FeedEvent, FeedEventKind } from '@/types/dataSource'

const { events, loading, error, reload } = useEvents()
const selected = ref<FeedEvent | null>(null)

type Filter = 'all' | FeedEventKind
const activeFilter = ref<Filter>('all')

const filtered = computed(() =>
  activeFilter.value === 'all'
    ? events.value
    : events.value.filter((e) => e.kind === activeFilter.value),
)

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: en.events.filter.all },
  { id: 'seismic', label: en.events.kind.seismic },
  { id: 'weather', label: en.events.kind.weather },
  { id: 'space', label: en.events.kind.space },
]
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <div class="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        <button
          v-for="f in filters"
          :key="f.id"
          class="h-8 px-3 rounded-full text-xs font-medium shrink-0 border transition-colors"
          :class="
            activeFilter === f.id
              ? 'border-accent text-accent bg-accent/10'
              : 'border-white/10 text-ink-muted hover:text-ink-primary'
          "
          @click="activeFilter = f.id"
        >
          {{ f.label }}
        </button>
      </div>
      <Button size="sm" variant="ghost" :disabled="loading" @click="reload">
        {{ loading ? en.common.loading : en.events.refresh }}
      </Button>
    </div>

    <p v-if="error" class="text-danger text-sm px-1">{{ error }}</p>
    <p v-if="!loading && !filtered.length" class="text-ink-muted text-sm px-1">
      {{ en.events.empty }}
    </p>

    <ul class="space-y-2.5">
      <li v-for="e in filtered" :key="e.id">
        <EventCard :event="e" @select="selected = $event" />
      </li>
    </ul>
  </div>

  <EventDetailModal :event="selected" @close="selected = null" />
</template>
