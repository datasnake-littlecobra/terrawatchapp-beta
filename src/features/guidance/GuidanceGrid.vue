<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Card from '@/ui/Card.vue'
import { en } from '@/i18n/en'

const cards = [
  { to: '/travel', title: en.guidance.planTrip, body: en.guidance.planTripBody, icon: '✈' },
  { to: '/shelters', title: en.guidance.shelter, body: en.guidance.shelterBody, icon: '◆' },
  { to: '/bookmarks', title: en.guidance.bookmarks, body: en.guidance.bookmarksBody, icon: '☆' },
  { to: '/alerts', title: en.guidance.subscribe, body: en.guidance.subscribeBody, icon: '◉' },
]
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <RouterLink
      v-for="c in cards"
      :key="c.to"
      :to="c.to"
      class="group"
    >
      <Card padded class="h-full transition-colors group-hover:bg-surface-2">
        <div class="flex items-start gap-3">
          <span class="text-accent text-xl leading-none mt-0.5">{{ c.icon }}</span>
          <div>
            <h3 class="font-medium text-ink-primary">{{ c.title }}</h3>
            <p class="text-ink-muted text-sm mt-1 leading-snug">{{ c.body }}</p>
          </div>
        </div>
      </Card>
    </RouterLink>
  </div>
</template>
