<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Sensor, SourceTier } from '@/types/measurement'

const props = defineProps<{
  sensors: Sensor[]
  selected: Sensor | null
  sourceTier: 'all' | SourceTier
}>()
defineEmits<{ select: [Sensor] }>()

const open = ref(false)
const query = ref('')

const filtered = computed(() => {
  let list = props.sensors
  if (props.sourceTier !== 'all') {
    list = list.filter((s) => s.sourceTier === props.sourceTier)
  }
  const q = query.value.trim().toLowerCase()
  if (q) {
    list = list.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    )
  }
  // distance-sorted upstream (sensors_near order); slice to keep the dropdown
  // scannable without paginating
  return list.slice(0, 80)
})

function tierBadge(tier: SourceTier): string {
  return tier === 'public' ? 'NDBC' : 'DS'
}
</script>

<template>
  <div class="relative">
    <button
      class="w-full sm:w-80 h-10 px-3 rounded-lg border border-white/10 bg-surface-1 hover:border-white/20
             flex items-center gap-2 text-sm transition-colors"
      @click="open = !open"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" class="w-4 h-4 text-ink-muted shrink-0">
        <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <span v-if="selected" class="flex-1 text-left text-ink-primary truncate">
        {{ selected.name }}
      </span>
      <span v-else class="flex-1 text-left text-ink-muted">Select a buoy…</span>
      <span v-if="selected" class="text-[10px] font-semibold tracking-wider text-ink-muted/60 shrink-0">
        {{ tierBadge(selected.sourceTier) }}
      </span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" class="w-3.5 h-3.5 text-ink-muted shrink-0">
        <path d="m6 9 6 6 6-6"/>
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute left-0 top-full mt-1 z-20 w-full sm:w-96 bg-surface-2 border border-white/10
             rounded-xl shadow-xl p-2 max-h-[60vh] overflow-y-auto"
      @click.stop
    >
      <input
        v-model="query"
        type="search"
        placeholder="Search buoys by name or ID…"
        class="w-full h-8 px-2 mb-2 rounded-md bg-surface-1 border border-white/10
               text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-accent/50"
      />

      <p v-if="!filtered.length" class="text-ink-muted text-sm px-2 py-3">
        No buoys match your filter.
      </p>

      <ul class="divide-y divide-white/5">
        <li v-for="s in filtered" :key="s.id">
          <button
            class="w-full text-left px-2 py-2 hover:bg-white/5 rounded-md flex items-center gap-2"
            :class="selected?.id === s.id ? 'bg-accent/10 text-accent' : 'text-ink-primary'"
            @click="$emit('select', s); open = false; query = ''"
          >
            <span class="flex-1 truncate text-sm">{{ s.name }}</span>
            <span v-if="s.distanceKm != null" class="num text-[10px] text-ink-muted/70 shrink-0">
              {{ s.distanceKm.toFixed(0) }} km
            </span>
            <span class="text-[10px] font-semibold tracking-wider shrink-0"
                  :class="s.sourceTier === 'public' ? 'text-accent/70' : 'text-safe/70'">
              {{ tierBadge(s.sourceTier) }}
            </span>
          </button>
        </li>
      </ul>
    </div>

    <Teleport to="body">
      <div v-if="open" class="fixed inset-0 z-10" @click="open = false" />
    </Teleport>
  </div>
</template>
