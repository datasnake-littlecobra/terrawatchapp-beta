<script setup lang="ts">
// TerraWatch — Phase 10.0: Pipeline Defect Detection model page.
//
// Sonar sweep panel: Canvas element with deterministic greyscale noise
// simulating side-scan sonar backscatter, colored bounding boxes drawn
// from inference result metadata.bbox, and a scan-line animation overlay.

import { onBeforeUnmount, onMounted, ref } from 'vue'
import AIModelTabStrip from './components/AIModelTabStrip.vue'
import ConfidenceChart from './components/ConfidenceChart.vue'
import InferenceLogTable from './components/InferenceLogTable.vue'
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

const results  = ref<InferenceResult[]>([])
const loading  = ref(true)
const errorMsg = ref<string | null>(null)

const canvasEl = ref<HTMLCanvasElement | null>(null)
let animFrame  = 0
let scanY      = 0

// Class → RGBA color for bounding boxes
const CLASS_COLORS: Record<string, string> = {
  corroded: 'rgba(239,68,68,0.70)',   // red
  exposed:  'rgba(249,115,22,0.70)',  // orange
  intact:   'rgba(34,197,94,0.60)',   // green
  buried:   'rgba(148,163,184,0.55)', // slate
  damaged:  'rgba(234,179,8,0.70)',   // amber
}

function classColor(cls: string): string {
  return CLASS_COLORS[cls.toLowerCase()] ?? 'rgba(99,102,241,0.60)'
}

// Deterministic pseudo-noise for sonar texture — avoids Math.random() in
// rendering loop so the texture is stable across redraws.
function noise(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
  return n - Math.floor(n)
}

function drawSonar(canvas: HTMLCanvasElement, inferenceResults: InferenceResult[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const W = canvas.width
  const H = canvas.height

  // Draw greyscale sonar texture
  const imgData = ctx.createImageData(W, H)
  const d = imgData.data
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v1 = noise(x * 0.05, y * 0.05)
      const v2 = noise(x * 0.11 + 3.7, y * 0.09 + 1.3)
      const v3 = noise(x * 0.03 + 7.1, y * 0.02 + 5.5)
      const raw = (v1 * 0.55 + v2 * 0.30 + v3 * 0.15)
      // Simulate sonar reflectivity: dark voids and bright scatterers
      const bright = Math.pow(raw, 0.6) * 0.65 + (raw > 0.75 ? 0.35 : 0)
      const byte = Math.min(255, Math.floor(bright * 255))
      const i = (y * W + x) * 4
      d[i] = byte; d[i + 1] = byte; d[i + 2] = byte; d[i + 3] = 255
    }
  }
  ctx.putImageData(imgData, 0, 0)

  // Draw bounding boxes from inference metadata
  for (const r of inferenceResults) {
    const bbox = r.metadata.bbox as [number, number, number, number] | undefined
    if (!bbox || bbox.length < 4) continue
    const [x1n, y1n, x2n, y2n] = bbox
    const x1 = x1n * W; const y1 = y1n * H
    const x2 = x2n * W; const y2 = y2n * H
    const color = classColor(r.detectedClass)

    ctx.strokeStyle = color.replace('0.70', '1').replace('0.60', '1').replace('0.55', '1')
    ctx.lineWidth = 1.5
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

    ctx.fillStyle = color
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1)

    // Label
    const label = `${r.detectedClass} ${(r.confidence * 100).toFixed(0)}%`
    ctx.font = '10px monospace'
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.fillRect(x1, y1 - 14, ctx.measureText(label).width + 6, 14)
    ctx.fillStyle = '#fff'
    ctx.fillText(label, x1 + 3, y1 - 3)
  }
}

function animate(canvas: HTMLCanvasElement, results: InferenceResult[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const c = ctx  // capture non-null for closure

  function frame() {
    drawSonar(canvas, results)

    // Scan-line overlay: bright horizontal sweep
    const H = canvas.height
    const W = canvas.width
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

onMounted(async () => {
  try {
    results.value = await fetchInferenceResults(MODEL_SLUG, 50)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to load.'
  } finally {
    loading.value = false
  }

  if (canvasEl.value) {
    animate(canvasEl.value, results.value)
  }
})

onBeforeUnmount(() => {
  if (animFrame) cancelAnimationFrame(animFrame)
})

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
      </header>

      <!-- Model metadata row -->
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

      <!-- Sonar sweep panel -->
      <Card padded>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-ink-primary">Side-scan Sonar Sweep</h2>
          <span class="text-[10px] uppercase tracking-wider text-caution border border-caution/30 bg-caution/[0.06] px-2 py-0.5 rounded">
            Demo — synthetic data
          </span>
        </div>
        <div v-if="loading" class="h-56 rounded-lg bg-white/5 animate-pulse" />
        <div v-else class="relative rounded-lg overflow-hidden border border-white/5">
          <canvas
            ref="canvasEl"
            width="800"
            height="220"
            class="w-full h-auto block"
          />
          <!-- Legend overlay -->
          <div class="absolute bottom-2 right-2 flex flex-wrap gap-1.5 justify-end">
            <span v-for="(color, cls) in CLASS_COLORS" :key="cls"
                  class="text-[9px] uppercase px-1.5 py-0.5 rounded font-medium"
                  :style="{ background: color, color: '#fff' }">
              {{ cls }}
            </span>
          </div>
        </div>
        <p class="text-[10px] text-ink-muted/50 mt-2">
          Colored bounding boxes are drawn from <code>metadata.bbox</code> in the inference log.
          Scan-line simulates live sonar sweep. Colors: red=corroded, orange=exposed, green=intact, grey=buried, amber=damaged.
        </p>
      </Card>

      <!-- Input → Model → Output audit trail -->
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

      <!-- Confidence chart -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">Detection Class Confidence (latest 50)</h2>
        <p v-if="loading" class="text-ink-muted text-sm py-8 text-center">Loading…</p>
        <ConfidenceChart v-else :results="results" />
      </Card>

      <!-- Inference log -->
      <Card padded>
        <h2 class="text-sm font-semibold text-ink-primary mb-3">Inference Log</h2>
        <p v-if="loading" class="text-ink-muted text-sm py-4 text-center">Loading…</p>
        <InferenceLogTable v-else :results="results" />
      </Card>

      <!-- SQL panel -->
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
