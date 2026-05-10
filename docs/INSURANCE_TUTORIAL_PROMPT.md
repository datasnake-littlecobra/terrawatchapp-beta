# Tutorial Prompt — DataSnake Insurance Intelligence + Founder's Field Guide

Paste this entire document into a fresh Claude (or Cursor) chat. The
goal is **one combined Markdown deliverable** that does two things:

1. A **6-module learning roadmap** for the founder (a non-actuary, non-
   geophysicist with strong data-engineering chops) — what to study to
   internalize the full DataSnake business, in priority order.
2. A **dashboard field guide** explaining every analytic on the
   `/insurance` and `/insurance/*` pages of TerraWatch
   (hyperlocalwatch.com) in plain English, with worked examples — read
   while looking at the live dashboard each morning.

The two parts must cross-reference each other: each dashboard module
should cite which curriculum module(s) it draws from, and each
curriculum module should call out which dashboard surfaces apply it
in practice. That way the founder's morning dashboard glance becomes
a spaced-repetition study session.

Output: one Markdown document the founder can save as
`docs/INSURANCE_FIELD_GUIDE.md` and reread every morning. ~5,500 -
7,000 words. Each section self-contained — they should be able to
land on any heading and get value in 30 seconds.

---

## Audience

Single reader: a founder building DataSnake — an environmental-data
platform that sells climate-risk intelligence into the insurance
market via on-ground sensors, autonomous submarines, and public-feed
ingestion. They are literate in tech (data engineering / cloud
infrastructure) but not in catastrophe modeling, parametric trigger
contracts, EP curves, oceanography, or actuarial science.

Tone: rigorous but plain-spoken. No condescension; no jargon without
a definition; no hand-waving. If something is genuinely uncertain or
calibrated rather than measured, say so.

---

## Part A — Founder's 6-Module Learning Roadmap

Open the document with a 350-500 word framing piece titled **"Why this
order"** that explains: DataSnake sits at the intersection of climate
science (Module 1), sensor engineering (Module 2), data engineering
(Module 3 — already strong), risk modeling (Module 4), visualization
(Module 5), and insurance economics (Module 6). The order is deliberate
— each module's output is the next module's input. Then list the
modules in order, each as its own H2 with H3 subsections per the spec
below.

### For each curriculum module, include:

- **What it is.** Two-sentence definition.
- **Why it matters for DataSnake.** One paragraph tying the topic to
  the platform's revenue path. (E.g. "Without ocean-pressure
  intuition you can't credibly explain to a parametric underwriter
  why our submarine sensor reading is the right trigger fidelity.")
- **The 4-6 sub-topics to actually study.** From the source curriculum
  below. Add one-line descriptions per sub-topic.
- **Concrete recommended resources.** 3-5 free-to-cheap items:
  textbooks (only if essential), MIT OCW / Coursera lectures,
  industry whitepapers, key public datasets to play with, classic
  papers. Cite by name + author/source so the reader can search.
- **What "I get it" looks like.** A 2-3 sentence test of mastery,
  ideally framed as "you can answer X to a partner without prep."
- **Where it shows up on the dashboard.** Cross-reference the
  specific `/insurance/*` modules in Part B that apply this knowledge.
- **Estimated study time.** Realistic hours-per-week assuming a
  founder's schedule (e.g. "4-6 hrs/week × 4 weeks").

### The 6 modules to cover (use the source curriculum verbatim, expanded with the structure above):

#### Module 1 — Environmental Systems
Topics to learn:
- seismic basics (plate tectonics, magnitude/intensity, P/S waves, b-value)
- ocean pressure (hydrostatic, surge, tsunami DART buoys)
- tides (semidiurnal/diurnal, lunar/solar drivers, tide gauges)
- flood systems (riverine vs coastal vs pluvial, stage-discharge curves)
- erosion (coastal retreat, soil instability)
- climate patterns (ENSO, NAO, polar vortex, hurricane climatology)

**Goal:** understand signal sources — what nature is doing that the
sensors measure.

#### Module 2 — Sensor Engineering
Topics to learn:
- IoT systems (LoRaWAN, NB-IoT, MQTT)
- telemetry (cadence, payload design, deduplication)
- underwater communications (acoustic modems, surface relay, latency)
- edge computing (on-device filtering, anomaly pre-detection)
- low-power systems (battery chemistry, duty cycling, harvesting)

