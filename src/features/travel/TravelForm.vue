<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import { searchPlaces, type Place } from '@/services/geocode'
import { useTravelStore, type TripStyle } from '@/stores/travel'
import { en } from '@/i18n/en'
import { addDays, isoDate } from '@/lib/date'

const router = useRouter()
const travel = useTravelStore()

const query = ref('')
const picked = ref<Place | null>(null)
const suggestions = ref<Place[]>([])
const searching = ref(false)
const style = ref<TripStyle>('general')

const today = isoDate(new Date())
const start = ref(today)
const end = ref(isoDate(addDays(new Date(), 2)))

let searchHandle: number | undefined
function onQueryInput() {
  picked.value = null
  window.clearTimeout(searchHandle)
  const q = query.value
  if (q.trim().length < 2) {
    suggestions.value = []
    return
  }
  searchHandle = window.setTimeout(async () => {
    searching.value = true
    try {
      suggestions.value = await searchPlaces(q, 5)
    } finally {
      searching.value = false
    }
  }, 250)
}

function pick(p: Place) {
  picked.value = p
  query.value = `${p.name}, ${p.admin1 ? p.admin1 + ', ' : ''}${p.country}`
  suggestions.value = []
}

const canSubmit = computed(
  () => picked.value !== null && start.value && end.value && start.value <= end.value,
)

async function submit() {
  if (!picked.value) return
  await travel.runAdvisory({
    destination: picked.value,
    start: new Date(start.value),
    end: new Date(end.value),
    style: style.value,
  })
  if (!travel.error) {
    void router.push('/travel/verdict')
  }
}

const styles: { key: TripStyle; label: string }[] = [
  { key: 'urban', label: en.travel.styles.urban },
  { key: 'beach', label: en.travel.styles.beach },
  { key: 'mountain', label: en.travel.styles.mountain },
  { key: 'general', label: en.travel.styles.general },
]
</script>

<template>
  <Card padded class="space-y-5">
    <div>
      <label class="text-ink-muted text-xs uppercase tracking-widest">
        {{ en.travel.destinationLabel }}
      </label>
      <input
        v-model="query"
        @input="onQueryInput"
        :placeholder="en.travel.destinationPlaceholder"
        class="mt-2 w-full bg-surface-0 border border-white/10 rounded-xl h-12 px-4"
        autocomplete="off"
      />
      <ul
        v-if="suggestions.length"
        class="mt-2 rounded-xl bg-surface-0 border border-white/10 divide-y divide-white/5 max-h-56 overflow-y-auto"
      >
        <li v-for="p in suggestions" :key="`${p.lat}-${p.lon}`">
          <button class="w-full text-left px-3 py-2.5 hover:bg-white/5" @click="pick(p)">
            <span class="font-medium">{{ p.name }}</span>
            <span class="text-ink-muted text-sm">
              , {{ p.admin1 ? p.admin1 + ', ' : '' }}{{ p.country }}
            </span>
          </button>
        </li>
      </ul>
      <p v-else-if="query.length > 2 && !searching && !picked" class="text-ink-muted text-xs mt-2">
        {{ en.travel.geocodeFailed }}
      </p>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="text-ink-muted text-xs uppercase tracking-widest">
          {{ en.travel.startLabel }}
        </label>
        <input
          type="date"
          v-model="start"
          :min="today"
          class="mt-2 w-full bg-surface-0 border border-white/10 rounded-xl h-12 px-3"
        />
      </div>
      <div>
        <label class="text-ink-muted text-xs uppercase tracking-widest">
          {{ en.travel.endLabel }}
        </label>
        <input
          type="date"
          v-model="end"
          :min="start"
          class="mt-2 w-full bg-surface-0 border border-white/10 rounded-xl h-12 px-3"
        />
      </div>
    </div>

    <div>
      <label class="text-ink-muted text-xs uppercase tracking-widest">
        {{ en.travel.styleLabel }}
      </label>
      <div class="mt-2 grid grid-cols-4 gap-2">
        <button
          v-for="s in styles"
          :key="s.key"
          type="button"
          class="h-10 rounded-xl border text-sm transition-colors"
          :class="
            style === s.key
              ? 'border-accent text-accent bg-accent/10'
              : 'border-white/10 text-ink-muted'
          "
          @click="style = s.key"
        >{{ s.label }}</button>
      </div>
    </div>

    <Button variant="primary" size="lg" block :disabled="!canSubmit || travel.loading" @click="submit">
      {{ travel.loading ? en.common.loading : en.travel.submit }}
    </Button>

    <p v-if="travel.error" class="text-danger text-sm">{{ travel.error }}</p>
  </Card>
</template>
