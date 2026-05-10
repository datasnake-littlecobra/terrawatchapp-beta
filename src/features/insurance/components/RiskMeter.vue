<script setup lang="ts">
// Circular risk-score meter (0-100). Pure SVG — no chart-lib dependency
// since this is the main centerpiece on Module 1 and we want it crisp +
// instantly readable.

import { computed } from 'vue'

const props = defineProps<{
  score: number             // 0-100
  size?: number             // px, default 200
  label?: string            // override center text, defaults to score
  sublabel?: string         // small text under the score
}>()

const RADIUS = 80
const CIRCUMFERENCE = 2 * Math.PI * RADIUS  // ~502.65

const sizePx = computed(() => props.size ?? 200)
const clamped = computed(() => Math.max(0, Math.min(100, props.score)))
const offset = computed(() => CIRCUMFERENCE * (1 - clamped.value / 100))

const stroke = computed(() => {
  const s = clamped.value
  if (s >= 70) return '#FF6B6B'
  if (s >= 40) return '#F5B74A'
  return '#3DDC97'
})
</script>

<template>
  <div
    class="relative inline-flex items-center justify-center"
    :style="{ width: sizePx + 'px', height: sizePx + 'px' }"
  >
    <svg
      :viewBox="`0 0 200 200`"
      class="w-full h-full -rotate-90"
      role="img"
      :aria-label="`Risk score ${clamped} out of 100`"
    >
      <!-- track -->
      <circle
        cx="100" cy="100" r="80"
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        stroke-width="14"
      />
      <!-- progress -->
      <circle
        cx="100" cy="100" r="80"
        fill="none"
        :stroke="stroke"
        stroke-width="14"
        stroke-linecap="round"
        :stroke-dasharray="CIRCUMFERENCE"
        :stroke-dashoffset="offset"
        style="transition: stroke-dashoffset 600ms ease-out, stroke 200ms ease-out;"
      />
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
      <span class="num text-5xl font-semibold text-ink-primary leading-none">{{ label ?? clamped }}</span>
      <span v-if="sublabel" class="text-[10px] uppercase tracking-widest text-ink-muted/70 mt-2">{{ sublabel }}</span>
    </div>
  </div>
</template>
