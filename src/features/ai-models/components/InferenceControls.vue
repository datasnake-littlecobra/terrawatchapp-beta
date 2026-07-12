<script setup lang="ts">
// Shared control panel used on every /ai-models/* detail page.
// Emits a filtered subset of InferenceResult[] in real time as the user
// adjusts confidence threshold or class checkboxes.

import { computed, ref, watch } from 'vue'
import type { InferenceResult } from '@/types/aiModels'

const props = defineProps<{
  results: InferenceResult[]
  modelSlug: string
  inputLabel?: string   // e.g. 'Sonar stream' / 'SAR satellite pass'
  inputSource?: string  // e.g. 'sonar:noaa-sub-001'
}>()

const emit = defineEmits<{
  filtered: [results: InferenceResult[]]
}>()

// ── State ──────────────────────────────────────────────────────────────────
const minConfidence = ref(0)       // 0–100 slider value (maps to 0.0–1.0)
const selectedClasses = ref<Set<string>>(new Set())
const showInputPanel = ref(true)

// All unique classes in the result set
const allClasses = computed(() =>
  [...new Set(props.results.map(r => r.detectedClass))].sort(),
)

// Filtered output
const filtered = computed(() =>
  props.results.filter(r => {
    if (r.confidence < minConfidence.value / 100) return false
    if (selectedClasses.value.size > 0 && !selectedClasses.value.has(r.detectedClass)) return false
    return true
  }),
)

watch(filtered, val => emit('filtered', val), { immediate: true })

function toggleClass(cls: string) {
  const next = new Set(selectedClasses.value)
  if (next.has(cls)) next.delete(cls)
  else next.add(cls)
  selectedClasses.value = next
}

function reset() {
  minConfidence.value = 0
  selectedClasses.value = new Set()
}

// Class chip colours (same logic as InferenceLogTable)
function classChipClass(cls: string): string {
  const c = cls.toLowerCase()
  if (c.includes('oil') || c.includes('slick') || c.includes('corrode') || c.includes('damage'))
    return 'border-danger/40 text-danger bg-danger/[0.08]'
  if (c.includes('subsidence') || c.includes('exposed') || c.includes('uplift') || c.includes('debris'))
    return 'border-caution/40 text-caution bg-caution/[0.08]'
  if (c.includes('intact') || c.includes('clean') || c.includes('no_deform'))
    return 'border-safe/40 text-safe bg-safe/[0.08]'
  return 'border-white/10 text-ink-muted bg-white/5'
}

// Unique sources for the input panel
const sources = computed(() =>
  [...new Set(props.results.map(r => r.inputSource))].slice(0, 6),
)

