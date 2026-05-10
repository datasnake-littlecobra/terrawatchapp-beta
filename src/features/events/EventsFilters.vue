<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchCategoryCounts, canUseEventsDb } from '@/services/events'

export interface FiltersState {
  search:     string
  categories: string[]
  severity:   'all' | 'danger' | 'caution' | 'safe'
}

const props = defineProps<{ modelValue: FiltersState }>()
const emit  = defineEmits<{ 'update:modelValue': [FiltersState] }>()

function update(patch: Partial<FiltersState>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

// Phase 9.5: rolling 30-day row count per category. Drives the dropdown's
// auto-grey UX — empty categories render disabled with the live count next
// to their label so users see why something's missing.
const counts = ref<Record<string, number>>({})

async function loadCounts() {
  if (!canUseEventsDb()) return
  try {
    const list = await fetchCategoryCounts(30)
    counts.value = Object.fromEntries(list.map((r) => [r.category, r.rows]))
  } catch {
    // best-effort — if counts fail, all categories stay enabled (no regression)
  }
}

onMounted(loadCounts)

function countFor(id: string): number {
  return counts.value[id] ?? 0
}
function isEmpty(id: string): boolean {
  return Object.keys(counts.value).length > 0 && countFor(id) === 0
}

// Grouped to match what the ingest pipeline actually emits today
// (USGS quakes, EONET wildfires, NOAA Kp, USGS volcanoes, NWS alerts via
// nwsCategory in _shared/ingest-common.ts). Adding a new ingester later
// = add one row here.
interface CategoryGroup { label: string; items: { id: string; label: string }[] }
const categoryGroups: CategoryGroup[] = [
  {
    label: 'Geological',
    items: [
      { id: 'earthquake', label: 'Earthquakes' },
      { id: 'volcano',    label: 'Volcanoes' },
      { id: 'tsunami',    label: 'Tsunamis' },
    ],
  },
  {
    label: 'Severe Weather',
    items: [
      { id: 'tornado',   label: 'Tornadoes' },
      { id: 'hurricane', label: 'Hurricanes' },
      { id: 'storm',     label: 'Thunderstorms' },
      { id: 'flood',     label: 'Floods' },
    ],
  },
  {
    label: 'Winter & Heat',
    items: [
      { id: 'winter_storm', label: 'Winter storms' },
      { id: 'heat',         label: 'Heat advisories' },
    ],
  },
  {
    label: 'Fire',
    items: [
      { id: 'wildfire',     label: 'Wildfires' },
      { id: 'fire_weather', label: 'Fire weather' },
    ],
  },
  {
    label: 'Marine & Wind',
    items: [
      { id: 'marine', label: 'Marine alerts' },
      { id: 'wind',   label: 'Wind events' },
    ],
  },
  {
    label: 'Space',
    items: [
      { id: 'geomagnetic_storm', label: 'Geomagnetic storms' },
    ],
  },
  {
    label: 'Other',
    items: [
      { id: 'avalanche',     label: 'Avalanches' },
      { id: 'air_quality',   label: 'Air quality' },
      { id: 'weather_alert', label: 'Other weather alerts' },
    ],
  },
]

const severityOptions = [
  { id: 'all',     label: 'All Severities' },
  { id: 'danger',  label: 'Extreme / Critical' },
  { id: 'caution', label: 'Warning' },
  { id: 'safe',    label: 'Advisory' },
] as const

const catOpen = ref(false)

function toggleCategory(id: string) {
  if (isEmpty(id)) return
  const cur = props.modelValue.categories
  const next = cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]
  update({ categories: next })
}

const hasFilters = computed(
  () => props.modelValue.search || props.modelValue.categories.length || props.modelValue.severity !== 'all'
)

function clearAll() {
  emit('update:modelValue', { search: '', categories: [], severity: 'all' })
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap gap-2">
      <!-- Search -->
      <div class="relative flex-1 min-w-[160px]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none">
          <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          :value="modelValue.search"
          type="search"
          placeholder="Search events…"
          class="w-full h-9 pl-9 pr-3 rounded-lg bg-surface-2 border border-white/10 text-sm
                 text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-accent/50 transition-colors"
          @input="update({ search: ($event.target as HTMLInputElement).value })"
        />
      </div>

      <!-- Categories dropdown -->
      <div class="relative">
        <button
          class="h-9 px-3.5 rounded-lg border text-sm flex items-center gap-1.5 transition-colors"
          :class="modelValue.categories.length
            ? 'border-accent/50 text-accent bg-accent/10'
            : 'border-white/10 text-ink-muted hover:text-ink-primary hover:border-white/20'"
          @click="catOpen = !catOpen"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" class="w-3.5 h-3.5">
            <path d="M3 6h18M7 12h10M10 18h4"/>
          </svg>
          Categories
          <span v-if="modelValue.categories.length" class="bg-accent text-surface-0 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {{ modelValue.categories.length }}
          </span>
        </button>

        <!-- dropdown -->
        <div
          v-if="catOpen"
          class="absolute left-0 top-full mt-1 z-20 bg-surface-2 border border-white/10 rounded-xl shadow-xl p-2 min-w-[220px] max-h-[60vh] overflow-y-auto"
          @click.stop
        >
          <div v-for="group in categoryGroups" :key="group.label" class="mb-2 last:mb-0">
            <p class="px-2 pt-1 pb-1 text-[10px] font-semibold tracking-widest uppercase text-ink-muted/60">
              {{ group.label }}
            </p>
            <label
              v-for="opt in group.items"
              :key="opt.id"
              class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors"
              :class="isEmpty(opt.id)
                ? 'text-ink-muted/40 cursor-not-allowed'
                : 'text-ink-primary cursor-pointer hover:bg-white/5'"
              :title="isEmpty(opt.id) ? 'No data in the last 30 days' : undefined"
            >
              <input
                type="checkbox"
                class="accent-accent disabled:opacity-40"
                :checked="modelValue.categories.includes(opt.id)"
                :disabled="isEmpty(opt.id)"
                @change="toggleCategory(opt.id)"
              />
              <span class="flex-1">{{ opt.label }}</span>
              <span
                v-if="Object.keys(counts).length > 0"
                class="num text-[10px] tabular-nums"
                :class="isEmpty(opt.id) ? 'text-ink-muted/40' : 'text-ink-muted/70'"
              >{{ countFor(opt.id) }}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Severity -->
      <select
        :value="modelValue.severity"
        class="h-9 px-3 rounded-lg border border-white/10 bg-surface-2 text-sm text-ink-muted
               focus:outline-none focus:border-accent/50 transition-colors appearance-none pr-8"
        @change="update({ severity: ($event.target as HTMLSelectElement).value as FiltersState['severity'] })"
      >
        <option v-for="opt in severityOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
      </select>

      <!-- Clear -->
      <button
        v-if="hasFilters"
        class="h-9 px-3 text-sm text-ink-muted hover:text-ink-primary transition-colors"
        @click="clearAll"
      >Clear</button>
    </div>
  </div>

  <!-- close dropdown on outside click -->
  <Teleport to="body">
    <div v-if="catOpen" class="fixed inset-0 z-10" @click="catOpen = false" />
  </Teleport>
</template>
