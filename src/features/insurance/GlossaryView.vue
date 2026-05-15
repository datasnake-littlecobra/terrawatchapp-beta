<script setup lang="ts">
// TerraWatch — Phase 9.12.2: /insurance/glossary
//
// Reference page rendering every MetricInfoPanel force-opened, grouped
// by tab. Used pre-demo: read once, then walk into the partner meeting
// knowing every formula and source. Also serves as a single-URL
// reference link to share with reviewers ("here's exactly how the
// dashboard computes each number").

import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import InsuranceTabStrip from './components/InsuranceTabStrip.vue'
import MetricInfoPanel from './components/MetricInfoPanel.vue'
import Card from '@/ui/Card.vue'
import { useMeta } from '@/composables/useMeta'
import { EXPLAINERS } from '@/data/insurance-explainers'
import { TAB_ORDER, TAB_LABELS, TAB_ROUTES, type InsuranceTab, type MetricExplainer } from '@/types/explainer'

useMeta(() => ({
  title:       'Glossary — Insurance Intelligence',
  description: 'Every metric, formula, and data source behind the TerraWatch insurance dashboard — one page, fully expanded, calibration-tagged.',
}))

const query = ref('')

const grouped = computed(() => {
  const norm = query.value.trim().toLowerCase()
  const result: Record<InsuranceTab, MetricExplainer[]> = {
    'overview': [], 'verdict': [], 'map': [], 'ep-curves': [],
    'parametric': [], 'portfolio': [], 'claims': [],
    'api': [], 'admin': [],
  }
  for (const e of Object.values(EXPLAINERS)) {
    if (norm) {
      const haystack = `${e.title} ${e.id} ${e.sourceLine} ${e.observation}`.toLowerCase()
      if (!haystack.includes(norm)) continue
    }
    result[e.tab].push(e)
  }
  return result
})

const totalMatches = computed(() =>
  Object.values(grouped.value).reduce((acc, arr) => acc + arr.length, 0),
)

const totalEntries = computed(() => Object.keys(EXPLAINERS).length)
</script>

<template>
  <div>
    <InsuranceTabStrip />

    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <header>
        <p class="text-ink-muted text-xs tracking-widest uppercase">Insurance · Reference</p>
        <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
          Glossary — every metric, formula, and source
        </h1>
        <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-3xl">
          One page. Every "How is this calculated?" panel from the
          dashboard, fully expanded, grouped by tab. Use this as a
          pre-demo cheat sheet, an audit reference, or a shareable
          link for reviewers asking how the numbers come together.
        </p>
      </header>

      <!-- Sticky search bar -->
      <div class="sticky top-12 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-surface-0/90 backdrop-blur border-b border-white/5">
        <div class="flex items-center gap-3">
          <div class="relative flex-1">
            <input
              v-model="query"
              type="text"
              placeholder="Search metrics by name, source, or description…"
              class="w-full rounded-xl border border-white/10 bg-surface-1 pl-10 pr-4 py-2.5 text-ink-primary placeholder:text-ink-muted/60 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/40 text-sm"
              aria-label="Search glossary entries"
            />
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-3.5-3.5" />
            </svg>
          </div>
          <p class="text-xs text-ink-muted whitespace-nowrap">
            <span class="num text-ink-primary">{{ totalMatches }}</span>
            of <span class="num text-ink-primary">{{ totalEntries }}</span>
          </p>
        </div>

        <!-- Tab anchor jump links -->
        <nav class="mt-2 -mx-1 px-1 overflow-x-auto scrollbar-thin">
          <ul class="flex items-center gap-1 text-xs whitespace-nowrap">
            <li v-for="tab in TAB_ORDER" :key="tab">
              <a
                :href="`#section-${tab}`"
                class="inline-flex items-center px-2.5 py-1 rounded-md border border-white/5 text-ink-muted hover:text-ink-primary hover:border-white/15 transition-colors"
              >
                {{ TAB_LABELS[tab] }}
                <span class="num ml-1.5 text-ink-muted/60">({{ grouped[tab].length }})</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <!-- Sections -->
      <section
        v-for="tab in TAB_ORDER"
        :key="tab"
        :id="`section-${tab}`"
        class="scroll-mt-32"
      >
        <header class="flex items-end justify-between gap-3 mb-3">
          <h2 class="text-xl font-semibold text-ink-primary">
            {{ TAB_LABELS[tab] }}
            <span class="num text-ink-muted text-base font-normal ml-2">
              ({{ grouped[tab].length }})
            </span>
          </h2>
          <RouterLink
            :to="TAB_ROUTES[tab]"
            class="text-xs text-accent hover:text-accent-deep transition-colors"
          >← Back to live dashboard</RouterLink>
        </header>

        <p v-if="!grouped[tab].length" class="text-ink-muted text-sm italic">
          No entries match the current filter.
        </p>

        <div v-else class="space-y-3">
          <Card v-for="entry in grouped[tab]" :key="entry.id" padded>
            <MetricInfoPanel :id="entry.id" force-open />
          </Card>
        </div>
      </section>

      <p class="text-ink-muted/60 text-xs pt-6 border-t border-white/5">
        Calibration labels: <strong class="text-safe">LIVE</strong> data flows from
        a live query against <code class="text-accent">public.fema_nri</code> or
        <code class="text-accent">public.events</code>. <strong class="text-caution">CALIBRATED</strong>
        is mock data benchmarked against published industry references
        (FEMA NRI v3, RMS 2018, AIR-Verisk Touchstone Re v9, CRESTA AAL
        2021, Lloyd's 2023 RDS). <strong class="text-accent">DERIVED</strong> is
        computed from other dashboard inputs.
      </p>
    </div>
  </div>
</template>