**Goal:** understand data acquisition — how raw signal becomes
ingestable bits.

#### Module 3 — Data Engineering (founder's strong area; light coverage)
Topics to keep sharp:
- streaming (Kafka, RabbitMQ, MQTT-to-stream bridges)
- geospatial systems (PostGIS, H3, S2, GeoJSON, vector tiles)
- time-series databases (TimescaleDB, hypertables, continuous aggregates)
- real-time analytics (windowed aggregates, late-arrival semantics)

**Goal:** build the infrastructure that turns telemetry into analytic
substrate.

#### Module 4 — Risk Modeling
Topics to learn:
- probability (frequentist + Bayesian, return-period intuition)
- catastrophe models (event sets, vulnerability curves, financial modules)
- actuarial basics (rating factors, loss ratios, combined ratio)
- risk scoring (composite indices, normalization, peril weighting)
- anomaly detection (time-series anomalies, spatial outlier detection)

**Goal:** translate science into business — convert measured signal
into priced exposure.

#### Module 5 — Visualization
Topics to learn:
- GIS mapping (web-Mercator, vector tiles, choropleth)
- heatmaps (kernel density, hex binning, H3 visualization)
- predictive dashboards (chart grammar, KPI strip patterns)
- digital twins (geospatial replicas, BIM/CIM overlays)

**Goal:** make risk understandable instantly — five seconds to "yes I
get the headline, now show me the why."

#### Module 6 — Insurance Economics
Topics to learn:
- underwriting (risk selection, exposure aggregation, peril treaties)
- premiums (rating, base + multipliers, catastrophe loading)
- reinsurance (treaty vs facultative, attachment + limit, layered cover)
- catastrophe reserves (IBNR, capital adequacy, regulatory minima)
- claims modeling (loss development, severity vs frequency)

**Goal:** understand the buyer's incentives — why a $200K saving in
modeled loss matters more than a $200K saving in compute cost.

### Close Part A with a 200-word framing piece titled **"The Big Realization"** built around this table:

| Industry | Why it matters |
|---|---|
| Climate | Earth monitoring |
| Insurance | Risk pricing |
| Infrastructure | Protection |
| AI | Prediction |
| IoT | Sensors |
| Geospatial | Mapping |
| Data Engineering | Pipelines |
| Defense | Strategic monitoring |

The framing should articulate that DataSnake's defensibility comes
from sitting at the intersection of all eight, and that the
6-module curriculum is exactly what compounds that intersection into
a personal moat for the founder.

---

## Part B — Dashboard Field Guide

After the curriculum, transition with a one-paragraph bridge:
**"Now: how to read the dashboard each morning"**, then dive into the
seven sub-routes.

### The dashboard surface to explain (all live at hyperlocalwatch.com/insurance/*)

1. **`/insurance` — Overview.** Real public-data baseline.
   - Hero counters: counties indexed (~3,200), total US Expected
     Annual Loss ($), high-risk counties (risk score ≥ 80),
     live-threats-in-high-risk-states (last 24h).
   - Bar chart: total EAL by US state, top 20.
   - County detail panel: composite scores + per-hazard EAL bar
     chart (flood, wildfire, hurricane, tornado, earthquake) for the
     selected county.
   - Top-10 by hazard: flood / wildfire / hurricane (clickable).
   - Active-threat strip: last-24h elevated events from our live
     events pipeline, joined to high-risk counties by state name.
   - DataSnake gap callout.
   - Sources: FEMA National Risk Index v3 (county-level, annual);
     live multi-source events pipeline (USGS, NWS, NOAA NHC, EONET,
     GDACS, Smithsonian volcanoes).

2. **`/insurance/verdict` — Risk Verdict.** Demo data.
   - Type a city, get a single panel: circular 0-100 risk meter,
     verdict label (CRITICAL / HIGH / ELEVATED / MODERATE / LOW),
     premium multiplier, AAL multiplier, 5-peril breakdown bars
     (flood / seismic / wind / wildfire / surge), 4-5 sensor-driven
     "key factors" citing specific DataSnake nodes, data-source
     pills, confidence bar, last-updated indicator.

3. **`/insurance/map` — Command Center.** Demo data.
   - MapLibre map with circle markers per city (size = $ exposure,
     color = composite risk score). Layer toggles: All / Flood /
     Seismic / Wind / Wildfire / Storm Surge.
   - KPI strip: total exposure monitored, high-risk zones,
     rising-risk alerts, sensors active.
   - Sidebar: rising-risk markets list.
   - Click any marker → routes to /insurance/verdict pre-loaded.

