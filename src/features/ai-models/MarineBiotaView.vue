<script setup lang="ts">
// TerraWatch — Phase 10.0: Marine Biota classification model page (Tier 2).
//
// ROV frame placeholder with species class overlay + horizontal species
// confidence bar chart (ECharts) + InferenceLogTable.

import { computed, onMounted, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import AIModelTabStrip from './components/AIModelTabStrip.vue'
import InferenceLogTable from './components/InferenceLogTable.vue'
import SqlInterpretationPanel from '@/features/weather-intelligence/components/SqlInterpretationPanel.vue'
import Card from '@/ui/Card.vue'
import { useMeta } from '@/composables/useMeta'
import { fetchInferenceResults } from '@/services/aiModels'
import type { InferenceResult } from '@/types/aiModels'

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent])

useMeta(() => ({
  title:       'Marine Biota — AI/ML Intelligence',
  description: 'Deep-sea species identification from MBARI ROV footage using CNN + Transfer Learning on 230+ marine species.',
}))

const MODEL_SLUG = 'marine-biota'

const results  = ref<InferenceResult[]>([])
const loading  = ref(true)
const errorMsg = ref<string | null>(null)

const topClass = computed(() => {
  if (!results.value.length) return null
  const best = [...results.value].sort((a, b) => b.confidence - a.confidence)[0]
  return best ?? null
})

onMounted(async () => {
  try {
    results.value = await fetchInferenceResults(MODEL_SLUG, 50)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to load.'
  } finally {
    loading.value = false
  }
})

