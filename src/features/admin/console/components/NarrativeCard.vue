<script setup lang="ts">
// TerraWatch — Phase 9.16: narrative header card for the Ops Console.
//
// One per tab. Top-of-page "what this is, why it matters, what it
// does for insurance" block so a newbie can walk through the
// console and understand the data → climate signal → insurance
// decision pipeline without reading the docs.

defineProps<{
  eyebrow: string                       // 'Ops Console · Devices'
  title:   string                       // 'Sensor fleet status'
  body:    string                       // 1-3 sentences
  links?:  Array<{ to: string; label: string }>
}>()
</script>

<template>
  <section class="rounded-2xl border border-white/5 bg-surface-1 p-4 sm:p-5">
    <p class="text-ink-muted text-[10px] uppercase tracking-widest">{{ eyebrow }}</p>
    <h2 class="text-lg sm:text-xl font-semibold text-ink-primary mt-1">{{ title }}</h2>
    <p class="text-ink-muted text-sm leading-relaxed mt-2 max-w-3xl">{{ body }}</p>
    <div v-if="links && links.length" class="flex flex-wrap gap-x-4 gap-y-1 mt-3">
      <router-link
        v-for="l in links"
        :key="l.to"
        :to="l.to"
        class="text-xs text-accent hover:text-accent-deep transition-colors"
      >{{ l.label }} →</router-link>
    </div>
  </section>
</template>
