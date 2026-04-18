<script setup lang="ts">
defineProps<{ tone: 'safe' | 'caution' | 'danger' | 'info'; label: string }>()
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
    :class="{
      'border-safe/40 text-safe bg-safe/10': tone === 'safe',
      'border-caution/40 text-caution bg-caution/10': tone === 'caution',
      'border-danger/40 text-danger bg-danger/10': tone === 'danger',
      'border-accent/40 text-accent bg-accent/10': tone === 'info',
    }"
  >
    <span class="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
    {{ label }}
  </span>
</template>
