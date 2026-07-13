<script setup lang="ts">
defineProps<{
  step: number
  title: string
  last?: boolean
}>()
</script>

<template>
  <div class="flex gap-5">
    <div class="flex flex-col items-center flex-none w-8">
      <div class="w-8 h-8 rounded-full bg-accent/[0.12] border border-accent/30 flex items-center justify-center flex-none">
        <span class="text-xs font-semibold text-accent">{{ step }}</span>
      </div>
      <div v-if="!last" class="w-px flex-1 bg-white/5 mt-2 min-h-[2rem]" />
    </div>
    <div class="flex-1 pb-10">
      <p class="text-[10px] uppercase tracking-widest text-ink-muted/50 mb-0.5">Step {{ step }}</p>
      <h3 class="text-sm font-semibold text-ink-primary mb-3">{{ title }}</h3>
      <slot />
    </div>
  </div>
</template>
