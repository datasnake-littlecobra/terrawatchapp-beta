<script setup lang="ts">
// TerraWatch — Phase 9.18.0: weather-intelligence variant of the
// "How is this calculated?" panel.
//
// Identical rendering to InsuranceTabStrip's MetricInfoPanel but
// reads from the WI_EXPLAINERS registry. Kept as a thin near-clone
// so /weather-intelligence/glossary doesn't pollute
// /insurance/glossary, and so adding new fields to one side won't
// surprise the other.

import { computed, ref } from 'vue'
import CalibrationBadge from '@/features/insurance/components/CalibrationBadge.vue'
import { WI_EXPLAINERS } from '@/data/weather-intelligence-explainers'

const props = defineProps<{
  id: string
  forceOpen?: boolean
  standalone?: boolean
}>()

const isOpen = ref(false)
const explainer = computed(() => WI_EXPLAINERS[props.id] ?? null)
const shown = computed(() => Boolean(props.forceOpen) || isOpen.value)

function toggle() {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div v-if="explainer" :class="standalone ? '' : 'border-t border-white/5 mt-4 pt-3'">
    <button
      type="button"
      class="w-full flex items-center gap-2 text-xs text-ink-muted hover:text-ink-primary transition-colors group"
      :aria-expanded="shown"
      :aria-controls="`wi-explainer-body-${id}`"
      @click="toggle"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="w-3.5 h-3.5 flex-shrink-0"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      <span class="font-medium">How is this calculated?</span>
      <CalibrationBadge :calibration="explainer.calibration" small />
      <span
        class="ml-auto text-base leading-none w-4 text-center text-ink-muted/60 group-hover:text-ink-primary transition-transform"
        :class="{ 'rotate-180': shown }"
        aria-hidden="true"
      >▾</span>
    </button>

    <div
      v-show="shown"
      :id="`wi-explainer-body-${id}`"
      class="mt-3 space-y-4 text-sm"
    >
      <div>
        <h4 class="text-ink-primary font-semibold leading-snug">{{ explainer.title }}</h4>
        <p class="text-[10px] uppercase tracking-widest text-ink-muted/60 mt-1">
          Source · {{ explainer.sourceLine }}
        </p>
      </div>

      <div v-if="explainer.formulas.length" class="rounded-lg border border-white/5 bg-surface-0/40 p-3">
        <p class="text-[10px] uppercase tracking-widest text-ink-muted/70 mb-2">
          Formula{{ explainer.formulas.length > 1 ? 's' : '' }}
        </p>
        <dl class="space-y-2">
          <div
            v-for="f in explainer.formulas"
            :key="f.label"
            class="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-x-3 gap-y-1"
          >
            <dt class="text-ink-primary text-xs font-semibold">{{ f.label }}</dt>
            <dd>
              <p class="num text-xs text-accent leading-snug break-words">{{ f.expression }}</p>
              <p class="text-ink-muted text-xs leading-snug mt-0.5">{{ f.explanation }}</p>
            </dd>
          </div>
        </dl>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="rounded-lg border border-white/5 bg-surface-0/40 p-3">
          <p class="text-[10px] uppercase tracking-widest text-ink-muted/70 mb-1">Observation</p>
          <p class="text-ink-primary leading-relaxed">{{ explainer.observation }}</p>
        </div>
        <div class="rounded-lg border border-white/5 bg-surface-0/40 p-3">
          <p class="text-[10px] uppercase tracking-widest text-ink-muted/70 mb-1">Risk interpretation</p>
          <p class="text-ink-primary leading-relaxed">{{ explainer.risk_interpretation }}</p>
        </div>
        <div class="rounded-lg border border-white/5 bg-surface-0/40 p-3">
          <p class="text-[10px] uppercase tracking-widest text-ink-muted/70 mb-1">Financial interpretation</p>
          <p class="text-ink-primary leading-relaxed">{{ explainer.financial_interpretation }}</p>
        </div>
        <div class="rounded-lg border border-white/5 bg-surface-0/40 p-3">
          <p class="text-[10px] uppercase tracking-widest text-ink-muted/70 mb-1">Business decision</p>
          <p class="text-ink-primary leading-relaxed">{{ explainer.business_decision }}</p>
        </div>
      </div>

      <div
        v-if="explainer.toy_example || explainer.assumptions?.length || explainer.limitations?.length"
        class="space-y-2"
      >
        <details v-if="explainer.toy_example" class="rounded-lg border border-white/5 bg-surface-0/40">
          <summary class="cursor-pointer px-3 py-2 text-xs text-ink-muted hover:text-ink-primary">
            Worked example
          </summary>
          <p class="px-3 pb-3 text-ink-primary leading-relaxed whitespace-pre-line">{{ explainer.toy_example }}</p>
        </details>
        <details v-if="explainer.assumptions?.length" class="rounded-lg border border-white/5 bg-surface-0/40">
          <summary class="cursor-pointer px-3 py-2 text-xs text-ink-muted hover:text-ink-primary">
            Assumptions baked in
          </summary>
          <ul class="px-3 pb-3 text-ink-primary leading-relaxed space-y-1 list-disc list-inside">
            <li v-for="(a, i) in explainer.assumptions" :key="i">{{ a }}</li>
          </ul>
        </details>
        <details v-if="explainer.limitations?.length" class="rounded-lg border border-white/5 bg-surface-0/40">
          <summary class="cursor-pointer px-3 py-2 text-xs text-ink-muted hover:text-ink-primary">
            What this doesn't capture
          </summary>
          <ul class="px-3 pb-3 text-ink-primary leading-relaxed space-y-1 list-disc list-inside">
            <li v-for="(l, i) in explainer.limitations" :key="i">{{ l }}</li>
          </ul>
        </details>
      </div>
    </div>
  </div>
</template>
