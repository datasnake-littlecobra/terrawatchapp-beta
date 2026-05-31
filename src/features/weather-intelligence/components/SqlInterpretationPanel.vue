<script setup lang="ts">
// TerraWatch — Phase 9.18.0: SQL interpretation panel.
//
// New shared primitive (one of the two differentiators of the
// /weather-intelligence section vs the existing /insurance section
// and vs First Street / Zesty AI). Sits below every chart on every
// weather-intelligence page.
//
// Behavior:
//   - Collapsible (default closed) — same UX rhythm as MetricInfoPanel.
//   - Title: "View SQL" + a colored "REPRODUCIBLE" pill.
//   - When opened, renders the actual SQL query that produced the
//     data above, with parameter values interpolated inline so the
//     reader sees the LITERAL query that ran (not a template).
//   - "Copy" button puts the interpolated query in the clipboard.
//   - Optional "source" line under the query: where the data lives
//     (table, view, RPC), retention, refresh cadence.
//
// This is the visible answer to "how is DataSnake different from
// First Street + Zesty AI?" — those vendors ship a score. This
// component ships the score AND the query that produced it. Buyers
// in technical due-diligence trust auditable math.

import { computed, ref } from 'vue'

const props = defineProps<{
  // The raw SQL string with $1, $2... placeholders OR {{name}} placeholders.
  query: string
  // Either ordered array (for $1...$n) or object map (for {{name}}).
  params?: Array<string | number | null> | Record<string, string | number | null>
  // One-line description of where the data comes from.
  source?: string
  // Optional caption above the query (e.g. "This is what populates the chart above.").
  caption?: string
}>()

const isOpen = ref(false)
const justCopied = ref(false)

// Interpolate the parameters into the SQL string so the user sees
// the literal executed query. Both $1-style and {{name}}-style
// placeholders are supported. String values get quoted; numbers
// don't.
const interpolatedQuery = computed(() => {
  let out = props.query.trim()
  if (Array.isArray(props.params)) {
    props.params.forEach((v, i) => {
      const placeholder = `$${i + 1}`
      out = out.split(placeholder).join(renderValue(v))
    })
  } else if (props.params && typeof props.params === 'object') {
    for (const [name, v] of Object.entries(props.params)) {
      out = out.split(`{{${name}}}`).join(renderValue(v))
    }
  }
  return out
})

function renderValue(v: string | number | null): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number')          return String(v)
  // Strings — quote and escape.
  return `'${String(v).replace(/'/g, "''")}'`
}

function copyQuery() {
  void navigator.clipboard?.writeText(interpolatedQuery.value)
  justCopied.value = true
  setTimeout(() => { justCopied.value = false }, 2000)
}
</script>

<template>
  <div class="border-t border-white/5 mt-4 pt-3">
    <button
      type="button"
      class="w-full flex items-center gap-2 text-xs text-ink-muted hover:text-ink-primary transition-colors group"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="w-3.5 h-3.5 flex-shrink-0"
        aria-hidden="true"
      >
        <path d="M3 12a3 3 0 0 0 0-6h12a3 3 0 0 1 0 6h-3"/>
        <path d="M21 12a3 3 0 0 0 0 6H9a3 3 0 0 1 0-6h3"/>
      </svg>
      <span class="font-medium">View the SQL behind this chart</span>
      <span class="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border border-safe/40 text-safe bg-safe/[0.08] font-semibold uppercase tracking-widest">
        <span class="inline-block w-1 h-1 rounded-full bg-safe" aria-hidden="true" />
        reproducible
      </span>
      <span
        class="ml-auto text-base leading-none w-4 text-center text-ink-muted/60 group-hover:text-ink-primary transition-transform"
        :class="{ 'rotate-180': isOpen }"
        aria-hidden="true"
      >▾</span>
    </button>

    <div v-show="isOpen" class="mt-3 space-y-2">
      <p v-if="caption" class="text-xs text-ink-muted leading-relaxed">{{ caption }}</p>

      <div class="relative rounded-lg border border-white/5 bg-surface-0/60 overflow-hidden">
        <pre class="px-3 py-3 pr-16 text-[11px] sm:text-xs font-mono text-ink-primary leading-relaxed overflow-x-auto whitespace-pre">{{ interpolatedQuery }}</pre>
        <button
          type="button"
          class="absolute top-2 right-2 text-[10px] uppercase tracking-widest text-ink-muted/70 hover:text-accent transition-colors px-2 py-1 rounded border border-white/10 bg-surface-0/80"
          @click="copyQuery"
        >
          <span v-if="justCopied">✓ copied</span>
          <span v-else>copy</span>
        </button>
      </div>

      <p v-if="source" class="text-[10px] uppercase tracking-widest text-ink-muted/60">
        Source · {{ source }}
      </p>

      <p class="text-[10px] text-ink-muted/60 leading-relaxed">
        This is the literal query that produced the chart above —
        parameters are interpolated, nothing is hidden. Paste it into
        any Postgres client connected to a Supabase instance with the
        same schema to reproduce the result.
      </p>
    </div>
  </div>
</template>
