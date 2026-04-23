<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Card from '@/ui/Card.vue'
import { useLocationStore } from '@/stores/location'
import { getNearestShelters, type Shelter } from '@/services/fema'
import { en } from '@/i18n/en'

const location = useLocationStore()
const { coords, label } = storeToRefs(location)

const shelters = ref<Shelter[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function load() {
  if (!coords.value) return
  loading.value = true
  error.value = null
  try {
    shelters.value = await getNearestShelters(coords.value, 6, 200)
  } catch (e) {
    error.value = e instanceof Error ? e.message : en.common.error
  } finally {
    loading.value = false
  }
}

function directionsUrl(s: Shelter): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`
}

onMounted(load)
watch(coords, load)
</script>

<template>
  <div class="mx-auto w-full max-w-xl px-5 pt-8 pb-24 space-y-6">
    <header>
      <p class="text-ink-muted text-xs tracking-widest uppercase">{{ en.shelters.header }}</p>
      <h1 class="text-2xl font-semibold mt-1">{{ en.shelters.title }}</h1>
      <p class="text-ink-muted text-sm mt-2">
        {{ en.shelters.subtitle }}
        <span v-if="label" class="text-ink-primary font-medium">{{ label }}</span>
      </p>
    </header>

    <Card v-if="loading" padded>
      <p class="text-ink-muted text-sm">{{ en.common.loading }}</p>
    </Card>

    <Card v-else-if="error" padded>
      <p class="text-danger text-sm">{{ error }}</p>
    </Card>

    <Card v-else-if="!shelters.length" padded>
      <p class="text-ink-muted text-sm">{{ en.shelters.empty }}</p>
      <p class="text-ink-muted text-xs mt-2">{{ en.shelters.note }}</p>
    </Card>

    <ul v-else class="space-y-3">
      <li v-for="s in shelters" :key="s.id">
        <Card padded>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-medium truncate">{{ s.name }}</p>
              <p class="text-ink-muted text-sm mt-0.5 truncate">{{ s.address }}</p>
              <div class="flex flex-wrap gap-3 text-xs text-ink-muted mt-2 num">
                <span>{{ s.distanceKm.toFixed(1) }} {{ en.common.km }} away</span>
                <span v-if="s.capacity">· {{ s.capacity }} cap.</span>
                <span v-if="s.accessible">· ADA</span>
                <span v-if="s.petsAccepted">· Pets ok</span>
              </div>
            </div>
            <a
              :href="directionsUrl(s)"
              target="_blank"
              rel="noopener"
              class="text-accent text-xs font-medium shrink-0 self-start hover:underline"
            >
              {{ en.shelters.directions }} →
            </a>
          </div>
        </Card>
      </li>
    </ul>

    <p class="text-ink-muted text-xs leading-relaxed">{{ en.shelters.disclaimer }}</p>
  </div>
</template>
