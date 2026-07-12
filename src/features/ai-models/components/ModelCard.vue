<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { ModelRegistryEntry } from '@/types/aiModels'

const props = defineProps<{
  model: ModelRegistryEntry
  to?: string
}>()

const tierLabel = { 1: 'T1', 2: 'T2', 3: 'T3' } as const
const tierClass = {
  1: 'border-accent/40 text-accent bg-accent/10',
  2: 'border-safe/40 text-safe bg-safe/[0.08]',
  3: 'border-white/20 text-ink-muted bg-white/5',
} as const

const statusLabel = {
  demo:     'DEMO',
  training: 'TRAINING',
  live:     'LIVE',
  planned:  'PLANNED',
} as const
const statusClass = {
  demo:     'border-caution/40 text-caution bg-caution/[0.08]',
  training: 'border-accent/40 text-accent bg-accent/[0.08]',
  live:     'border-safe/40 text-safe bg-safe/[0.08]',
  planned:  'border-white/10 text-ink-muted bg-white/5',
} as const
</script>

<template>
  <component
    :is="to ? RouterLink : 'div'"
    :to="to"
    class="flex flex-col rounded-2xl border border-white/5 bg-surface-1 p-5 transition-colors"
    :class="to ? 'hover:border-accent/30 group cursor-pointer' : 'cursor-default'"
  >
    <!-- Top row: tier badge + score + status -->
    <div class="flex items-center gap-2 mb-3">
      <span
        class="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border"
        :class="tierClass[model.tier]"
      >{{ tierLabel[model.tier] }}</span>
      <span class="text-xs text-ink-muted num">{{ model.score }}<span class="text-[10px] text-ink-muted/50">/20</span></span>
      <span class="ml-auto text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border"
            :class="statusClass[model.status]">
        {{ statusLabel[model.status] }}
      </span>
    </div>

    <!-- Name -->
    <h3
      class="text-sm font-semibold text-ink-primary leading-snug"
      :class="to ? 'group-hover:text-accent transition-colors' : ''"
    >{{ model.name }}</h3>

    <!-- Description -->
    <p v-if="model.description" class="text-xs text-ink-muted mt-1.5 leading-relaxed line-clamp-2">
      {{ model.description }}
    </p>

    <!-- Dataset + accuracy -->
    <div class="mt-auto pt-3 border-t border-white/5 mt-3 grid grid-cols-2 gap-2">
      <div>
        <p class="text-[9px] uppercase tracking-wider text-ink-muted/60 mb-0.5">Dataset</p>
        <p class="text-xs text-ink-muted truncate">{{ model.datasetName ?? '—' }}</p>
      </div>
      <div class="text-right">
        <p class="text-[9px] uppercase tracking-wider text-ink-muted/60 mb-0.5">Accuracy</p>
        <span
          v-if="model.accuracyPct != null"
          class="text-xs font-semibold text-safe num"
        >{{ model.accuracyPct.toFixed(1) }}%</span>
        <span v-else class="text-xs text-ink-muted/50">—</span>
      </div>
    </div>

    <!-- Architecture pill -->
    <p v-if="model.architecture" class="mt-2 text-[10px] text-ink-muted/50">
      {{ model.architecture }}
    </p>
  </component>
</template>
