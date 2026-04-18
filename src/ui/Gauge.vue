<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ value: number; band: 'safe' | 'caution' | 'danger' }>()

const clamped = computed(() => Math.max(0, Math.min(100, Math.round(props.value))))
const dash = computed(() => (clamped.value / 100) * 282.7) // 2πr, r=45
const color = computed(
  () =>
    ({ safe: '#3DDC97', caution: '#F5B74A', danger: '#FF6B6B' })[props.band],
)
</script>

<template>
  <div class="relative inline-flex items-center justify-center" aria-hidden="true">
    <svg width="220" height="220" viewBox="0 0 100 100" class="-rotate-90">
      <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6" />
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        :stroke="color"
        stroke-width="6"
        stroke-linecap="round"
        :stroke-dasharray="`${dash} 282.7`"
        style="transition: stroke-dasharray 700ms cubic-bezier(0.2, 0.8, 0.2, 1)"
      />
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <span class="num text-hero" :style="{ color }">{{ clamped }}</span>
      <span class="text-ink-muted text-xs tracking-widest uppercase">safety</span>
    </div>
  </div>
</template>
