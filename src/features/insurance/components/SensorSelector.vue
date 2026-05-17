<script setup lang="ts">
// TerraWatch — Phase 9.13.2: grouped sensor picker for /insurance/pipeline.
//
// Two source bands (ocean / ground). Each sensor card shows name, ID,
// variant, location coords, firmware, and deployed date so the demo
// reads as "these are actual proprietary deployments" (they're not yet,
// but the schema and the UI are honest about the architecture).

import type { PipelineSensor } from '@/services/sensorPipeline'

const props = defineProps<{
  sensors:  PipelineSensor[]
  selected: string
}>()

const emit = defineEmits<{ (e: 'select', sensorId: string): void }>()

function group(domain: 'ocean' | 'land'): PipelineSensor[] {
  return props.sensors.filter((s) => s.domain === domain)
}

function fmtDate(s: string): string {
  if (!s) return '—'
  return s.slice(0, 10)
}
</script>

<template>
  <div class="space-y-3">
    <div>
      <p class="text-[10px] uppercase tracking-widest text-ink-muted/60 mb-2">
        Ocean sensors
        <span class="num text-ink-muted/40">({{ group('ocean').length }})</span>
      </p>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <button
          v-for="s in group('ocean')"
          :key="s.id"
          type="button"
          class="text-left p-2.5 rounded-lg border transition-colors"
          :class="selected === s.id
            ? 'border-accent bg-accent/[0.08]'
            : 'border-white/5 bg-surface-1 hover:border-white/10'"
          @click="emit('select', s.id)"
        >
          <p class="text-xs font-semibold text-ink-primary truncate">{{ s.name }}</p>
          <p class="text-[10px] text-ink-muted font-mono truncate">{{ s.id }}</p>
          <p class="text-[10px] text-ink-muted/70 mt-1">{{ s.firmware }} · {{ fmtDate(s.deployedAt) }}</p>
        </button>
      </div>
    </div>

    <div>
      <p class="text-[10px] uppercase tracking-widest text-ink-muted/60 mb-2">
        Ground sensors
        <span class="num text-ink-muted/40">({{ group('land').length }})</span>
      </p>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <button
          v-for="s in group('land')"
          :key="s.id"
          type="button"
          class="text-left p-2.5 rounded-lg border transition-colors"
          :class="selected === s.id
            ? 'border-accent bg-accent/[0.08]'
            : 'border-white/5 bg-surface-1 hover:border-white/10'"
          @click="emit('select', s.id)"
        >
          <p class="text-xs font-semibold text-ink-primary truncate">{{ s.name }}</p>
          <p class="text-[10px] text-ink-muted font-mono truncate">{{ s.id }}</p>
          <p class="text-[10px] text-ink-muted/70 mt-1">{{ s.firmware }} · {{ fmtDate(s.deployedAt) }}</p>
        </button>
      </div>
    </div>
  </div>
</template>
