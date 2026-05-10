<script setup lang="ts">
// TerraWatch — Phase 9.12.2: per-metric calibration pill.
//
// Three states:
//   - LIVE       (green): data flows from a live Supabase query against
//                public.fema_nri or public.events.
//   - CALIBRATED (amber): mock data calibrated against published
//                benchmarks (FEMA NRI v3, RMS 2018, AIR-Verisk
//                Touchstone Re v9, CRESTA AAL Working Group 2021,
//                NOAA SLR, NHC climatology, USGS UCERF3).
//   - DERIVED    (blue):  computed from other dashboard inputs
//                (e.g. underpricing gap is computed from calibrated
//                policies — its calibration inherits from its inputs
//                but it's not itself a measurement).

import type { Calibration } from '@/types/explainer'

defineProps<{
  calibration: Calibration
  small?: boolean
}>()

const LABELS: Record<Calibration, string> = {
  live:       'LIVE',
  calibrated: 'CALIBRATED',
  derived:    'DERIVED',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1 font-semibold uppercase tracking-widest rounded border"
    :class="[
      small ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1',
      {
        'border-safe/40    text-safe    bg-safe/[0.08]':    calibration === 'live',
        'border-caution/40 text-caution bg-caution/[0.08]': calibration === 'calibrated',
        'border-accent/40  text-accent  bg-accent/[0.08]':  calibration === 'derived',
      },
    ]"
    :aria-label="`Calibration: ${calibration}`"
  >
    <span
      class="inline-block rounded-full"
      :class="[
        small ? 'w-1 h-1' : 'w-1.5 h-1.5',
        {
          'bg-safe':    calibration === 'live',
          'bg-caution': calibration === 'calibrated',
          'bg-accent':  calibration === 'derived',
        },
      ]"
      aria-hidden="true"
    />
    {{ LABELS[calibration] }}
  </span>
</template>
