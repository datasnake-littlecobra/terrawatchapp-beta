<script setup lang="ts">
// TerraWatch — Phase 9.8: per-category icon for blog post categories.
// Lightweight inline SVGs (matching the SidebarNav.vue style) so no
// external icon dep is needed for this surface.

defineProps<{
  category: string
  size?:    number
}>()
</script>

<template>
  <span
    class="inline-flex items-center justify-center text-accent"
    :style="{ width: `${size ?? 16}px`, height: `${size ?? 16}px` }"
    :aria-label="category"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round" class="w-full h-full" aria-hidden="true">
      <!-- vision: telescope -->
      <template v-if="category === 'vision'">
        <path d="m3 21 4-4M7 17l4-4M11 13l4-4M15 9l3-3"/>
        <path d="M16 4h4v4M14 6l4 4-3 3-4-4Z"/>
      </template>
      <!-- engineering: gear -->
      <template v-else-if="category === 'engineering'">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19 12a7 7 0 0 0-.1-1.3l1.5-1.2-1.5-2.6-1.8.6a7 7 0 0 0-2.2-1.3l-.3-1.9h-3l-.3 1.9a7 7 0 0 0-2.2 1.3l-1.8-.6L5.6 9.5l1.5 1.2a7 7 0 0 0 0 2.6L5.6 14.5l1.5 2.6 1.8-.6a7 7 0 0 0 2.2 1.3l.3 1.9h3l.3-1.9a7 7 0 0 0 2.2-1.3l1.8.6 1.5-2.6-1.5-1.2c.07-.43.1-.86.1-1.3Z"/>
      </template>
      <!-- release-notes: tag -->
      <template v-else-if="category === 'release-notes'">
        <path d="M20.5 12.5 12 21l-9-9V3h9l8.5 8.5a1 1 0 0 1 0 1Z"/>
        <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/>
      </template>
      <!-- event-alert: bell -->
      <template v-else-if="category === 'event-alert'">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
      </template>
      <!-- tech-blog: code -->
      <template v-else-if="category === 'tech-blog'">
        <polyline points="16 18 22 12 16 6"/>
        <polyline points="8 6 2 12 8 18"/>
      </template>
      <!-- guide: book -->
      <template v-else-if="category === 'guide'">
        <path d="M4 4a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1 0-4h13"/>
      </template>
      <!-- product: layers -->
      <template v-else-if="category === 'product'">
        <polygon points="12 2 22 7 12 12 2 7 12 2"/>
        <polyline points="2 17 12 22 22 17"/>
        <polyline points="2 12 12 17 22 12"/>
      </template>
      <!-- general / fallback: pen -->
      <template v-else>
        <path d="M12 19h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/>
      </template>
    </svg>
  </span>
</template>
