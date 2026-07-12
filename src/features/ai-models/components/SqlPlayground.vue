<script setup lang="ts">
// TerraWatch — Phase 10.1: In-page SQL playground for /ai-models/* pages.
//
// Lets users write and run SELECT queries against model_inference_log and
// model_registry directly in the browser. Uses the safe_select() RPC which
// validates the query is read-only before executing. Pre-loads model-specific
// example queries that users can one-click load and run.

import { ref } from 'vue'
import { supabase } from '@/services/supabase'

const props = defineProps<{
  modelSlug: string
  examples: Array<{ label: string; sql: string }>
}>()

type Row = Record<string, unknown>

const sql          = ref(props.examples[0]?.sql ?? '')
const rows         = ref<Row[]>([])
const cols         = ref<string[]>([])
const running      = ref(false)
const errorMsg     = ref<string | null>(null)
const runCount     = ref(0)
const duration     = ref<number | null>(null)

async function runQuery() {
  if (!supabase) {
    errorMsg.value = 'Supabase not configured.'
    return
  }
  if (!sql.value.trim()) return

  running.value = true
  errorMsg.value = null
  rows.value = []
  cols.value = []
  const t0 = performance.now()

  try {
    const { data, error } = await (supabase as any).rpc('safe_select', {
      p_sql: sql.value.trim(),
    })

    if (error) throw new Error(error.message)

    const result = (data ?? []) as Row[]
    rows.value = result
    const firstRow = result[0]
    cols.value = firstRow ? Object.keys(firstRow) : []
    runCount.value++
    duration.value = Math.round(performance.now() - t0)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Query failed.'
  } finally {
    running.value = false
  }
}

function loadExample(ex: { label: string; sql: string }) {
  sql.value = ex.sql
}

function fmtValue(val: unknown): string {
  if (val == null) return '—'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}
</script>

<template>
  <div class="rounded-2xl border border-white/5 bg-surface-1 overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-white/5">
      <div class="flex items-center gap-2">
        <span class="text-[10px] uppercase tracking-widest text-ink-muted/60">SQL Playground</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-ink-muted/50">
          SELECT only
        </span>
      </div>
      <span v-if="duration != null && runCount > 0" class="text-[10px] text-ink-muted/50 num">
        {{ rows.length }} rows · {{ duration }}ms
      </span>
    </div>

    <!-- Example query chips -->
    <div class="flex gap-1.5 flex-wrap px-4 pt-3 pb-2">
      <button
        v-for="ex in examples"
        :key="ex.label"
        class="text-[10px] px-2 py-1 rounded border border-white/10 text-ink-muted hover:border-accent/40 hover:text-accent transition-colors"
        @click="loadExample(ex)"
      >
        {{ ex.label }}
      </button>
    </div>

    <!-- SQL editor textarea -->
    <div class="relative px-4 pb-3">
      <textarea
        v-model="sql"
        rows="6"
        spellcheck="false"
        class="w-full rounded-lg border border-white/10 bg-surface-0/60 px-3 py-2.5 text-xs font-mono text-ink-primary leading-relaxed resize-y focus:outline-none focus:border-accent/40 transition-colors"
        placeholder="select * from public.model_inference_log where model_slug = 'pipeline-detection' limit 10;"
        @keydown.ctrl.enter.prevent="runQuery"
        @keydown.meta.enter.prevent="runQuery"
      />
      <p class="text-[9px] text-ink-muted/40 mt-1">Ctrl+Enter / ⌘+Enter to run</p>
    </div>

    <!-- Run button -->
    <div class="px-4 pb-4">
      <button
        class="flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg border border-accent/40 text-accent bg-accent/[0.08] hover:bg-accent/[0.14] transition-colors disabled:opacity-40"
        :disabled="running || !sql.trim()"
        @click="runQuery"
      >
        <svg v-if="running" class="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" class="w-3 h-3">
          <polygon points="5,3 19,12 5,21 5,3"/>
        </svg>
        {{ running ? 'Running…' : 'Run query' }}
      </button>
    </div>

    <!-- Error -->
    <div v-if="errorMsg" class="mx-4 mb-4 rounded-lg border border-danger/30 bg-danger/[0.06] px-3 py-2 text-xs text-danger">
      {{ errorMsg }}
    </div>

    <!-- Results table -->
    <div v-if="rows.length" class="border-t border-white/5">
      <div class="px-4 py-2 flex items-center justify-between">
        <p class="text-[10px] uppercase tracking-wider text-ink-muted/60">
          Results — {{ rows.length }} row{{ rows.length !== 1 ? 's' : '' }}
        </p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-xs min-w-max">
          <thead>
            <tr class="border-b border-white/5">
              <th
                v-for="col in cols"
                :key="col"
                class="text-left px-4 py-2 text-[10px] uppercase tracking-wider text-ink-muted/60 whitespace-nowrap font-medium"
              >{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in rows"
              :key="i"
              class="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
            >
              <td
                v-for="col in cols"
                :key="col"
                class="px-4 py-2 text-ink-muted/80 whitespace-nowrap max-w-[260px] truncate"
              >{{ fmtValue(row[col]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Empty state after run -->
    <div v-else-if="runCount > 0 && !errorMsg" class="px-4 pb-4 text-xs text-ink-muted/50 text-center py-6">
      Query returned 0 rows.
    </div>
  </div>
</template>