4. **`/insurance/ep-curves` — EP Curve + Premium Impact.** Demo data.
   - Line chart: legacy CAT-model baseline vs DataSnake-enhanced
     across return periods (10/25/50/100/200/500yr).
   - Peril selector: combined / flood / seismic / wind.
   - Annotated callout at 1-in-100yr ("$3.1B saving").
   - Detail table: per-RP baseline, sensor, $ saving, % reduction.

5. **`/insurance/parametric` — Parametric Trigger Monitor.** Demo data.
   - 6 active mock contracts (storm surge, seismic, fire-weather
     index, wave height, tsunami DART, agriculture rainfall deficit).
   - Per-contract row: status pill (TRIGGERED / WARNING / MONITORING
     / CLEAR), threshold, current reading, sensor ID, payout $,
     24-hour sparkline, audit indicators (signed, timestamped,
     log-retained).
   - KPI strip: counts per status, $ payout at risk.
   - Compliance disclaimer: DataSnake = system-of-record for
     parametric trigger validation.

6. **`/insurance/portfolio` — Portfolio Risk Aggregation.** Demo data.
   - 100+ synthetic policies across ~15 regions.
   - KPIs: total exposure, % high-risk (with what % of $ they drive),
     % mispriced (under/over), recommended reserve adjustment.
   - 80/20 callout.
   - Distribution bar+line chart: policies (bars) + exposure (line)
     per risk-score bucket.
   - Pricing scatter: each policy as a dot on (risk score, exposure)
     axes, colored by underpriced/correct/overpriced.
   - Peril × region heatmap: $B exposure per (peril, region).
   - Accumulation zones list: top regions by aggregated high-risk
     exposure.

7. **`/insurance/claims` — Claims Validation.** Demo data.
   - Event picker (2 mock events: Gulf storm, Bay Area tremor).
   - Recorded peaks: surge / wind / rain / PGA.
   - Per-claim table: claim ID, location, claimed-damage tier,
     amount, sensor reading at the claim coords, threshold for the
     damage tier, ratio bar (recorded vs required), verdict
     (CONSISTENT / INCONSISTENT / INSUFFICIENT).
   - Adjuster-notes panel for inconsistent + insufficient claims.

Modules 2-7 carry a **DEMO DATA — DataSnake fleet preview** badge in
the header. Module 1 (Overview) is real public-data + live events.

### For each dashboard module (1-7), produce these subsections in order:

1. **One-sentence summary.** What it answers in plain English.
2. **The audience moment.** Who reads this and what decision it
   informs (underwriter pricing? CFO reserve? Adjuster fraud-flag?
   Reinsurer accumulation review? Investor pitch?).
