<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import EventCard from './EventCard.vue'
import EventDetailModal from './EventDetailModal.vue'
import { useEvents } from '@/composables/useEvents'
import { en } from '@/i18n/en'
import type { FeedEvent } from '@/types/dataSource'

const { nearest, loading, error } = useEvents()
const selected = ref<FeedEvent | null>(null)
</script>

<template>
  <section>
    <div class="flex items-baseline justify-between mb-3">
      <h2 class="text-ink-muted text-xs tracking-widest uppercase">
        {{ en.events.nearbyTitle }}
      </h2>
      <RouterLink
        to="/events"
        class="text-accent text-xs font-medium hover:underline"
      >
        {{ en.events.seeAll }} →
      </RouterLink>
    </div>

    <p v-if="error" class="text-danger text-xs">{{ error }}</p>
    <p v-else-if="loading && !nearest.length" class="text-ink-muted text-sm">
      {{ en.common.loading }}
    </p>
    <p v-else-if="!nearest.length" class="text-ink-muted text-sm">
      {{ en.events.emptyNearby }}
    </p>

    <ul v-else class="space-y-2">
      <li v-for="e in nearest" :key="e.id">
        <EventCard :event="e" @select="selected = $event" />
      </li>
    </ul>
  </section>

  <EventDetailModal :event="selected" @close="selected = null" />
</template>