// Group by detected class, average confidence
const speciesOption = computed(() => {
  if (!results.value.length) return null

  const byClass = new Map<string, { sum: number; count: number }>()
  for (const r of results.value) {
    const prev = byClass.get(r.detectedClass) ?? { sum: 0, count: 0 }
    byClass.set(r.detectedClass, { sum: prev.sum + r.confidence, count: prev.count + 1 })
  }
  const entries = [...byClass.entries()]
    .map(([cls, { sum, count }]) => ({ cls, conf: sum / count }))
    .sort((a, b) => b.conf - a.conf)
    .slice(0, 12)

  return {
    backgroundColor: 'transparent',
    animation:       false,
    grid:  { top: 8, bottom: 28, left: 160, right: 60 },
    xAxis: {
      type:      'value',
      max:       1,
      axisLine:  { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      axisLabel: {
        color:     '#64748b',
        fontSize:  10,
        formatter: (v: number) => `${Math.round(v * 100)}%`,
      },
    },
    yAxis: {
      type:      'category',
      data:      entries.map(e => e.cls.replace(/_/g, ' ')),
      axisLine:  { show: false },
      axisTick:  { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 10 },
    },
    tooltip: {
      trigger:   'item',
      formatter: (p: { name: string; value: number }) =>
        `${p.name}<br>Avg confidence: <strong>${(p.value * 100).toFixed(1)}%</strong>`,
    },
    series: [{
      type:      'bar',
      data:      entries.map(e => ({
        value:     e.conf,
        itemStyle: { color: '#22c55e', borderRadius: [0, 3, 3, 0] },
      })),
      barMaxWidth: 18,
      label: {
        show:      true,
        position:  'right',
        color:     '#94a3b8',
        fontSize:  10,
        formatter: (p: { value: number }) => `${(p.value * 100).toFixed(0)}%`,
      },
    }],
  }
})

const inferenceRpcSql = `select
  id,
  input_source,
  detected_class,
  confidence,
  metadata ->> 'depth_m'   as depth_m,
  metadata ->> 'rov_frame' as rov_frame,
  inferred_at
from public.model_inference_results(
  p_slug  := $1,
  p_limit := $2
);`
</script>

<template>
  <div>
    <AIModelTabStrip />

    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
      <!-- Header -->
      <header>
        <p class="text-ink-muted text-xs tracking-widest uppercase">Use case 4 · Tier 2</p>
        <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
          Marine Biota Classification
        </h1>
        <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-3xl leading-relaxed">
          CNN + Transfer Learning model identifying deep-sea species from MBARI ROV footage.
          1M+ labeled frames covering 230+ species at depths 200–4,000m.
          <span class="text-ink-muted/60">Tier 2 — awaiting proprietary ROV data at scale.</span>
        </p>
      </header>

      <!-- Model metadata row -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div v-for="(c, i) in [
          { label: 'Architecture', value: 'CNN + Transfer' },
          { label: 'Dataset',      value: 'MBARI ROV Catalog' },
          { label: 'Classes',      value: '230+ species' },
          { label: 'Status',       value: 'TRAINING' },
        ]" :key="i" class="rounded-xl border border-white/5 bg-surface-1 p-3">
          <p class="text-[9px] uppercase tracking-wider text-ink-muted/60">{{ c.label }}</p>
          <p class="text-xs font-medium text-ink-primary mt-0.5">{{ c.value }}</p>
        </div>
      </div>

      <!-- ROV frame placeholder + top detection -->
      <Card padded>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-ink-primary">ROV Frame — Species Detection</h2>
          <span class="text-[10px] uppercase tracking-wider text-accent border border-accent/30 bg-accent/[0.06] px-2 py-0.5 rounded">
            Training
          </span>
        </div>

        <div class="relative rounded-lg overflow-hidden bg-[#0a0f1a] border border-white/5 flex items-center justify-center"
             style="min-height: 220px;">
          <!-- Deep-sea scene simulation -->
          <div class="absolute inset-0 opacity-20"
               style="background: radial-gradient(ellipse at 40% 50%, #1a3a6b 0%, #050c18 70%);" />

          <!-- SVG fish / marine life placeholder -->
          <svg viewBox="0 0 240 120" class="relative z-10 w-64 opacity-70" fill="none">
            <!-- Body -->
            <ellipse cx="110" cy="60" rx="55" ry="28" fill="#1e40af" opacity="0.7"/>
            <!-- Tail -->
            <polygon points="55,60 30,35 30,85" fill="#1d4ed8" opacity="0.8"/>
            <!-- Eye -->
            <circle cx="148" cy="55" r="7" fill="#93c5fd"/>
            <circle cx="150" cy="54" r="3" fill="#0f172a"/>
            <!-- Fins -->
            <polygon points="110,32 130,16 140,32" fill="#3b82f6" opacity="0.6"/>
            <polygon points="100,88 120,104 130,88" fill="#3b82f6" opacity="0.6"/>
            <!-- Bioluminescence dots -->
            <circle cx="80"  cy="55" r="2.5" fill="#60a5fa" opacity="0.9"/>
            <circle cx="95"  cy="65" r="1.8" fill="#93c5fd" opacity="0.8"/>
            <circle cx="120" cy="52" r="2"   fill="#bfdbfe" opacity="0.7"/>
            <!-- Scanning frame -->
            <rect x="60" y="25" width="120" height="70" rx="4"
                  stroke="#6366f1" stroke-width="1.5" stroke-dasharray="6 3" fill="none" opacity="0.6"/>
          </svg>

          <!-- Detection label overlay -->
          <div v-if="topClass && !loading"
               class="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div class="rounded bg-black/70 px-2.5 py-1.5 text-xs">
              <p class="text-[9px] uppercase tracking-wider text-ink-muted/60 mb-0.5">Top detection</p>
              <p class="text-safe font-semibold">{{ topClass.detectedClass.replace(/_/g, ' ') }}</p>
              <p class="text-ink-muted/70 num">{{ (topClass.confidence * 100).toFixed(1) }}% confidence</p>
            </div>
            <div class="rounded bg-black/60 px-2 py-1 text-[10px] text-ink-muted/60">
              {{ topClass.inputSource }}
            </div>
          </div>

          <div v-else-if="loading" class="absolute inset-0 flex items-center justify-center">
            <p class="text-ink-muted text-sm">Loading…</p>
          </div>
        </div>

        <p class="text-[10px] text-ink-muted/50 mt-2">
          ROV frame placeholder — live inference will overlay bounding boxes directly on video frames
          from DataSnake AUV video streams once the Tier 2 fleet loop is established.
        </p>
      </Card>

      <!-- Species confidence chart -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">Species Detection Confidence (avg, latest 50)</h2>
        <div v-if="loading" class="h-56 bg-white/5 animate-pulse rounded-lg" />
        <div v-else-if="!speciesOption" class="text-ink-muted text-sm text-center py-8">
          No inference results yet.
        </div>
        <VChart v-else :option="speciesOption" :autoresize="true" class="h-72" />
      </Card>

      <!-- Input → Model → Output -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">Input → Model → Output</h2>
        <div class="grid grid-cols-3 gap-3 text-xs">
          <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3">
            <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mb-1">Input</p>
            <p class="text-ink-primary font-medium">ROV video frames</p>
            <p class="text-ink-muted mt-1">1080p · 30fps · depth 200–4,000m · MBARI catalog</p>
          </div>
          <div class="rounded-lg border border-accent/20 bg-accent/[0.04] p-3">
            <p class="text-[10px] uppercase tracking-wider text-accent/60 mb-1">Model</p>
            <p class="text-ink-primary font-medium">EfficientNet-B4</p>
            <p class="text-ink-muted mt-1">MBARI ROV catalog · 1M+ labeled frames · 230+ species</p>
            <p class="text-ink-muted/50 mt-1">In training — awaiting fleet data volume</p>
          </div>
          <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3">
            <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mb-1">Output</p>
            <p class="text-ink-primary font-medium">Species classification</p>
            <p class="text-ink-muted mt-1">Species name + confidence + depth_m + ROV frame ID</p>
          </div>
        </div>
      </Card>

      <!-- Inference log -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">Inference Log</h2>
        <div v-if="loading" class="text-ink-muted text-sm py-4 text-center">Loading…</div>
        <InferenceLogTable v-else :results="results" />
      </Card>

      <!-- SQL panel -->
      <Card padded>
        <SqlInterpretationPanel
          :query="inferenceRpcSql"
          :params="['marine-biota', 50]"
          source="model_inference_results()"
          caption="Returns species detections with depth and ROV frame metadata extracted from JSONB."
        />
      </Card>
    </div>
  </div>
</template>
