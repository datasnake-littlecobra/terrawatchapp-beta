<script setup lang="ts">
import type { SourceTier } from '@/types/measurement'

// Phase 9.6 — three-state segmented control: Public | DataSnake | All.
// `proprietaryAvailable=false` greys out the DataSnake state until that
// feed exists. The toggle is the architectural hook the audience-framing
// section calls out: marketing-as-product. Users see the architecture is
// ready for DataSnake's submarine telemetry before the data lands.

defineProps<{
  modelValue: 'all' | SourceTier
  proprietaryAvailable?: boolean
}>()

defineEmits<{ 'update:modelValue': ['all' | SourceTier] }>()
</script>

<template>
  <div class="inline-flex p-0.5 rounded-lg border border-white/10 bg-surface-1">
    <button
      class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5"
      :class="modelValue === 'public'
        ? 'bg-accent/20 text-accent'
        : 'text-ink-muted hover:text-ink-primary'"
      @click="$emit('update:modelValue', 'public')"
    >
      <span class="w-1.5 h-1.5 rounded-full bg-accent"></span>
      Public
    </button>

    <button
      class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5"
      :class="!proprietaryAvailable
        ? 'text-ink-muted/40 cursor-not-allowed'
        : modelValue === 'proprietary'
          ? 'bg-safe/20 text-safe'
          : 'text-ink-muted hover:text-ink-primary'"
      :disabled="!proprietaryAvailable"
      :title="proprietaryAvailable ? '' : 'DataSnake proprietary submarine fleet — coming soon'"
      @click="proprietaryAvailable && $emit('update:modelValue', 'proprietary')"
    >
      <span class="w-1.5 h-1.5 rounded-full" :class="proprietaryAvailable ? 'bg-safe' : 'bg-ink-muted/40'"></span>
      DataSnake
      <span v-if="!proprietaryAvailable" class="text-[9px] uppercase tracking-wider text-ink-muted/50 font-medium border border-white/10 rounded px-1 py-px">soon</span>
    </button>

    <button
      class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
      :class="modelValue === 'all'
        ? 'bg-white/10 text-ink-primary'
        : 'text-ink-muted hover:text-ink-primary'"
      @click="$emit('update:modelValue', 'all')"
    >
      All
    </button>
  </div>
</template>
