<script setup lang="ts">
// TerraWatch — Phase 11: Location Risk event list. Filter chips are derived
// from the fetched result set itself (not a global rolling-window RPC like
// EventsFilters.vue uses) since this is a location-scoped, multi-year query.
import { computed, ref } from 'vue'
import type { FeedEvent } from '@/types/dataSource'
import Card from '@/ui/Card.vue'
import SeverityChip from '@/ui/SeverityChip.vue'

const props = defineProps<{ events: FeedEvent[] }>()

type SortKey = 'date' | 'severity'

const sortKey    = ref<SortKey>('date')
const activeKind = ref<string | null>(null)

const kinds = computed(() => {
  const set = new Set<string>()
  for (const e of props.events) set.add(e.category ?? e.kind)
  return Array.from(set).sort()
})

const severityRank: Record<string, number> = { danger: 0, caution: 1, safe: 2 }

const sorted = computed(() => {
  let list = props.events
  const kind = activeKind.value
  if (kind) list = list.filter((e) => (e.category ?? e.kind) === kind)
  const copy = [...list]
  if (sortKey.value === 'date') {
    copy.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  } else {
    copy.sort((a, b) => (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3))
  }
  return copy
})

function toggleKind(kind: string) {
  activeKind.value = activeKind.value === kind ? null : kind
}

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <Card padded>
    <div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
      <h3 class="text-sm font-semibold text-ink-primary">Recorded events ({{ sorted.length }})</h3>
      <div class="flex items-center gap-2">
        <button
          class="text-xs px-2.5 py-1 rounded-lg border transition-colors"
          :class="sortKey === 'date' ? 'border-accent text-accent bg-accent/10' : 'border-white/10 text-ink-muted'"
          @click="sortKey = 'date'"
        >Newest</button>
        <button
          class="text-xs px-2.5 py-1 rounded-lg border transition-colors"
          :class="sortKey === 'severity' ? 'border-accent text-accent bg-accent/10' : 'border-white/10 text-ink-muted'"
          @click="sortKey = 'severity'"
        >Severity</button>
      </div>
    </div>

    <div v-if="kinds.length > 1" class="flex flex-wrap gap-1.5 mb-4">
      <button
        v-for="k in kinds"
        :key="k"
        class="text-[11px] px-2 py-1 rounded-full border transition-colors capitalize"
        :class="activeKind === k ? 'border-accent text-accent bg-accent/10' : 'border-white/10 text-ink-muted'"
        @click="toggleKind(k)"
      >{{ k }}</button>
    </div>

    <ul class="divide-y divide-white/5">
      <li v-for="e in sorted" :key="e.id" class="py-3 flex items-start gap-3">
        <SeverityChip :severity="e.severity" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-ink-primary truncate">{{ e.title }}</p>
          <p class="text-ink-muted text-xs mt-0.5">
            {{ fmtDate(e.timestamp) }}<span v-if="e.locationLabel"> · {{ e.locationLabel }}</span>
          </p>
        </div>
        <span class="text-ink-muted text-[10px] uppercase tracking-wider capitalize shrink-0 mt-0.5">
          {{ e.category ?? e.kind }}
        </span>
      </li>
    </ul>
  </Card>
</template>
