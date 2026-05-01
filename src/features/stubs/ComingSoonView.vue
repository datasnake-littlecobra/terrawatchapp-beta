<script setup lang="ts">
defineProps<{
  title:    string
  subtitle: string
  icon:     string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
    <div class="w-16 h-16 rounded-2xl bg-surface-2 border border-white/10 flex items-center justify-center mb-5">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
           stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8 text-ink-muted">
        <!-- waves -->
        <template v-if="icon === 'waves'">
          <path d="M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>
        </template>
        <!-- anchor -->
        <template v-else-if="icon === 'anchor'">
          <circle cx="12" cy="6" r="2"/><path d="M12 8v13M5 12H2a10 10 0 0 0 20 0h-3"/>
        </template>
        <!-- eye -->
        <template v-else-if="icon === 'eye'">
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="2.5"/>
        </template>
        <!-- compass -->
        <template v-else>
          <circle cx="12" cy="12" r="9"/><path d="m15 9-4 2-2 4 4-2 2-4Z"/>
        </template>
      </svg>
    </div>
    <h1 class="text-xl font-semibold text-ink-primary mb-2">{{ title }}</h1>
    <p class="text-ink-muted max-w-xs leading-relaxed">{{ subtitle }}</p>
    <div class="mt-6 px-4 py-2 rounded-full border border-white/10 text-xs text-ink-muted tracking-wider uppercase">
      Coming soon
    </div>
  </div>
</template>
