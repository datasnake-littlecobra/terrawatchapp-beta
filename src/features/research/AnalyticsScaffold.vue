<script setup lang="ts">
// TerraWatch — Phase 9.11: shared scaffolding for the research dashboards.
// Provides the page header, hero counter row, content slot, and a
// provenance footer band. Each domain dashboard fills the slot with its
// own charts + GapCallout.

defineProps<{
  domain:    'atmosphere' | 'ocean' | 'seismic'
  title:     string
  subtitle:  string
  // Hero counters: 3-4 tiles at the top. Same shape as ocean dashboard.
  counters:  Array<{ label: string; value: string; unit?: string; tone?: 'safe' | 'caution' | 'danger' }>
  // Live-data sources to credit in the footer.
  sources:   string[]
}>()
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
    <!-- Header -->
    <header class="flex items-start justify-between gap-3 mb-5">
      <div>
        <p class="text-ink-muted text-xs tracking-widest uppercase">
          Research · {{ domain }}
        </p>
        <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">{{ title }}</h1>
        <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-2xl">{{ subtitle }}</p>
      </div>
      <span
        class="hidden sm:inline-block text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded border border-accent/40 text-accent bg-accent/10 self-start mt-2"
      >Live</span>
    </header>

    <!-- Hero counters -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
      <div
        v-for="(c, i) in counters"
        :key="i"
        class="rounded-2xl border border-white/5 bg-surface-1 p-3 sm:p-4"
      >
        <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">{{ c.label }}</p>
        <p
          class="text-xl sm:text-2xl font-semibold num mt-1"
          :class="{
            'text-safe':    c.tone === 'safe',
            'text-caution': c.tone === 'caution',
            'text-danger':  c.tone === 'danger',
            'text-ink-primary': !c.tone,
          }"
        >
          {{ c.value }}<span v-if="c.unit" class="text-ink-muted text-xs ml-1">{{ c.unit }}</span>
        </p>
      </div>
    </div>

    <!-- Per-dashboard content -->
    <div class="space-y-5">
      <slot />
    </div>

    <!-- Provenance footer -->
    <footer class="mt-10 pt-5 border-t border-white/5">
      <p class="text-[10px] uppercase tracking-widest text-ink-muted/60 mb-1.5">
        Powered by
      </p>
      <p class="text-ink-muted text-sm">
        {{ sources.join(' · ') }}
      </p>
      <p class="text-ink-muted/60 text-xs mt-3 leading-relaxed">
        Data refreshes hourly from the sources above. Aggregates are computed in Postgres at
        query time — no caches between you and the truth. The proprietary DataSnake fleet
        layer (oxygen, currents, ground motion, portable AQ) extends each panel below; this
        view shows the public-data baseline.
      </p>
    </footer>
  </div>
</template>
