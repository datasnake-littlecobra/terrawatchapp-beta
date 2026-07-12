# TerraWatch — Phase 10.0: AI/ML Intelligence Section

## What this section is

`/ai-models` is a live showcase of DataSnake's 7 ranked AI/ML models for
environmental sensing. The goal is to give investors and clients **proof that
the algorithms work** — by showing the training dataset, published benchmark
accuracy, sample inference outputs, and the full audit trail
(input → model → output) for each use case.

Every page follows DataSnake's "show your math" philosophy:
- What sensor data went in
- Which model ran on it (architecture, training dataset, version)
- What came out (detected class, confidence score, geographic location)
- The exact SQL query that produced the result (copy-pasteable, reproducible)
- An honest status chip: **DEMO** (synthetic data) / **TRAINING** (being built) / **LIVE** (real sensors)

---

## URL Structure

| URL | Page | What you see |
|-----|------|-------------|
| `/ai-models` | Hub / Overview | All 7 model cards ranked by composite score |
| `/ai-models/pipeline-detection` | Pipeline Detection | Animated sonar sweep canvas + detections |
| `/ai-models/oil-spill` | Oil Spill Detection | MapLibre map with polygon overlays |
| `/ai-models/seismic-insar` | Seismic / InSAR | ECharts interferogram heatmap |
| `/ai-models/marine-biota` | Marine Biota | ROV frame + species confidence chart |
| `/ai-models/glossary` | Glossary | Definitions for all technical terms |

---

## The 7 Models

### Tier 1 — Build now (high ROI, public training data available)

#### 1. Pipeline Defect Detection (Score: 18/20)
- **Architecture:** YOLOv8-n (single-pass convolutional object detector)
- **Training data:** Marine-PULSE + SubPipe — 4,800 labeled side-scan sonar frames
- **Benchmark accuracy:** 91.2% mAP@0.5
- **Output classes:** `corroded` · `exposed` · `intact` · `buried` · `damaged`
- **What users see:** An animated HTML canvas simulating a live side-scan sonar
  sweep. Colored bounding boxes appear from `metadata.bbox` in the inference
  log. Colors: red=corroded, orange=exposed, green=intact, grey=buried,
  amber=damaged. A scan-line sweeps the canvas in real time for the "live
  acquisition" feel. Below: confidence chart + paginated inference log.
- **Metadata fields:** `segment_id`, `pipeline_km`, `bbox [x1,y1,x2,y2]`, `depth_m`
- **Status:** DEMO — synthetic data seeded in Supabase

#### 2. Oil Spill / Pollution Detection (Score: 17/20)
- **Architecture:** UNet-ResNet50 (pixel-wise semantic segmentation)
- **Training data:** NKSID (2,400 SAR scenes) + SCS-GEO
- **Benchmark accuracy:** 89.4% F1 — 4-class segmentation
- **Output classes:** `oil_slick` · `look_alike` · `marine_debris` · `clean_water`
- **What users see:** A MapLibre GL map centred on the Gulf of Mexico. Spill
  extents are drawn as polygon fills from `metadata.polygon_geojson` (red for
  oil_slick, amber for look-alike, orange for debris). Individual detections
  appear as circle markers — click any for a popup with area km², satellite
  source, and confidence. Below: confidence chart + inference log.
- **Metadata fields:** `area_km2`, `satellite`, `polygon_geojson` (GeoJSON Polygon)
- **Status:** DEMO — synthetic detection events in Gulf of Mexico region

#### 3. Seismic / InSAR Deformation (Score: 16/20)
- **Architecture:** ResNet50 fine-tuned (CNN + Transfer Learning)
- **Training data:** SCS-GEO + GPS ground-truth — 3,800 interferogram pairs
- **Benchmark accuracy:** 88.7% F1 — 4-class classification
- **Output classes:** `subsidence` · `uplift` · `volcanic` · `no_deformation`
- **What users see:** An ECharts HeatmapChart using interferogram colour
  convention (blue → yellow → red). Each cell = one 0.1° lat/lon bucket;
  colour encodes max surface displacement in centimetres. This is the
  "interferogram analog" — same visual language as SAR products scientists use.
  Below: confidence chart + inference log.
- **Metadata fields:** `max_displacement_cm`, `event_date`, `coherence`, `interferogram_id`
- **Status:** DEMO — synthetic events in California, Turkey, and Japan

### Tier 2 — Build next (requires proprietary fleet data at scale)

#### 4. Marine Biota Classification (Score: 14/20)
- **Architecture:** EfficientNet-B4 (CNN + Transfer Learning from ImageNet)
- **Training data:** MBARI ROV Catalog — 1M+ labeled frames, 230+ species
- **What users see:** A simulated ROV frame with a fish SVG and bioluminescence
  overlay. The top detected species and confidence appear in the corner. Below:
  a horizontal bar chart showing average confidence per species across the last
  50 inference events, plus the inference log.
- **Metadata fields:** `depth_m`, `rov_frame`
- **Status:** TRAINING — goes LIVE once DataSnake AUV fleet generates ~50k
  annotated frames

