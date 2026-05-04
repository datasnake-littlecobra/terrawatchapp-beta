<script setup lang="ts">
defineProps<{
  severity: 'safe' | 'caution' | 'danger'
  label?: string
}>()

const styles = {
  safe:    'bg-safe/15 text-safe border-safe/40',
  caution: 'bg-caution/15 text-caution border-caution/40',
  danger:  'bg-danger/15 text-danger border-danger/40',
}
const defaults = { safe: 'ADVISORY', caution: 'WARNING', danger: 'EXTREME' }
</script>

<template>
  <span
    class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border"
    :class="styles[severity]"
  >
    {{ label ?? defaults[severity] }}
  </span>
</template>
