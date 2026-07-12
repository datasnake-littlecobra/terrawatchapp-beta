<script setup lang="ts">
import { computed, ref } from 'vue'
import type { InferenceResult } from '@/types/aiModels'

const props = defineProps<{ results: InferenceResult[]; pageSize?: number }>()

const PAGE = computed(() => props.pageSize ?? 10)
const shown = ref(PAGE.value)
const visible = computed(() => props.results.slice(0, shown.value))
const hasMore = computed(() => shown.value < props.results.length)

function showMore() {
  shown.value = Math.min(shown.value + PAGE.value, props.results.length)
}

// Color chip by class semantics
function classChipClass(cls: string): string {
  const c = cls.toLowerCase()
  if (c.includes('oil') || c.includes('slick') || c.includes('spill') || c.includes('corrode') || c.includes('damage'))
    return 'border-danger/40 text-danger bg-danger/[0.08]'
  if (c.includes('subsidence') || c.includes('exposed') || c.includes('uplift') || c.includes('debris'))
    return 'border-caution/40 text-caution bg-caution/[0.08]'
  if (c.includes('intact') || c.includes('clean') || c.includes('no_deform'))
    return 'border-safe/40 text-safe bg-safe/[0.08]'
  return 'border-white/10 text-ink-muted bg-white/5'
}

function fmtTime(d: Date): string {
  return d.toLocaleString('en-US', {
    month:  'short',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function metaSummary(meta: Record<string, unknown>): string {
  const keys = ['segment_id', 'area_km2', 'max_displacement_cm', 'event_date', 'satellite', 'pipeline_km']
  const parts: string[] = []
  for (const k of keys) {
    if (meta[k] != null) parts.push(`${k.replace(/_/g, ' ')}: ${meta[k]}`)
  }
  return parts.slice(0, 2).join(' · ') || '—'
}
</script>

<template>
  <div>
    <p v-if="!results.length" class="text-ink-muted text-sm text-center py-8">
      No inference results yet.
    </p>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-xs min-w-[560px]">
        <thead>
          <tr class="border-b border-white/5 text-left text-[10px] uppercase tracking-wider text-ink-muted/60">
            <th class="pb-2 pr-4">Time</th>
            <th class="pb-2 pr-4">Input source</th>
            <th class="pb-2 pr-4">Class</th>
            <th class="pb-2 pr-4 w-28">Confidence</th>
            <th class="pb-2">Meta</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in visible"
            :key="r.id"
            class="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
          >
            <td class="py-2 pr-4 text-ink-muted/70 whitespace-nowrap num">
              {{ fmtTime(r.inferredAt) }}
            </td>
            <td class="py-2 pr-4 text-ink-muted truncate max-w-[160px]">{{ r.inputSource }}</td>
            <td class="py-2 pr-4">
              <span
                class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border font-medium"
                :class="classChipClass(r.detectedClass)"
              >{{ r.detectedClass.replace(/_/g, ' ') }}</span>
            </td>
            <td class="py-2 pr-4">
              <div class="flex items-center gap-1.5">
                <div class="h-1.5 bg-white/5 rounded-full flex-1 min-w-[60px]">
                  <div
                    class="h-full bg-accent/70 rounded-full"
                    :style="{ width: `${(r.confidence * 100).toFixed(0)}%` }"
                  />
                </div>
                <span class="text-ink-muted/70 num shrink-0">{{ (r.confidence * 100).toFixed(0) }}%</span>
              </div>
            </td>
            <td class="py-2 text-ink-muted/50 truncate max-w-[180px]">{{ metaSummary(r.metadata) }}</td>
          </tr>
        </tbody>
      </table>

      <button
        v-if="hasMore"
        class="mt-3 text-xs text-ink-muted hover:text-ink-primary transition-colors"
        @click="showMore"
      >
        Show more ({{ results.length - shown }} remaining)
      </button>
    </div>
  </div>
</template>
