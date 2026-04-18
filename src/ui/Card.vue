<script setup lang="ts">
defineProps<{ elevated?: boolean; padded?: boolean }>()
</script>

<template>
  <div :class="[elevated ? 'card-elevated' : 'card', padded === false ? '' : 'p-5']">
    <slot />
  </div>
</template>
