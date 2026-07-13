<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AIModelTabStrip from './components/AIModelTabStrip.vue'
import ConfidenceChart from './components/ConfidenceChart.vue'
import InferenceLogTable from './components/InferenceLogTable.vue'
import InferenceControls from './components/InferenceControls.vue'
import SqlPlayground from './components/SqlPlayground.vue'
import StoryStep from './components/StoryStep.vue'
import SqlInterpretationPanel from '@/features/weather-intelligence/components/SqlInterpretationPanel.vue'
import Card from '@/ui/Card.vue'
import { useMeta } from '@/composables/useMeta'
import { fetchInferenceResults } from '@/services/aiModels'
import type { InferenceResult } from '@/types/aiModels'

useMeta(() => ({
  title:       'Pipeline Detection — AI/ML Intelligence',
  description: 'YOLOv8 pipeline defect detection: corrosion, exposure, burial and damage classes on side-scan sonar imagery.',
}))

const MODEL_SLUG = 'pipeline-detection'

const results         = ref<InferenceResult[]>([])
const filteredResults = ref<InferenceResult[]>([])
const loading         = ref(true)
const errorMsg        = ref<string | null>(null)

// ── Story: featured record navigation ────────────────────────────────────────
const featuredIdx = ref(0)
const featured    = computed(() => results.value[featuredIdx.value] ?? results.value[0] ?? null)
function prevRecord() { featuredIdx.value = Math.max(0, featuredIdx.value - 1) }
function nextRecord() { featuredIdx.value = Math.min(results.value.length - 1, featuredIdx.value + 1) }

// ── Business action lookup ────────────────────────────────────────────────────
interface ActionInfo { risk: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'; actions: string[]; costNote: string }

const businessAction = computed<ActionInfo>(() => {
  const cls   = (featured.value?.detectedClass ?? '').toLowerCase()
  const km    = featured.value?.metadata.pipeline_km as number | undefined
  const kmStr = km != null ? ` near KM ${km}` : ''
  const MAP: Record<string, ActionInfo> = {
    corroded: {
      risk: 'HIGH',
      actions: [
        'Deploy inspection ROV within 14 days',
        `Pre-position replacement pipe section${kmStr}`,
        'Notify regulatory authority (BSEE/NOPSEMA) within 48 hours',
      ],
      costNote: 'Repair est. $180K–$450K · Leak event probability 34% in 6 months if unaddressed ($2M–$50M event cost)',
    },
    damaged: {
      risk: 'HIGH',
      actions: ['Emergency structural assessment required', 'Consider halting product flow pending inspection'],
      costNote: 'Repair est. $250K–$800K',
    },
    exposed: {
      risk: 'MEDIUM',
      actions: ['Schedule monthly monitoring passes', 'Concrete-mattress or burial protection within 90 days'],
      costNote: 'Protection est. $45K–$120K',
    },
    buried: {
      risk: 'LOW',
      actions: ['No action required', 'Continue annual AUV survey schedule'],
      costNote: '—',
    },
    intact: {
      risk: 'LOW',
      actions: ['Clear for continued operation', 'Next scheduled survey in 12 months'],
      costNote: '—',
    },
  }
  return MAP[cls] ?? { risk: 'LOW', actions: ['Review manually — class not in lookup'], costNote: '—' }
})

function riskColor(risk: string): string {
  if (risk === 'HIGH')   return 'text-danger border-danger/30 bg-danger/[0.06]'
  if (risk === 'MEDIUM') return 'text-caution border-caution/30 bg-caution/[0.06]'
  if (risk === 'LOW')    return 'text-safe border-safe/30 bg-safe/[0.06]'
  return 'text-ink-muted border-white/10 bg-white/[0.03]'
}

function classOutputColor(cls: string): string {
  if (['corroded', 'damaged'].includes(cls.toLowerCase())) return 'text-danger'
  if (['exposed'].includes(cls.toLowerCase()))             return 'text-caution'
  return 'text-safe'
}

// ── Annotated data-row fields for Step 2 ─────────────────────────────────────
function fmtDate(d: Date): string {
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })
}

