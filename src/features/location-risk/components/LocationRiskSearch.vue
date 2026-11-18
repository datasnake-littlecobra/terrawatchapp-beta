<script setup lang="ts">
// TerraWatch — Phase 11: Location Risk search box.
import { usePlaceSearch } from '@/composables/usePlaceSearch'
import type { Place } from '@/services/geocode'

const emit = defineEmits<{ pick: [place: Place] }>()

const { query, suggestions, searching, onInput, pick } = usePlaceSearch()

function select(p: Place) {
  pick(p)
  emit('pick', p)
}
</script>

<template>
  <div>
    <label class="text-ink-muted text-xs uppercase tracking-widest">Location</label>
    <input
      v-model="query"
      @input="onInput"
      placeholder="Search a city, region, or place…"
      class="mt-2 w-full bg-surface-0 border border-white/10 rounded-xl h-12 px-4"
      autocomplete="off"
    />
    <ul
      v-if="suggestions.length"
      class="mt-2 rounded-xl bg-surface-0 border border-white/10 divide-y divide-white/5 max-h-56 overflow-y-auto"
    >
      <li v-for="p in suggestions" :key="`${p.lat}-${p.lon}`">
        <button class="w-full text-left px-3 py-2.5 hover:bg-white/5" @click="select(p)">
          <span class="font-medium">{{ p.name }}</span>
          <span class="text-ink-muted text-sm">
            , {{ p.admin1 ? p.admin1 + ', ' : '' }}{{ p.country }}
          </span>
        </button>
      </li>
    </ul>
    <p v-else-if="query.length > 2 && !searching" class="text-ink-muted text-xs mt-2">
      No matches — try a different spelling or a nearby city.
    </p>
  </div>
</template>
