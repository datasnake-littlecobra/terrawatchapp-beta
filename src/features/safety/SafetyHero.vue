<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLocationStore } from '@/stores/location'
import { useSafetyStore } from '@/stores/safety'
import { en } from '@/i18n/en'
import Gauge from '@/ui/Gauge.vue'
import AlertPill from '@/ui/AlertPill.vue'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'

const location = useLocationStore()
const safety = useSafetyStore()
const { coords, label, status } = storeToRefs(location)
const { score, loading, error } = storeToRefs(safety)

watch(
  coords,
  (loc) => {
    if (loc) void safety.load(loc)
  },
  { immediate: true },
)

const headline = computed(() => {
  if (!score.value) return ''
  return en.safety.band[score.value.band]
})
</script>

<template>
  <Card padded elevated>
    <div class="flex flex-col items-center text-center gap-4 py-4">
      <p class="text-ink-muted text-xs tracking-widest uppercase">
        {{ en.safety.title }} · {{ label ?? '—' }}
      </p>

      <template v-if="status === 'locating' || (loading && !score)">
        <div class="h-[220px] flex items-center justify-center text-ink-muted">
          {{ en.safety.locating }}
        </div>
      </template>

      <template v-else-if="status === 'denied' && !coords">
        <div class="py-10 text-ink-muted text-sm max-w-xs">
          {{ en.safety.locationDenied }}
        </div>
      </template>

      <template v-else-if="score">
        <Gauge :value="score.score" :band="score.band" />
        <h2 class="text-2xl font-semibold mt-2">{{ headline }}</h2>

        <div v-if="score.reasons.length" class="flex flex-wrap gap-2 justify-center mt-2">
          <AlertPill
            v-for="r in score.reasons.slice(0, 3)"
            :key="r.headline"
            :tone="r.tone"
            :label="r.headline"
          />
        </div>

        <Button variant="ghost" size="sm" class="mt-4">
          {{ en.safety.cta }}
        </Button>
      </template>

      <template v-else-if="error">
        <div class="py-10 text-danger text-sm">{{ en.common.error }}</div>
      </template>
    </div>
  </Card>
</template>
