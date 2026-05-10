<script setup lang="ts">
// TerraWatch — Phase 9.11: shared "DataSnake fleet would close this gap"
// callout. Designed to be the credibility anchor on each research dashboard:
// honestly states what public-data baseline can and can't see, and what
// the proprietary fleet would resolve. Investor-friendly but not hypey.

defineProps<{
  domain:    'atmosphere' | 'ocean' | 'seismic' | 'insurance'
  headline:  string
  body:      string
  // Stat row: one or more (label, value, unit?) tuples. Renders as a
  // compact row across the top of the panel. Optional.
  stats?:    Array<{ label: string; value: string; unit?: string }>
  // Optional bullet list of concrete gap targets for the fleet.
  bullets?:  string[]
}>()
</script>

<template>
  <section
    class="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/5 via-transparent to-accent/[0.02] p-5 sm:p-6 mt-6"
    :aria-label="`DataSnake fleet gap callout — ${domain}`"
  >
    <div class="flex items-start gap-3">
      <!-- Snake / fleet glyph -->
      <div class="shrink-0 w-9 h-9 rounded-lg border border-accent/40 bg-accent/10
                  text-accent flex items-center justify-center mt-0.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
             stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5" aria-hidden="true">
          <template v-if="domain === 'atmosphere'">
            <path d="M3 12c0-3 2-5 5-5h2M21 12c0 3-2 5-5 5h-2"/>
            <path d="M8 12h8M12 8v8"/>
          </template>
          <template v-else-if="domain === 'ocean'">
            <path d="M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>
          </template>
          <template v-else-if="domain === 'insurance'">
            <!-- Shield + dollar glyph for insurance/underwriting framing -->
            <path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6Z"/>
            <path d="M12 8v8M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>
          </template>
          <template v-else>
            <path d="M3 12h4l2-7 4 14 2-7h6"/>
          </template>
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-[10px] font-semibold tracking-widest uppercase text-accent/80">
          DataSnake fleet — coverage gap
        </p>
        <h3 class="text-base sm:text-lg font-semibold text-ink-primary mt-1">{{ headline }}</h3>
        <p class="text-ink-muted text-sm leading-relaxed mt-2">{{ body }}</p>

        <div v-if="stats && stats.length" class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          <div
            v-for="(s, i) in stats"
            :key="i"
            class="rounded-lg border border-white/5 bg-surface-0/60 p-3"
          >
            <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">{{ s.label }}</p>
            <p class="text-lg font-semibold text-ink-primary num mt-0.5">
              {{ s.value }}<span v-if="s.unit" class="text-ink-muted text-xs ml-1">{{ s.unit }}</span>
            </p>
          </div>
        </div>

        <ul v-if="bullets && bullets.length" class="text-sm text-ink-muted mt-4 space-y-1.5">
          <li v-for="(b, i) in bullets" :key="i" class="flex gap-2">
            <span class="text-accent mt-0.5">→</span>
            <span>{{ b }}</span>
          </li>
        </ul>

        <p class="text-[10px] uppercase tracking-widest text-ink-muted/50 mt-4">
          Public-data baseline shown above · Proprietary tier in development
        </p>
      </div>
    </div>
  </section>
</template>