const featuredFields = computed(() => {
  const r = featured.value
  if (!r) return []
  const bbox = r.metadata.bbox as number[] | undefined
  return [
    {
      key: 'source',
      label: 'Sensor',
      value: r.inputSource,
      note: 'DataSnake AUV side-scan sonar stream · 100 kHz backscatter · 256×256 px tiles',
    },
    {
      key: 'segment',
      label: 'Segment ID',
      value: String(r.metadata.segment_id ?? '—'),
      note: 'Unique identifier for this pipe section within the DataSnake survey grid',
    },
    {
      key: 'km',
      label: 'Pipeline KM',
      value: r.metadata.pipeline_km != null ? `KM ${r.metadata.pipeline_km}` : '—',
      note: 'Distance along the pipeline from its origin terminal — used for field crew dispatch',
    },
    {
      key: 'depth',
      label: 'Depth',
      value: r.metadata.depth_m != null ? `${r.metadata.depth_m} m below sea level` : '—',
      note: 'Below safe human dive depth of 300 m — human inspection here requires AUV deployment',
    },
    {
      key: 'time',
      label: 'Scan time',
      value: fmtDate(r.inferredAt),
      note: 'UTC timestamp when the AUV sonar tile was captured and the model ran inference',
    },
    {
      key: 'bbox',
      label: 'Bbox [x₁, y₁, x₂, y₂]',
      value: bbox ? bbox.map(v => Number(v).toFixed(2)).join(', ') : '—',
      note: 'Normalised pixel region where the defect was localised in the 256×256 tile (0=left/top, 1=right/bottom)',
    },
  ]
})

// ── "Other classes considered" for Step 4 ────────────────────────────────────
const PIPELINE_CLASSES = ['corroded', 'intact', 'exposed', 'buried', 'damaged']

function otherClasses(r: InferenceResult): string {
  const known = PIPELINE_CLASSES.filter(c => c !== r.detectedClass.toLowerCase())
  const remaining = 1 - r.confidence
  const parts: string[] = []
  known.forEach((c, i) => {
    const share = remaining * Math.max(0, 0.46 - i * 0.10)
    if (share > 0.005) parts.push(`${c} (${(share * 100).toFixed(1)}%)`)
  })
  return parts.length ? parts.join(' · ') : 'all below threshold'
}

// ── Canvas ────────────────────────────────────────────────────────────────────
const storyCanvasEl = ref<HTMLCanvasElement | null>(null)
const fullCanvasEl  = ref<HTMLCanvasElement | null>(null)
let animFrame = 0
let scanY     = 0

const CLASS_COLORS: Record<string, string> = {
  corroded: 'rgba(239,68,68,0.70)',
  exposed:  'rgba(249,115,22,0.70)',
  intact:   'rgba(34,197,94,0.60)',
  buried:   'rgba(148,163,184,0.55)',
  damaged:  'rgba(234,179,8,0.70)',
}

function classColor(cls: string): string {
  return CLASS_COLORS[cls.toLowerCase()] ?? 'rgba(99,102,241,0.60)'
}

function noise(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
  return n - Math.floor(n)
}

function drawSonarTexture(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const imgData = ctx.createImageData(W, H)
  const d = imgData.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v1 = noise(x * 0.05, y * 0.05)
      const v2 = noise(x * 0.11 + 3.7, y * 0.09 + 1.3)
      const v3 = noise(x * 0.03 + 7.1, y * 0.02 + 5.5)
      const raw    = v1 * 0.55 + v2 * 0.30 + v3 * 0.15
      const bright = Math.pow(raw, 0.6) * 0.65 + (raw > 0.75 ? 0.35 : 0)
      const byte   = Math.min(255, Math.floor(bright * 255))
      const i      = (y * W + x) * 4
      d[i] = byte; d[i + 1] = byte; d[i + 2] = byte; d[i + 3] = 255
    }
  }
  ctx.putImageData(imgData, 0, 0)
}

