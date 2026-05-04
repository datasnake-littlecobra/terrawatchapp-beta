<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLocationStore } from '@/stores/location'
import { useSafetyStore } from '@/stores/safety'
import { en } from '@/i18n/en'
import Gauge from '@/ui/Gauge.vue'
import AlertPill from '@/ui/AlertPill.vue'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import SaveLocationButton from '@/features/bookmarks/SaveLocationButton.vue'
import { useShare } from '@/composables/useShare'
import { searchPlaces } from '@/services/geocode'

const location = useLocationStore()
const safety   = useSafetyStore()
const { coords, label, status } = storeToRefs(location)
const { score, loading, error } = storeToRefs(safety)
const { share } = useShare()

watch(
  coords,
  (loc) => { if (loc) void safety.load(loc) },
  { immediate: true },
)

const headline = computed(() => score.value ? en.safety.band[score.value.band] : '')

async function doShare() {
  if (!score.value) return
  const where = label.value ?? 'my area'
  await share({
    title: 'TerraWatch',
    text: en.safety.shareText(where, score.value.score, headline.value),
    url: 'https://terrawatchapp.com',
    dialogTitle: en.safety.shareDialog,
  })
}

// ── Expand panel + location override (Phase 9.2) ─────────────────────────────
const expanded = ref(false)

const locationQuery    = ref('')
const geocoding        = ref(false)
const placeSuggestions = ref<Awaited<ReturnType<typeof searchPlaces>>>([])
const overrideLabel    = ref<string | null>(null)

watch(locationQuery, async (q) => {
  if (q.trim().length < 2) { placeSuggestions.value = []; return }
  placeSuggestions.value = await searchPlaces(q, 4)
})

async function applyPlace(p: (typeof placeSuggestions.value)[number]) {
  geocoding.value = true
  placeSuggestions.value = []
  locationQuery.value = ''
  overrideLabel.value = `${p.name}, ${p.country}`
  await safety.load({ lat: p.lat, lon: p.lon })
  geocoding.value = false
}

function resetLocation() {
  overrideLabel.value = null
  if (coords.value) void safety.load(coords.value)
}

const subscorebars = computed(() => {
  const s = score.value?.subscores
  if (!s) return []
  const labels: Record<string, string> = {
    seismic: 'Seismic', weather: 'Weather', space: 'Space weather', tide: 'Tides',
  }
  return (Object.entries(s) as [string, number | null][])
    .filter(([, v]) => v !== null)
    .map(([k, v]) => ({
      key: k, label: labels[k] ?? k, value: v as number,
      color: (v as number) >= 70 ? '#3DDC97' : (v as number) >= 40 ? '#F5B74A' : '#FF6B6B',
    }))
})

const displayLabel = computed(() => overrideLabel.value ?? label.value ?? '—')
</script>

<template>
  <Card padded elevated>
    <div class="flex flex-col items-center text-center gap-4 py-4">
      <!-- Location header -->
      <p class="text-ink-muted text-xs tracking-widest uppercase flex items-center gap-2">
        {{ en.safety.title }} · {{ displayLabel }}
        <button v-if="overrideLabel" class="text-accent text-[10px] underline" @click="resetLocation">
          reset
        </button>
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

        <!-- Actions -->
        <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button variant="ghost" size="sm" @click="doShare">
            <span aria-hidden="true" class="mr-1.5">↗</span>{{ en.safety.shareCta }}
          </Button>
          <SaveLocationButton
            v-if="coords && label && !overrideLabel"
            :lat="coords.lat"
            :lon="coords.lon"
            :label="label"
            kind="home"
          />
          <Button variant="ghost" size="sm" @click="expanded = !expanded">
            {{ expanded ? 'Hide details' : 'Why this score?' }}
          </Button>
        </div>

        <!-- ── Details panel ── -->
        <div v-if="expanded" class="w-full text-left mt-4 pt-4 border-t border-white/10 space-y-5">

          <!-- Location search override -->
          <div>
            <p class="text-ink-muted text-[10px] uppercase tracking-widest mb-2">Check another location</p>
            <div class="relative">
              <input
                v-model="locationQuery"
                type="text"
                placeholder="City, region, or country…"
                class="w-full h-9 px-3 rounded-lg bg-surface-2 border border-white/10 text-sm
                       text-ink-primary placeholder:text-ink-muted
                       focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>
            <ul v-if="placeSuggestions.length"
                class="mt-1 bg-surface-2 border border-white/10 rounded-lg overflow-hidden z-10 relative">
              <li
                v-for="p in placeSuggestions"
                :key="`${p.lat},${p.lon}`"
                class="px-3 py-2 text-sm text-ink-primary hover:bg-white/5 cursor-pointer flex justify-between"
                @click="applyPlace(p)"
              >
                <span>{{ p.name }}<span v-if="p.admin1" class="text-ink-muted">, {{ p.admin1 }}</span></span>
                <span class="text-ink-muted text-xs ml-2 shrink-0">{{ p.country }}</span>
              </li>
            </ul>
            <p v-if="geocoding" class="text-ink-muted text-xs mt-1">Loading…</p>
          </div>

          <!-- Sub-score bars -->
          <div class="space-y-3">
            <p class="text-ink-muted text-[10px] uppercase tracking-widest">Conditions breakdown</p>
            <div v-for="bar in subscorebars" :key="bar.key" class="space-y-1.5">
              <div class="flex justify-between text-xs">
                <span class="text-ink-muted">{{ bar.label }}</span>
                <span class="num font-semibold" :style="{ color: bar.color }">{{ bar.value }}/100</span>
              </div>
              <div class="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  class="h-full rounded-full transition-[width] duration-700"
                  :style="{ width: `${bar.value}%`, background: bar.color }"
                />
              </div>
            </div>
          </div>

          <!-- Reason cards -->
          <div v-if="score.reasons.length" class="space-y-2">
            <p class="text-ink-muted text-[10px] uppercase tracking-widest">{{ en.safety.reasonsHeader }}</p>
            <div
              v-for="r in score.reasons"
              :key="r.headline"
              class="p-3 rounded-lg bg-surface-2 border border-white/5 text-left"
            >
              <p class="text-sm font-medium text-ink-primary">{{ r.headline }}</p>
              <p v-if="r.detail" class="text-ink-muted text-xs mt-0.5">{{ r.detail }}</p>
            </div>
          </div>

          <p v-if="!score.reasons.length" class="text-ink-muted text-sm text-center">
            All conditions within normal range.
          </p>
        </div>
      </template>

      <template v-else-if="error">
        <div class="py-10 text-danger text-sm">{{ en.common.error }}</div>
      </template>
    </div>
  </Card>
</template>