#### 5–7. Remaining Tier 2/3 models
Shown as cards on the hub with PLANNED status. These need either specialized
hardware or long-horizon data collection. Cards show tier badge, composite
score, and dataset citation.

---

## What a user does on each page

1. **Lands on `/ai-models`** — sees all 7 model cards sorted by score. Each
   card: tier badge (T1/T2/T3), score /20, status chip (DEMO/TRAINING/PLANNED),
   dataset name, benchmark accuracy. Tier 1 and Marine Biota cards link to
   their detail pages.

2. **On a detail page** — reads the model header (4-tile grid: architecture,
   dataset, benchmark, status), sees the primary visualization, scrolls to the
   confidence chart and inference log. The SQL panel at the bottom shows the
   exact Postgres query that produced the data — copyable for reproduction.

3. **Inference log** — last 50 detection events: timestamp, input source
   (sensor ID), detected class (colour-coded chip), confidence bar, and 2 key
   metadata fields. "Show more" button exposes older rows.

4. **Glossary** — 5 sections: Model Architecture, Model Tiers, Inference &
   Evaluation, Datasets, Monitoring Concepts. Reference for non-technical
   stakeholders.

---

## Runtime input parameters

### Phase 10.0 (live now)
- All pages load the last 50 inference results on mount.
- "Show more" in the inference log exposes additional rows.
- Confidence chart auto-groups by class, showing max confidence per class.

### Phase 10.1 — planned client-side filters (no extra SQL)
These would filter the already-fetched result set in-memory:

| Control | What it does |
|---------|-------------|
| Confidence threshold slider | Hide rows below e.g. 0.80 confidence |
| Class filter checkboxes | Show only selected classes (e.g. corroded + damaged) |
| Date range picker | Narrow the log to a time window |
| Row count selector | Load 25 / 50 / 100 / 200 rows |
| Pipeline: bbox opacity slider | Dim low-confidence bounding boxes on canvas |
| Oil spill: layer toggle | Switch between polygon fills and point markers |
| Seismic: displacement threshold | Hide heatmap cells below X cm displacement |

All filter controls update the SQL panel display to reflect the current
parameters — so the query shown remains reproducible.

---

## Database schema

```sql
-- All 7 models
public.model_registry
  slug PK, name, tier (1|2|3), score (0-20), status, architecture,
  dataset_name, dataset_url, accuracy_pct, description, created_at

-- One row per detection event
public.model_inference_log
  id bigint, model_slug FK, input_source, detected_class,
  confidence (0-1), lat, lon, location geography(point,4326),
  metadata jsonb, inferred_at timestamptz

-- RPC called by every model detail page
public.model_inference_results(p_slug text, p_limit int default 50)
  → id, input_source, detected_class, confidence, lat, lon, metadata, inferred_at
```

---

## Frontend file map

```
src/
├── types/aiModels.ts                   Types, tab unions, route constants
├── services/aiModels.ts                fetchModelRegistry(), fetchInferenceResults()
└── features/ai-models/
    ├── ModelHubView.vue                /ai-models — 7 model cards
    ├── PipelineDetectionView.vue       /ai-models/pipeline-detection
    ├── OilSpillView.vue                /ai-models/oil-spill
    ├── SeismicInSARView.vue            /ai-models/seismic-insar
    ├── MarineBiotaView.vue             /ai-models/marine-biota
    ├── AIGlossaryView.vue              /ai-models/glossary
    └── components/
        ├── AIModelTabStrip.vue         Sticky tab nav across all /ai-models/* pages
        ├── ModelCard.vue               Single model card (hub grid)
        ├── ConfidenceChart.vue         ECharts horizontal bar: class → max confidence
        └── InferenceLogTable.vue       Paginated inference log with "Show more"
```

---

## Sidebar navigation

The "AI Models" link appears under the **Verticals** section in the sidebar
(alongside Insurance and Weather Intelligence). It uses a brain/neural-net SVG
icon. The link and icon are only visible after the branch is **deployed or
merged to main** on Cloudflare Pages. If you are on the production URL
(hyperlocalwatch.com) and don't see the link, the branch hasn't been merged yet.

---

## Deployment checklist

1. Run migration `0044_ai_model_registry.sql` — creates `model_registry`
2. Run migration `0045_ai_inference_log.sql` — creates `model_inference_log` + RPC
3. Run migration `0046_ai_seed_data.sql` — inserts 7 models + ~90 inference rows
4. Merge branch `claude/terrawatch-redesign-dMM0l` to main → Cloudflare redeploys
5. Visit `/ai-models` — "AI Models" appears in sidebar under Verticals
6. Confirm each tab loads: Overview, Pipeline, Oil Spill, Seismic InSAR, Marine Biota, Glossary

Run `supabase/verify/verify_ai_setup.sql` at any time to confirm the DB state.
Key checks: `model_count = 7`, `total_inference_rows >= 90`, both RLS policies
present, `anon` role can execute the RPC.

> Migrations are idempotent — safe to re-run. Tables use `IF NOT EXISTS`,
> policies use `DROP IF EXISTS` before re-create, RPC uses `CREATE OR REPLACE`.