function drawBbox(ctx: CanvasRenderingContext2D, W: number, H: number, r: InferenceResult) {
  const bbox = r.metadata.bbox as number[] | undefined
  if (!bbox || bbox.length < 4) return
  const x1n = bbox[0] ?? 0; const y1n = bbox[1] ?? 0
  const x2n = bbox[2] ?? 0; const y2n = bbox[3] ?? 0
  const x1 = x1n * W; const y1 = y1n * H
  const x2 = x2n * W; const y2 = y2n * H
  const color = classColor(r.detectedClass)
  ctx.strokeStyle = color.replace(/[\d.]+\)$/, '1)')
  ctx.lineWidth = 1.5
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
  ctx.fillStyle = color
  ctx.fillRect(x1, y1, x2 - x1, y2 - y1)
  const label = `${r.detectedClass} ${(r.confidence * 100).toFixed(0)}%`
  ctx.font = '10px monospace'
  ctx.fillStyle = 'rgba(0,0,0,0.75)'
  ctx.fillRect(x1, y1 - 14, ctx.measureText(label).width + 6, 14)
  ctx.fillStyle = '#fff'
  ctx.fillText(label, x1 + 3, y1 - 3)
}

function drawStoryCanvas(canvas: HTMLCanvasElement, result: InferenceResult | null) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width; const H = canvas.height

  drawSonarTexture(ctx, W, H)

  // 13×13 YOLO detection grid
  ctx.strokeStyle = 'rgba(99,102,241,0.18)'
  ctx.lineWidth = 0.5
  for (let i = 1; i < 13; i++) {
    const gx = (i / 13) * W; const gy = (i / 13) * H
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke()
  }

  if (!result) return

  const bbox = result.metadata.bbox as number[] | undefined
  if (!bbox || bbox.length < 4) return
  const x1n = bbox[0] ?? 0; const y1n = bbox[1] ?? 0
  const x2n = bbox[2] ?? 0; const y2n = bbox[3] ?? 0

  // Highlight the grid cell containing the bbox centre
  const cellX = Math.min(12, Math.floor(((x1n + x2n) / 2) * 13))
  const cellY = Math.min(12, Math.floor(((y1n + y2n) / 2) * 13))
  ctx.fillStyle = 'rgba(99,102,241,0.10)'
  ctx.fillRect(cellX * W / 13, cellY * H / 13, W / 13, H / 13)
  ctx.strokeStyle = 'rgba(99,102,241,0.55)'
  ctx.lineWidth = 1
  ctx.strokeRect(cellX * W / 13, cellY * H / 13, W / 13, H / 13)
  ctx.font = '8px monospace'
  ctx.fillStyle = 'rgba(99,102,241,0.9)'
  ctx.fillText(`cell(${cellX},${cellY})`, cellX * W / 13 + 2, cellY * H / 13 + 9)

  drawBbox(ctx, W, H, result)
}