const dateRange = computed(() => {
  if (!props.results.length) return null
  const times = props.results.map(r => r.inferredAt.getTime())
  const min = new Date(Math.min(...times))
  const max = new Date(Math.max(...times))
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmt(min)} — ${fmt(max)}`
})
</script>

<template>
  <div class="rounded-2xl border border-white/5 bg-surface-1 overflow-hidden">
    <!-- Header row -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-white/5">
      <div class="flex items-center gap-2">
        <!-- Result count badge -->
        <span class="text-xs font-semibold text-ink-primary num">
          {{ filtered.length }}
        </span>
        <span class="text-xs text-ink-muted">
          of {{ results.length }} results
        </span>
        <span
          v-if="filtered.length < results.length"
          class="text-[10px] uppercase tracking-wider text-accent border border-accent/30 bg-accent/[0.06] px-1.5 py-0.5 rounded"
        >filtered</span>
      </div>
      <div class="flex items-center gap-3">
        <button
          v-if="minConfidence > 0 || selectedClasses.size > 0"
          class="text-[11px] text-ink-muted hover:text-ink-primary transition-colors"
          @click="reset"
        >
          Reset filters
        </button>
        <button
          class="text-[11px] text-ink-muted hover:text-ink-primary transition-colors"
          @click="showInputPanel = !showInputPanel"
        >
          {{ showInputPanel ? 'Hide' : 'Show' }} inputs
        </button>
      </div>
    </div>

    <div class="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
      <!-- ── Left: Input panel ──────────────────────────────────────────── -->
      <div v-if="showInputPanel" class="p-4 space-y-4">
        <div>
          <p class="text-[10px] uppercase tracking-widest text-ink-muted/60 mb-2">Model Input</p>
          <div class="space-y-2 text-xs">
            <div class="flex justify-between">
              <span class="text-ink-muted">Type</span>
              <span class="text-ink-primary font-medium">{{ inputLabel ?? 'Sensor stream' }}</span>
            </div>
            <div v-if="sources.length" class="space-y-1">
              <span class="text-ink-muted">Sources</span>
              <div class="flex flex-wrap gap-1 mt-1">
                <span
                  v-for="s in sources"
                  :key="s"
                  class="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-ink-muted/70 font-mono"
                >{{ s }}</span>
              </div>
            </div>
            <div v-if="dateRange" class="flex justify-between">
              <span class="text-ink-muted">Date range</span>
              <span class="text-ink-primary num">{{ dateRange }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-ink-muted">Total inferences</span>
              <span class="text-ink-primary num">{{ results.length }}</span>
            </div>
          </div>
        </div>

        <!-- Class distribution (read-only, shows what the model actually produced) -->
        <div>
          <p class="text-[10px] uppercase tracking-widest text-ink-muted/60 mb-2">Output distribution</p>
          <div class="space-y-1">
            <div
              v-for="cls in allClasses"
              :key="cls"
              class="flex items-center gap-2"
            >
              <div class="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  class="h-full bg-accent/50 rounded-full"
                  :style="{
                    width: `${(results.filter(r => r.detectedClass === cls).length / results.length * 100).toFixed(0)}%`
                  }"
                />
              </div>
              <span class="text-[10px] text-ink-muted w-24 truncate">{{ cls.replace(/_/g, ' ') }}</span>
              <span class="text-[10px] text-ink-muted/50 num w-8 text-right">
                {{ results.filter(r => r.detectedClass === cls).length }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Right: Filter controls ─────────────────────────────────────── -->
      <div class="p-4 space-y-4">
        <!-- Confidence threshold slider -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">Min confidence</p>
            <span class="text-xs font-semibold text-ink-primary num">{{ minConfidence }}%</span>
          </div>
          <input
            v-model.number="minConfidence"
            type="range"
            min="0"
            max="99"
            step="1"
            class="w-full h-1.5 appearance-none rounded-full cursor-pointer accent-indigo-500"
            style="background: linear-gradient(to right, #6366f1 0%, #6366f1 var(--pct, 0%), rgba(255,255,255,0.1) var(--pct, 0%), rgba(255,255,255,0.1) 100%)"
            :style="`--pct: ${minConfidence}%`"
          />
          <div class="flex justify-between text-[9px] text-ink-muted/50 mt-1">
            <span>0%</span><span>50%</span><span>99%</span>
          </div>
        </div>

        <!-- Class filter checkboxes -->
        <div v-if="allClasses.length">
          <p class="text-[10px] uppercase tracking-widest text-ink-muted/60 mb-2">
            Filter by class
            <span v-if="selectedClasses.size > 0" class="text-accent ml-1">({{ selectedClasses.size }} selected)</span>
          </p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="cls in allClasses"
              :key="cls"
              class="text-[10px] uppercase tracking-wide px-2 py-1 rounded border font-medium transition-all"
              :class="selectedClasses.size === 0 || selectedClasses.has(cls)
                ? classChipClass(cls)
                : 'border-white/5 text-ink-muted/30 bg-white/[0.02]'"
              @click="toggleClass(cls)"
            >
              {{ cls.replace(/_/g, ' ') }}
            </button>
          </div>
        </div>

        <!-- What this means callout -->
        <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3">
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mb-1">Reading the output</p>
          <p class="text-xs text-ink-muted leading-relaxed">
            Each row is one inference event: the model read a sensor frame and assigned it a class +
            confidence score. Higher confidence = stronger match to the training examples for that class.
            Use the slider to isolate high-confidence detections, or tick a class to see only that category
            across the chart, map, and log below.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
