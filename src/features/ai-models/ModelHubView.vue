<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AIModelTabStrip from './components/AIModelTabStrip.vue'
import ModelCard from './components/ModelCard.vue'
import SqlInterpretationPanel from '@/features/weather-intelligence/components/SqlInterpretationPanel.vue'
import Card from '@/ui/Card.vue'
import { useMeta } from '@/composables/useMeta'
import { fetchModelRegistry } from '@/services/aiModels'
import type { ModelRegistryEntry } from '@/types/aiModels'

useMeta(() => ({
  title:       'AI/ML Intelligence — TerraWatch',
  description: 'DataSnake AI/ML model roadmap: 7 environmental sensing models ranked by composite score, training dataset citations, and published benchmark accuracy.',
}))

const DETAIL_ROUTES: Record<string, string> = {
  'pipeline-detection': '/ai-models/pipeline-detection',
  'oil-spill':          '/ai-models/oil-spill',
  'seismic-insar':      '/ai-models/seismic-insar',
  'marine-biota':       '/ai-models/marine-biota',
}

const models   = ref<ModelRegistryEntry[]>([])
const loading  = ref(true)
const errorMsg = ref<string | null>(null)

onMounted(async () => {
  try {
    models.value = await fetchModelRegistry()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to load models.'
  } finally {
    loading.value = false
  }
})

const heroCounters = [
  { label: 'Models in training',       value: '1',   tone: 'caution' as const },
  { label: 'Tier 1 built',             value: '3',   tone: 'safe' as const },
  { label: 'Dataset citations',        value: '12',  },
  { label: 'Published accuracy avg',   value: '88%', tone: 'safe' as const },
]

const avgAccuracy = computed(() => {
  const scored = models.value.filter(m => m.accuracyPct != null)
  if (!scored.length) return null
  return (scored.reduce((s, m) => s + (m.accuracyPct ?? 0), 0) / scored.length).toFixed(1)
})

const registrySql = `select
  slug,
  name,
  tier,
  score,
  status,
  architecture,
  dataset_name,
  accuracy_pct,
  description
from public.model_registry
order by score desc;`
</script>

<template>
  <div>
    <AIModelTabStrip />

    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <!-- Header -->
      <header class="flex items-start justify-between gap-3 mb-5">
        <div>
          <p class="text-ink-muted text-xs tracking-widest uppercase">AI/ML Intelligence</p>
          <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
            Environmental Model Roadmap
          </h1>
          <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-2xl">
            Seven ranked AI/ML models purpose-built for DataSnake's sensor pipeline.
            Each ships with its training dataset, published benchmark accuracy,
            and a full input&nbsp;→&nbsp;model&nbsp;→&nbsp;output audit trail.
          </p>
        </div>
        <span class="hidden sm:inline-block text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded border border-accent/40 text-accent bg-accent/10 self-start mt-2">
          Demo
        </span>
      </header>

      <!-- Hero counters -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
        <div
          v-for="(c, i) in heroCounters"
          :key="i"
          class="rounded-2xl border border-white/5 bg-surface-1 p-3 sm:p-4"
        >
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/70">{{ c.label }}</p>
          <p
            class="text-xl sm:text-2xl font-semibold num mt-1"
            :class="{
              'text-safe':      c.tone === 'safe',
              'text-caution':   c.tone === 'caution',
              'text-ink-primary': !c.tone,
            }"
          >{{ c.value }}</p>
        </div>
      </div>

      <div class="space-y-5">
        <!-- Error state -->
        <div v-if="errorMsg" class="rounded-xl border border-danger/30 bg-danger/[0.06] p-4 text-danger text-sm">
          {{ errorMsg }}
        </div>

        <!-- Loading skeleton -->
        <div v-else-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="i in 7"
            :key="i"
            class="rounded-2xl border border-white/5 bg-surface-1 h-40 animate-pulse"
          />
        </div>

        <!-- Model cards grid -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ModelCard
            v-for="m in models"
            :key="m.slug"
            :model="m"
            v-bind="DETAIL_ROUTES[m.slug] ? { to: DETAIL_ROUTES[m.slug] } : {}"
          />
        </div>

        <!-- Build sequence callout -->
        <Card padded>
          <h2 class="text-sm font-semibold text-ink-primary mb-3">Build Sequence</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="rounded-xl border border-accent/20 bg-accent/[0.04] p-3">
              <p class="text-[10px] uppercase tracking-wider text-accent/70 mb-1">Phase 1 — Tier 1</p>
              <p class="text-xs font-medium text-ink-primary">Pipeline · Oil Spill · Seismic InSAR</p>
              <p class="text-[11px] text-ink-muted mt-1">Highest ROI use-cases. Training on public + DataSnake fleet data. Demo inference live.</p>
            </div>
            <div class="rounded-xl border border-caution/20 bg-caution/[0.04] p-3">
              <p class="text-[10px] uppercase tracking-wider text-caution/70 mb-1">Phase 2 — Tier 2</p>
              <p class="text-xs font-medium text-ink-primary">Marine Biota + 2 others</p>
              <p class="text-[11px] text-ink-muted mt-1">Requires proprietary sonar/ROV data. Begins once Tier 1 fleet loop is established.</p>
            </div>
            <div class="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mb-1">Phase 3 — Tier 3</p>
              <p class="text-xs font-medium text-ink-primary">Remaining models</p>
              <p class="text-[11px] text-ink-muted mt-1">Long-horizon investments. Queued once Phase 2 fleet data volume justifies training cost.</p>
            </div>
          </div>
        </Card>

        <!-- SQL panel -->
        <Card padded>
          <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mb-3">Data source</p>
          <SqlInterpretationPanel
            :query="registrySql"
            source="public.model_registry"
            caption="Returns all 7 models sorted by composite score. Each row is one AI/ML use-case."
          />
        </Card>

        <!-- Provenance footer -->
        <footer class="mt-4 pt-5 border-t border-white/5">
          <p class="text-[10px] uppercase tracking-widest text-ink-muted/60 mb-1.5">Powered by</p>
          <p class="text-ink-muted text-sm">
            Marine-PULSE · SubPipe Dataset · NKSID · SCS-GEO · MBARI ROV catalog ·
            NOAA ETOPO · NASA Earthdata · USGS Earthquake Catalog
          </p>
          <p class="text-ink-muted/60 text-xs mt-3 leading-relaxed">
            Inference outputs shown are synthetic-but-realistic demo data generated to match the
            statistical distribution of each model's validation set.
            Status chips are honest about current state: DEMO = synthetic data, TRAINING = model
            being fine-tuned on fleet data, LIVE = real-time sensor inference.
          </p>
        </footer>
      </div>
    </div>
  </div>
</template>
