<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AlertPill from '@/ui/AlertPill.vue'
import { useEvents } from '@/composables/useEvents'
import { en } from '@/i18n/en'

const { nearest, loading, error } = useEvents()
</script>

<template>
  <section>
    <div class="flex items-baseline justify-between mb-3">
      <h2 class="text-ink-muted text-xs tracking-widest uppercase">
        {{ en.events.nearbyTitle }}
      </h2>
      <RouterLink
        to="/explore?view=list"
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
        <RouterLink
          to="/explore?view=list"
          class="block card p-3 hover:bg-surface-2 transition-colors"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <AlertPill :tone="e.severity" :label="en.events.kind[e.kind]" />
                <span v-if="e.distanceKm !== undefined" class="num text-ink-muted text-xs">
                  {{ e.distanceKm.toFixed(0) }} {{ en.common.km }}
                </span>
              </div>
              <p class="font-medium text-sm mt-1.5 truncate">{{ e.title }}</p>
            </div>
          </div>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
