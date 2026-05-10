<script setup lang="ts">
// Honest "this is what DataSnake's full sensor fleet would deliver"
// preview badge. Used on every module that renders mock data so we
// never mislead an investor / partner / reader into thinking the
// numbers are live.

defineProps<{
  // Optional shorter label for tight headers
  short?: boolean
}>()
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded border border-[#00E5C5]/30 text-[#00E5C5] bg-[#00E5C5]/[0.06]"
    role="note"
    aria-label="Demo data — DataSnake fleet preview"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         class="w-3 h-3" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
    <template v-if="short">DEMO</template>
    <template v-else>DataSnake fleet preview · demo data</template>
  </span>
</template>
