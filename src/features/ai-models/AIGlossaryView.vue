<script setup lang="ts">
import AIModelTabStrip from './components/AIModelTabStrip.vue'
import Card from '@/ui/Card.vue'
import { useMeta } from '@/composables/useMeta'

useMeta(() => ({
  title:       'AI Glossary — TerraWatch',
  description: 'Key terms and concepts behind TerraWatch\'s AI/ML environmental sensing models.',
}))

const sections = [
  {
    heading: 'Model Architecture',
    terms: [
      { term: 'YOLOv8', def: 'You Only Look Once v8 — a single-pass convolutional object detector that predicts bounding boxes and class probabilities simultaneously. Used for pipeline defect and oil spill detection where inference speed matters.' },
      { term: 'UNet', def: 'Encoder–decoder convolutional network with skip connections designed for pixel-wise semantic segmentation. Used for delineating spill boundaries and deformation zones from SAR imagery.' },
      { term: 'CNN + Transfer Learning', def: 'Convolutional Neural Network pre-trained on large image corpora (ImageNet, SAR-specific benchmarks) then fine-tuned on domain-specific labeled data. Dramatically reduces the labeled-data requirement.' },
      { term: 'InSAR', def: 'Interferometric Synthetic Aperture Radar — satellite radar technique that measures millimetric surface deformation by computing the phase difference between two SAR acquisitions. Used for subsidence, uplift, and volcanic deformation monitoring.' },
    ],
  },
  {
    heading: 'Model Tiers',
    terms: [
      { term: 'Tier 1', def: 'Highest commercial priority. Directly addressable by DataSnake\'s current sensor pipeline within 6–12 months. Training data is publicly available or can be synthesized from fleet telemetry. ROI case is clear.' },
      { term: 'Tier 2', def: 'High strategic value but requires either proprietary fleet data at scale or specialized hardware (ROV, airborne SAR). Target build window: 12–24 months after Tier 1 fleet loop is established.' },
      { term: 'Tier 3', def: 'Long-horizon investments with significant data collection requirements. Queued once Phase 2 data volume justifies training cost. Score reflects long-term value, not near-term feasibility.' },
      { term: 'Composite Score', def: 'A /20 score weighting commercial value (×2), data availability (×2), sensor fit, and engineering feasibility. Used to rank build order across the 7-model roadmap.' },
    ],
  },
  {
    heading: 'Inference & Evaluation',
    terms: [
      { term: 'Confidence', def: 'Model output probability (0.0–1.0) for the predicted class. High confidence (>0.85) indicates the model\'s internal representation closely matches training examples of that class.' },
      { term: 'mAP', def: 'Mean Average Precision — primary object detection benchmark. Computed as the area under the precision–recall curve, averaged across detection IoU thresholds and class labels.' },
      { term: 'IoU', def: 'Intersection over Union — ratio of the overlap between a predicted bounding box and the ground-truth box to their union area. IoU > 0.5 is the standard "correct detection" threshold.' },
      { term: 'F1 Score', def: 'Harmonic mean of Precision and Recall. More informative than accuracy for imbalanced class distributions (e.g., defects are rare vs. intact pipeline segments).' },
      { term: 'Benchmark Accuracy', def: 'Published accuracy on a held-out validation set drawn from the named training dataset. Not field accuracy — real-world distribution shift degrades performance; periodic fine-tuning with fleet data closes the gap.' },
    ],
  },
  {
    heading: 'Datasets',
    terms: [
      { term: 'Marine-PULSE', def: 'Public underwater sonar + camera dataset covering 12 pipeline segments with labeled corrosion, exposure, and burial annotations. Primary training source for the Pipeline Defect Detection model.' },
      { term: 'SubPipe', def: 'Submarine pipeline inspection dataset with annotated side-scan sonar imagery. Covers diverse seabed conditions (sandy, rocky, silted) across 4 geographic regions.' },
      { term: 'NKSID', def: 'North Korea SAR Image Dataset — repurposed for oil spill detection in nearshore environments. Contains 2,400 labeled SAR scenes with oil/look-alike annotations.' },
      { term: 'SCS-GEO', def: 'South China Sea geological survey dataset: InSAR coherence maps with labeled subsidence/uplift events validated against GPS ground-truth measurements.' },
      { term: 'MBARI ROV Catalog', def: 'Monterey Bay Aquarium Research Institute deep-sea ROV footage library: 1M+ labeled frames covering 230+ species in varied lighting and turbidity conditions.' },
    ],
  },
  {
    heading: 'Monitoring Concepts',
    terms: [
      { term: 'Pipeline Defect Classes', def: '"corroded" (electrochemical degradation visible in sonar backscatter), "exposed" (burial sediment lost), "buried" (deeper than nominal — reduced inspection access), "intact" (nominal condition), "damaged" (mechanical impact or third-party interference).' },
      { term: 'Oil Spill vs Look-alike', def: 'SAR oil slicks and meteorological phenomena (natural oil seeps, algal films, low-wind areas) produce similar dark patches. Discriminating them is the primary classification challenge; look-alikes are frequent false positives.' },
      { term: 'Subsidence / Uplift', def: 'Millimetric-to-centimetric vertical surface motion detected by InSAR. Subsidence often indicates groundwater extraction, mining, or sediment compaction. Uplift can signal magmatic intrusion or aquifer recharge.' },
      { term: 'FRP', def: 'Fire Radiative Power (Megawatts) — satellite-derived measure of fire intensity from thermal emission anomalies. Used by NASA FIRMS to rank active fire detections.' },
    ],
  },
]
</script>

<template>
  <div>
    <AIModelTabStrip />

    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <header>
        <p class="text-ink-muted text-xs tracking-widest uppercase">AI/ML Intelligence · Glossary</p>
        <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
          Terms &amp; Concepts
        </h1>
        <p class="text-ink-muted text-sm mt-2 max-w-2xl">
          Reference definitions for the architectures, evaluation metrics, datasets, and
          environmental phenomena underlying TerraWatch's model stack.
        </p>
      </header>

      <Card
        v-for="sec in sections"
        :key="sec.heading"
        padded
      >
        <h2 class="text-sm font-semibold text-ink-primary mb-4 pb-2 border-b border-white/5">
          {{ sec.heading }}
        </h2>
        <dl class="space-y-4">
          <div v-for="item in sec.terms" :key="item.term">
            <dt class="text-xs font-semibold text-accent">{{ item.term }}</dt>
            <dd class="text-sm text-ink-muted mt-1 leading-relaxed">{{ item.def }}</dd>
          </div>
        </dl>
      </Card>
    </div>
  </div>
</template>
