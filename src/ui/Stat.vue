<script setup lang="ts">
defineProps<{ label: string; value: string; hint?: string }>()
</script>

<template>
  <div class="flex flex-col">
    <span class="text-ink-muted text-xs uppercase tracking-widest">{{ label }}</span>
    <span class="num text-2xl text-ink-primary mt-1">{{ value }}</span>
    <span v-if="hint" class="text-ink-muted text-xs mt-0.5">{{ hint }}</span>
  </div>
</template>
