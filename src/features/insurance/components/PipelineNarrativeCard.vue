<script setup lang="ts">
// TerraWatch — Phase 9.13.2: one Section-C card.
//
// Shape: sensor signal → derived metric → insurance action → deep-link.
// Five of these render the value-chain narrative on /insurance/pipeline.

import { RouterLink } from 'vue-router'
import CalibrationBadge from './CalibrationBadge.vue'
import type { Calibration } from '@/types/explainer'

defineProps<{
  title:       string
  signal:      string
  metric:      string
  action:      string
  linkTo:      string
  linkLabel:   string
  calibration: Calibration
}>()
</script>

<template>
  <div class="rounded-xl border border-white/5 bg-surface-1 p-4 flex flex-col gap-3">
    <div class="flex items-baseline justify-between gap-2">
      <h3 class="text-sm font-semibold text-ink-primary">{{ title }}</h3>
      <CalibrationBadge :calibration="calibration" small />
    </div>

    <div class="grid grid-cols-[80px_1fr] gap-x-3 gap-y-2 text-xs">
      <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">Signal</p>
      <p class="text-ink-primary leading-snug">{{ signal }}</p>

      <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">Metric</p>
      <p class="text-ink-primary leading-snug">{{ metric }}</p>

      <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">Action</p>
      <p class="text-ink-primary leading-snug">{{ action }}</p>
    </div>

    <RouterLink
      :to="linkTo"
      class="text-xs text-accent hover:text-accent-deep transition-colors mt-auto"
    >{{ linkLabel }} →</RouterLink>
  </div>
</template>