3. **The actual numbers — what they mean.** Define every metric on
   screen with units. For composite scores, explain construction
   (even directionally — "weighted blend of peril sub-scores and
   exposure modifiers").
4. **A worked example.** Walk through one data point and what an
   underwriter would actually do with it. Use the demo data already
   on the page (Miami Beach risk score 87, New Orleans 84, the Iowa
   Cornbelt parametric TRIGGERED, etc.). Format: **Scenario** /
   **Inputs** / **Output** / **Action taken**.
5. **The 30-second pitch.** If a partner sees this for the first
   time, what's the one-line takeaway?
6. **What's NOT in this view (yet).** Honest limitations.
7. **What DataSnake's full sensor fleet would add.** What changes
   when proprietary data replaces public-data baselines or fills
   gaps. (Pull from the existing GapCallout copy where helpful but
   rewrite for clarity.)
8. **Curriculum cross-reference.** "To deeply understand what's on
   this page, lean on Module {X} ({topic}) and Module {Y}
   ({topic}) from Part A."

---

## Part C — Domain primer (insert between Part A and Part B)

A 600-800 word **"Insurance for builders"** primer covering:

- The three players the dashboard speaks to:
  - **Insurers** — write policies, take premium.
  - **Reinsurers** — buy CAT cover from insurers, run aggregate-
    portfolio models.
  - **Parametric underwriters** — write contracts that pay out on a
    measured trigger regardless of underlying loss.
- Core terminology in plain English with one example each: AAL
  (Average Annual Loss), EAL (Expected Annual Loss), PML (Probable
  Maximum Loss), Return Period, EP Curve, Premium Multiplier,
  Composite Risk Score, AAL multiplier, Capital Charge,
  Accumulation, Concentration Risk, Parametric Trigger, Threshold,
  Indemnity vs Parametric, Adjuster.
- Why climate-data-driven underwriting matters NOW: sea-level rise
  trend, wildfire-WUI growth, secondary perils (convective storm,
  flood) historically under-priced because they were modeled with
  inferred frequencies rather than measured intensities.
- Where DataSnake fits: ground-truth sensors (submarine, on-ground,
  met) provide directly-measured intensities at parametric-grade
  fidelity, replacing or augmenting catalog-inferred priors.

---

## Part D — Daily-read checklist (closes the document)

A scannable single-page section titled **"Open the dashboard.
Run this checklist."** with 8-10 prompts the founder can ask
themselves each morning. Each prompt should:

- Cite the route to look at.
- Ask a specific yes/no or numeric question.
- Note what to do if the answer is surprising.

Examples (rewrite better):
- "/insurance Overview: how many high-risk counties today, and is
  it different from yesterday by more than 5%? If yes, ask Terra
  what's driving the shift."
- "/insurance/parametric: are any contracts in TRIGGERED or WARNING
  state? If yes, note the contract ID, the trigger value, and the
  payout $. That's a pitch story for today."
- "/insurance/portfolio: open the pricing scatter. Where are the
  red dots clustered? Those regions are the next reinsurer
  conversation."

---

## Style + format requirements

- One H1 (`#`) at the top: **"DataSnake Insurance Intelligence —
  Founder's Field Guide"**.
- One H2 per: Why this order; each curriculum module (×6); The Big
  Realization; Insurance for builders (the primer); each dashboard
  module (×7); Open the dashboard. Run this checklist.
- H3 (`###`) for the subsections inside each module.
- Inline math is fine but no LaTeX — readable plain-text formulas.
- Short paragraphs (≤ 4 sentences). Lists where lists belong.
- Define each acronym **on first use within each module**. Repeat
  the definition; don't make me scroll back.
- Every cross-reference uses the literal section name in
  parentheses, e.g. "(see Module 4 — Risk Modeling)".
- Avoid hype words ("revolutionary", "game-changing", "industry-
  leading"). Concrete, calibrated, grounded.
- Optimize for re-readability: someone glancing for 30 seconds in the
  morning should land on any section and get value immediately.

---

## Calibration notes (use these honestly throughout)

- Numbers in dashboard modules 2-7 are CALIBRATED demo values —
  directionally correct against public benchmarks (FEMA NRI, NOAA
  SLR, NHC hurricane climatology, USGS UCERF3, CalFire, Lloyd's
  parametric structures) but NOT real customer policy data. The
  field guide must flag this when discussing absolute figures so
  the reader doesn't cite them as live numbers.
- Module 1 (Overview / FEMA NRI) IS real public data — sourced
  annually from FEMA's National Risk Index v3. The active-threat
  strip uses our live ingest pipeline.

---

## Output

A single Markdown file. ~5,500-7,000 words. No fluff intro
paragraph; jump straight into Part A's "Why this order", then the
curriculum, then The Big Realization, then the Insurance primer,
then the dashboard modules, then the daily checklist.

End the document with:

> _Generated as a daily-read field guide for DataSnake. Last
> updated: <date>._
> _Pair this with `/ask` (Ask Terra) when a section sparks a
> question — Terra has access to the live events pipeline._

---

## (Optional) Follow-up prompts for later iterations

Save these for after the field guide lands:

1. "Now produce a 5-minute partner-pitch deck (slide outline only)
   for a reinsurer based on this guide."
2. "Now produce a 10-question FAQ for an insurance buyer skeptical
   that sensor data tightens CAT modeling."
3. "Now write a one-page LinkedIn post (≤ 1,300 chars) summarising
   the most-investor-friendly insight from this guide."
4. "Now produce three sample weekly-newsletter blurbs (each ≤ 200
   words) — one per audience: insurer, reinsurer, parametric buyer."
5. "Now produce a study schedule turning Part A into a 12-week
   evening program (4-6 hours/week), with specific weekly readings
   and one practical exercise per week (e.g. 'fit a Gutenberg-
   Richter b-value to the last 30 days of USGS quakes')."