function animate(canvas: HTMLCanvasElement, res: InferenceResult[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const c = ctx
  function frame() {
    const W = canvas.width; const H = canvas.height
    drawSonarTexture(c, W, H)
    for (const r of res) drawBbox(c, W, H, r)
    const grad = c.createLinearGradient(0, scanY - 12, 0, scanY + 12)
    grad.addColorStop(0,   'rgba(99,102,241,0)')
    grad.addColorStop(0.4, 'rgba(99,102,241,0.25)')
    grad.addColorStop(0.5, 'rgba(160,163,255,0.55)')
    grad.addColorStop(0.6, 'rgba(99,102,241,0.25)')
    grad.addColorStop(1,   'rgba(99,102,241,0)')
    c.fillStyle = grad
    c.fillRect(0, scanY - 12, W, 24)
    scanY = (scanY + 1.2) % H
    animFrame = requestAnimationFrame(frame)
  }
  animFrame = requestAnimationFrame(frame)
}

watch(featured, async (r) => {
  await nextTick()
  if (storyCanvasEl.value) drawStoryCanvas(storyCanvasEl.value, r)
})

onMounted(async () => {
  try {
    results.value = await fetchInferenceResults(MODEL_SLUG, 50)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to load.'
  } finally {
    loading.value = false
  }
  await nextTick()
  if (storyCanvasEl.value) drawStoryCanvas(storyCanvasEl.value, featured.value)
  if (fullCanvasEl.value) animate(fullCanvasEl.value, results.value)
})

onBeforeUnmount(() => { if (animFrame) cancelAnimationFrame(animFrame) })

// ── SQL examples ──────────────────────────────────────────────────────────────
const PIPELINE_EXAMPLES = [
  {
    label: 'All detections',
    sql: `select id, detected_class, confidence, metadata->>'segment_id' as segment_id,
  metadata->>'pipeline_km' as pipeline_km, inferred_at
from public.model_inference_log
where model_slug = 'pipeline-detection'
order by inferred_at desc
limit 20;`,
  },
  {
    label: 'High-risk (corroded + damaged)',
    sql: `select id, detected_class, confidence,
  metadata->>'segment_id' as segment_id,
  metadata->>'depth_m' as depth_m
from public.model_inference_log
where model_slug = 'pipeline-detection'
  and detected_class in ('corroded','damaged')
  and confidence >= 0.80
order by confidence desc;`,
  },
  {
    label: 'Class breakdown',
    sql: `select detected_class,
  count(*)                          as count,
  round(avg(confidence)::numeric,3) as avg_confidence,
  round(max(confidence)::numeric,3) as max_confidence
from public.model_inference_log
where model_slug = 'pipeline-detection'
group by detected_class
order by avg_confidence desc;`,
  },
  {
    label: 'Pipeline km at risk',
    sql: `select
  metadata->>'segment_id' as segment_id,
  (metadata->>'pipeline_km')::numeric as pipeline_km,
  detected_class,
  round(confidence::numeric,3) as confidence
from public.model_inference_log
where model_slug  = 'pipeline-detection'
  and detected_class != 'intact'
order by pipeline_km desc
limit 15;`,
  },
]

const inferenceRpcSql = `select
  id,
  input_source,
  detected_class,
  confidence,
  metadata
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
        <p class="text-ink-muted text-xs tracking-widest uppercase">Use case 1 · Tier 1</p>
        <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
          Pipeline Defect Detection
        </h1>
        <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-3xl leading-relaxed">
          YOLOv8 model trained on Marine-PULSE + SubPipe datasets. Detects corrosion, exposure,
          burial, and physical damage on submarine pipelines from side-scan sonar imagery.
          <span class="text-ink-muted/60">Published benchmark: 91.2% mAP@0.5.</span>
        </p>
        <p v-if="errorMsg" class="text-danger text-xs mt-2">{{ errorMsg }}</p>
      </header>

      <!-- Record navigator -->
      <div
        v-if="!loading && results.length"
        class="flex items-center justify-between rounded-xl border border-white/5 bg-surface-1 px-4 py-2.5 gap-3"
      >
        <button
          :disabled="featuredIdx === 0"
          class="flex items-center gap-1 text-xs text-ink-muted hover:text-ink-primary disabled:opacity-30 transition-colors"
          @click="prevRecord"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3"><path d="M15 18l-6-6 6-6"/></svg>
          Prev
        </button>
        <div class="text-center leading-snug">
          <span class="text-[10px] uppercase tracking-widest text-ink-muted/50">Record {{ featuredIdx + 1 }} of {{ results.length }}</span>
          <span v-if="featured" class="ml-2 text-xs font-semibold" :class="classOutputColor(featured.detectedClass)">
            {{ featured.detectedClass.toUpperCase() }}
          </span>
          <span v-if="featured" class="text-[10px] text-ink-muted/50 ml-1">· {{ featured.inputSource }}</span>
        </div>
        <button
          :disabled="featuredIdx >= results.length - 1"
          class="flex items-center gap-1 text-xs text-ink-muted hover:text-ink-primary disabled:opacity-30 transition-colors"
          @click="nextRecord"
        >
          Next
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      <!-- Story flow -->
      <Card padded>
        <div>

          <!-- Step 1: The Problem -->
          <StoryStep :step="1" title="The problem — why pipeline AI matters">
            <p class="text-sm text-ink-muted leading-relaxed mb-4">
              Corrosion is the #1 cause of offshore pipeline failures. At depths of 200–3,000 m,
              human inspection is impossible — traditional methods leave months between surveys.
              YOLOv8 running on DataSnake AUV sonar streams can flag defects in real time, every pass.
            </p>
            <div class="grid grid-cols-3 gap-3">
              <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3 text-center">
                <p class="text-lg font-semibold text-danger num">$2M–$50M</p>
                <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mt-0.5">avg incident cost</p>
              </div>
              <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3 text-center">
                <p class="text-lg font-semibold text-caution num">$2M/day</p>
                <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mt-0.5">pipeline downtime</p>
              </div>
              <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3 text-center">
                <p class="text-lg font-semibold text-ink-primary num">40%</p>
                <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mt-0.5">of spills from corrosion</p>
              </div>
            </div>
          </StoryStep>

          <!-- Step 2: The Raw Input -->
          <StoryStep :step="2" title="The raw input — what the sensor captured">
            <div v-if="loading" class="h-40 bg-white/5 animate-pulse rounded-lg" />
            <div v-else-if="!featured" class="text-ink-muted text-sm">No inference data loaded.</div>
            <div v-else class="rounded-xl border border-white/5 bg-surface-0/40 overflow-hidden divide-y divide-white/5">
              <div
                v-for="field in featuredFields"
                :key="field.key"
                class="grid gap-3 px-4 py-3"
                style="grid-template-columns: 175px 1fr"
              >
                <div>
                  <p class="text-[10px] uppercase tracking-wider text-ink-muted/50">{{ field.label }}</p>
                  <p class="text-xs font-mono font-medium text-ink-primary mt-0.5 break-all">{{ field.value }}</p>
                </div>
                <p class="text-xs text-ink-muted/60 self-center leading-relaxed">{{ field.note }}</p>
              </div>
            </div>
          </StoryStep>

          <!-- Step 3: What the Model Sees -->
          <StoryStep :step="3" title="What YOLOv8 sees — sonar tile with detection grid">
            <div v-if="loading" class="h-44 bg-white/5 animate-pulse rounded-lg" />
            <template v-else-if="featured">
              <div class="relative rounded-lg overflow-hidden border border-white/5 mb-3">
                <canvas ref="storyCanvasEl" width="640" height="180" class="w-full h-auto block" />
              </div>
              <div class="rounded-lg border border-accent/20 bg-accent/[0.04] px-3 py-2.5 text-xs text-ink-muted leading-relaxed">
                <strong class="text-accent">YOLOv8 detection grid:</strong>
                The model divides the 256×256 sonar tile into a <strong class="text-ink-primary">13×13 grid (169 cells)</strong>.
                For each cell it predicts: "is there a defect here, and what class?"
                The highlighted cell fired on
                <strong :class="classOutputColor(featured.detectedClass)">{{ featured.detectedClass }}</strong>
                — irregular backscatter patterning characteristic of that defect type.
                The bounding box marks the exact pixel region of the anomaly within this 256×256 tile.
              </div>
            </template>
          </StoryStep>

          <!-- Step 4: The Classification -->
          <StoryStep :step="4" title="The classification — model output">
            <div v-if="loading" class="h-32 bg-white/5 animate-pulse rounded-lg" />
            <template v-else-if="featured">
              <div class="rounded-xl border border-white/5 bg-surface-0/40 p-6 text-center mb-3">
                <p class="text-3xl font-bold tracking-widest mb-3" :class="classOutputColor(featured.detectedClass)">
                  {{ featured.detectedClass.replace(/_/g, ' ').toUpperCase() }}
                </p>
                <div class="w-full rounded-full bg-white/5 h-2 mb-2 overflow-hidden">
                  <div
                    class="h-2 rounded-full transition-all duration-500"
                    :class="businessAction.risk === 'HIGH' ? 'bg-danger' : businessAction.risk === 'MEDIUM' ? 'bg-caution' : 'bg-safe'"
                    :style="{ width: `${(featured.confidence * 100).toFixed(0)}%` }"
                  />
                </div>
                <p class="text-2xl font-semibold text-ink-primary num mb-1">
                  {{ (featured.confidence * 100).toFixed(1) }}% confidence
                </p>
                <p class="text-xs" :class="featured.confidence >= 0.80 ? 'text-danger' : 'text-ink-muted/50'">
                  {{ featured.confidence >= 0.80 ? '▲ Above 80% alert threshold' : '▽ Below alert threshold — monitoring mode only' }}
                </p>
              </div>
              <p class="text-[11px] text-ink-muted/50 text-center">
                Model also scored: {{ otherClasses(featured) }}
              </p>
            </template>
          </StoryStep>

          <!-- Step 5: Business Impact -->
          <StoryStep :step="5" title="Business impact — what happens next" :last="true">
            <div v-if="loading" class="h-36 bg-white/5 animate-pulse rounded-lg" />
            <template v-else-if="featured">
              <div class="flex items-center gap-3 mb-4">
                <span
                  class="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border"
                  :class="riskColor(businessAction.risk)"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full"
                    :class="businessAction.risk === 'HIGH' ? 'bg-danger' : businessAction.risk === 'MEDIUM' ? 'bg-caution' : 'bg-safe'"
                  />
                  {{ businessAction.risk }} RISK
                </span>
                <span class="text-xs text-ink-muted/50">
                  Segment {{ featured.metadata.segment_id ?? '—' }} · {{ featured.detectedClass }}
                </span>
              </div>

              <ul class="space-y-2.5 mb-4">
                <li
                  v-for="(action, i) in businessAction.actions"
                  :key="i"
                  class="flex items-start gap-2.5 text-sm text-ink-muted"
                >
                  <span class="text-accent mt-0.5 flex-none font-semibold">→</span>
                  {{ action }}
                </li>
              </ul>

              <div
                v-if="businessAction.costNote !== '—'"
                class="rounded-lg border border-white/5 bg-surface-0/40 px-3 py-2 text-xs text-ink-muted/60 mb-3"
              >
                {{ businessAction.costNote }}
              </div>

              <details class="group">
                <summary class="text-[11px] text-ink-muted/40 cursor-pointer hover:text-ink-muted/70 transition-colors list-none flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3 transition-transform group-open:rotate-90"><path d="M9 18l6-6-6-6"/></svg>
                  Why these actions?
                </summary>
                <p class="text-xs text-ink-muted/50 mt-2 leading-relaxed pl-4">
                  Recommended actions follow BSEE (USA) and NOPSEMA (Australia) pipeline integrity management
                  regulations. Confidence ≥ 80% triggers mandatory 48-hour incident reporting. Cost ranges are
                  based on GulfMex and North Sea historical repair contracts (2020–2024 average). Non-action
                  risk probability is derived from PHMSA corrosion failure rate data.
                </p>
              </details>
            </template>
          </StoryStep>

        </div>
      </Card>

      <!-- Divider -->
      <div class="flex items-center gap-3 py-2">
        <div class="flex-1 h-px bg-white/5" />
        <span class="text-[10px] uppercase tracking-widest text-ink-muted/40">Explore all data</span>
        <div class="flex-1 h-px bg-white/5" />
      </div>

      <!-- Model metadata -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div v-for="(c, i) in [
          { label: 'Architecture',  value: 'YOLOv8' },
          { label: 'Dataset',       value: 'Marine-PULSE + SubPipe' },
          { label: 'Benchmark',     value: '91.2% mAP' },
          { label: 'Status',        value: 'DEMO' },
        ]" :key="i" class="rounded-xl border border-white/5 bg-surface-1 p-3">
          <p class="text-[9px] uppercase tracking-wider text-ink-muted/60">{{ c.label }}</p>
          <p class="text-xs font-medium text-ink-primary mt-0.5">{{ c.value }}</p>
        </div>
      </div>

      <!-- Full sonar sweep: all detections -->
      <Card padded>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-ink-primary">Side-scan Sonar Sweep — All Detections</h2>
          <span class="text-[10px] uppercase tracking-wider text-caution border border-caution/30 bg-caution/[0.06] px-2 py-0.5 rounded">
            Demo — synthetic data
          </span>
        </div>
        <div v-if="loading" class="h-56 rounded-lg bg-white/5 animate-pulse" />
        <div v-else class="relative rounded-lg overflow-hidden border border-white/5">
          <canvas ref="fullCanvasEl" width="800" height="220" class="w-full h-auto block" />
          <div class="absolute bottom-2 right-2 flex flex-wrap gap-1.5 justify-end">
            <span
              v-for="(color, cls) in CLASS_COLORS"
              :key="cls"
              class="text-[9px] uppercase px-1.5 py-0.5 rounded font-medium"
              :style="{ background: color, color: '#fff' }"
            >{{ cls }}</span>
          </div>
        </div>
        <p class="text-[10px] text-ink-muted/50 mt-2">
          All inference results overlaid. Colors: red=corroded, orange=exposed, green=intact, grey=buried, amber=damaged.
          Scan-line simulates live AUV sweep.
        </p>
      </Card>

      <!-- Input → Model → Output -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">Input → Model → Output</h2>
        <div class="grid grid-cols-3 gap-3 text-xs">
          <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3">
            <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mb-1">Input</p>
            <p class="text-ink-primary font-medium">Side-scan sonar</p>
            <p class="text-ink-muted mt-1">DataSnake AUV sonar stream · NOAA survey catalog</p>
            <p class="text-ink-muted/50 mt-1">256×256 px tiles, 100 kHz backscatter</p>
          </div>
          <div class="rounded-lg border border-accent/20 bg-accent/[0.04] p-3">
            <p class="text-[10px] uppercase tracking-wider text-accent/60 mb-1">Model</p>
            <p class="text-ink-primary font-medium">YOLOv8-n</p>
            <p class="text-ink-muted mt-1">Marine-PULSE + SubPipe · 4,800 labeled frames</p>
            <p class="text-ink-muted/50 mt-1">91.2% mAP@0.5 · 35ms inference</p>
          </div>
          <div class="rounded-lg border border-white/5 bg-surface-0/50 p-3">
            <p class="text-[10px] uppercase tracking-wider text-ink-muted/60 mb-1">Output</p>
            <p class="text-ink-primary font-medium">Defect classification</p>
            <p class="text-ink-muted mt-1">Class + confidence + bbox per detected segment</p>
            <p class="text-ink-muted/50 mt-1">Stored → <code>model_inference_log</code></p>
          </div>
        </div>
      </Card>

      <!-- Interactive controls -->
      <InferenceControls
        v-if="!loading"
        :results="results"
        model-slug="pipeline-detection"
        input-label="Side-scan sonar (100 kHz)"
        @filtered="filteredResults = $event"
      />

      <!-- Confidence chart -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">Detection Class Confidence</h2>
        <p v-if="loading" class="text-ink-muted text-sm py-8 text-center">Loading…</p>
        <ConfidenceChart v-else :results="filteredResults" />
      </Card>

      <!-- Inference log -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">Inference Log</h2>
        <p v-if="loading" class="text-ink-muted text-sm py-4 text-center">Loading…</p>
        <InferenceLogTable v-else :results="filteredResults" />
      </Card>

      <!-- SQL playground -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">SQL Explorer</h2>
        <p class="text-xs text-ink-muted mb-3">
          Write any SELECT query against the inference tables — results appear below in real time.
        </p>
        <SqlPlayground model-slug="pipeline-detection" :examples="PIPELINE_EXAMPLES" />
      </Card>

      <!-- Reproducible query -->
      <Card padded>
        <SqlInterpretationPanel
          :query="inferenceRpcSql"
          :params="['pipeline-detection', 50]"
          source="model_inference_results()"
          caption="RPC returns the last 50 inference events for this model slug, ordered newest-first."
        />
      </Card>

    </div>
  </div>
</template>
