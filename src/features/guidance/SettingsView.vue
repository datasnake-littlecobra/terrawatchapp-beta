<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import { usePreferencesStore } from '@/stores/preferences'
import { useLocationStore } from '@/stores/location'
import { searchPlaces, type Place } from '@/services/geocode'

const prefs = usePreferencesStore()
const location = useLocationStore()

const query = ref('')
const results = ref<Place[]>([])
const searching = ref(false)

async function search() {
  if (!query.value.trim()) {
    results.value = []
    return
  }
  searching.value = true
  try {
    results.value = await searchPlaces(query.value, 5)
  } finally {
    searching.value = false
  }
}

function pick(p: Place) {
  location.setManual({ lat: p.lat, lon: p.lon }, `${p.name}, ${p.country}`)
  query.value = ''
  results.value = []
}
</script>

<template>
  <div class="mx-auto w-full max-w-xl px-5 pt-8 space-y-6">
    <h1 class="text-xl font-semibold">Settings</h1>

    <Card padded>
      <h2 class="font-medium">Location</h2>
      <p class="text-ink-muted text-sm mt-1">Currently: {{ location.label ?? 'Not set' }}</p>
      <div class="mt-3 flex gap-2">
        <input
          v-model="query"
          @keydown.enter="search"
          placeholder="Search a place"
          class="flex-1 bg-surface-0 border border-white/10 rounded-xl h-11 px-3 text-sm"
        />
        <Button size="md" @click="search" :disabled="searching">Search</Button>
      </div>
      <ul v-if="results.length" class="mt-3 divide-y divide-white/5">
        <li v-for="p in results" :key="`${p.lat}-${p.lon}`">
          <button
            class="w-full text-left py-2.5 hover:bg-white/5 px-1 rounded"
            @click="pick(p)"
          >
            <span class="font-medium">{{ p.name }}</span>
            <span class="text-ink-muted text-sm">, {{ p.admin1 ?? '' }} {{ p.country }}</span>
          </button>
        </li>
      </ul>
      <Button v-if="location.status === 'manual'" variant="ghost" size="sm" class="mt-3"
              @click="location.clearManual">
        Use my current location
      </Button>
    </Card>

    <Card padded>
      <h2 class="font-medium">Units</h2>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button
          class="h-11 rounded-xl border transition-colors"
          :class="prefs.units === 'metric' ? 'border-accent text-accent' : 'border-white/10 text-ink-muted'"
          @click="prefs.patch({ units: 'metric' })"
        >Metric</button>
        <button
          class="h-11 rounded-xl border transition-colors"
          :class="prefs.units === 'imperial' ? 'border-accent text-accent' : 'border-white/10 text-ink-muted'"
          @click="prefs.patch({ units: 'imperial' })"
        >Imperial</button>
      </div>
    </Card>
  </div>
</template>
