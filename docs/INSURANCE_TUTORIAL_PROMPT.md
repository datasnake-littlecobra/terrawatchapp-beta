# Tutorial Prompt — DataSnake Insurance Intelligence

Paste this entire document into a fresh Claude (or Cursor) chat. The
goal is a **field guide / daily-read tutorial** that explains every
analytic on the `/insurance` and `/insurance/*` pages of TerraWatch
(hyperlocalwatch.com) in plain English, using small worked examples
where helpful.

The output should be one Markdown document I can save as
`docs/INSURANCE_FIELD_GUIDE.md` and read every morning while looking
at the live dashboard. Aim for ~3,000-4,500 words. Sections must be
self-contained — I should be able to read just one section in a
30-second elevator-deck moment.

---

## Audience

The author of this prompt is a non-actuary founder building an
environmental-data platform (DataSnake) that sells climate-risk
intelligence into the insurance market. The dashboard exists as a
partner-pitch + investor-narrative + product-demo asset. They are
literate in tech but not in catastrophe modeling, parametric trigger
contracts, EP curves, or reinsurance accounting.

Tone: rigorous but plain-spoken. No condescension; no jargon without
a definition; no hand-waving. If something is genuinely uncertain or
calibrated rather than measured, say so.

## What's been built (the surface to explain)

Seven sub-routes under `/insurance` on hyperlocalwatch.com, all
mobile-responsive:

1. **`/insurance` — Overview.** Real public-data baseline.
   - Hero counters: counties indexed (~3,200), total US Expected
     Annual Loss ($), high-risk counties (risk score ≥80),
     live-threats-in-high-risk-states (last 24h).
   - Bar chart: total EAL by US state, top 20.
   - County detail panel: composite scores + per-hazard EAL bar
     chart (flood, wildfire, hurricane, tornado, earthquake) for the
     selected county.
   - Top-10 by hazard: flood / wildfire / hurricane (clickable).
   - Active-threat strip: last-24h elevated events from our live
     events pipeline, joined to high-risk counties by state name.
   - DataSnake gap callout.
   - Source: FEMA National Risk Index (county-level, annual cadence)
     plus our live multi-source events pipeline (USGS, NWS, NOAA NHC,
     EONET, GDACS, etc.).

2. **`/insurance/verdict` — Risk Verdict.** Demo data.
   - Type a city, get a single panel: circular 0-100 risk meter,
     verdict label (CRITICAL / HIGH / ELEVATED / MODERATE / LOW),
     premium multiplier, AAL multiplier, 5-peril breakdown bars
     (flood / seismic / wind / wildfire / surge), 4-5 sensor-driven
     "key factors" citing specific DataSnake nodes, data-source
     pills, confidence bar, last-updated indicator.

3. **`/insurance/map` — Command Center.** Demo data.
   - MapLibre map with circle markers per city (size = $ exposure,
     color = risk score 0-100). Layer toggles: All perils / Flood /
     Seismic / Wind / Wildfire / Storm Surge.
   - KPI strip: total exposure monitored ($), high-risk zones,
     rising-risk alerts, sensors active.
   - Sidebar: "Rising-risk markets" — top markets trending up.
   - Click any marker → routes to /insurance/verdict pre-loaded for
     that city.

4. **`/insurance/ep-curves` — EP Curve + Premium Impact.** Demo data.
   - Line chart: legacy CAT-model baseline vs DataSnake-enhanced,
     plotted across return periods (10/25/50/100/200/500yr).
   - Peril selector: combined / flood / seismic / wind.
   - Annotated callout at 1-in-100yr ("$3.1B saving").
   - Detail table: per-RP baseline, sensor, $ saving, percent reduction.

5. **`/insurance/parametric` — Parametric Trigger Monitor.** Demo data.
   - 6 active mock contracts (storm surge, seismic, fire-weather
     index, wave height, tsunami DART, agriculture rainfall deficit).
   - Per-contract row: status pill (TRIGGERED / WARNING / MONITORING
     / CLEAR), threshold, current reading, sensor ID, payout $,
     24-hour sparkline, audit indicators (signed/timestamped/
     log-retained).
   - KPI strip: counts per status, $ payout at risk.
   - Compliance disclaimer: DataSnake is the system-of-record for
     parametric trigger validation.

6. **`/insurance/portfolio` — Portfolio Risk Aggregation.** Demo data.
   - 100+ synthetic policies across ~15 regions.
   - KPI strip: total exposure, % high-risk (with what % of $ they
     drive), % mispriced (under/over), recommended reserve adjustment.
   - 80/20 callout.
   - Distribution bar chart: policies (bars) + exposure (line) per
     risk-score bucket.
   - Pricing scatter: each policy as a dot on (risk score, exposure)
     axes, colored by underpriced/correct/overpriced classification.
   - Peril × region heatmap: $B exposure per (peril, region) cell.
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

## What I want the tutorial to do — for each module

For each module, produce a section with these subsections in order:

1. **One-sentence summary.** What it answers in plain English.
2. **The audience moment.** Who reads this and what decision it
   informs. (Underwriter pricing? CFO reserve? Adjuster fraud-flag?
   Reinsurer accumulation review? Investor pitch?)
3. **The actual numbers — what they mean.** Define every metric
   shown on screen, with units. For composite scores explain how
   they're constructed (even if directionally — "weighted blend of
   peril sub-scores and exposure modifiers").
4. **A worked example.** Walk through one real or representative
   data point and what an underwriter would actually do with it.
   Use the demo data already on the page (Miami Beach risk score 87,
   New Orleans 84, the Iowa Cornbelt parametric TRIGGERED, etc.).
5. **The 30-second pitch.** If a partner sees this for the first
   time, what's the one-line takeaway?
6. **What's NOT in this view (yet).** Honest limitations. E.g. for
   the FEMA Overview: it's annual, county-level, US-only.
7. **What DataSnake's full sensor fleet would add.** What changes
   when proprietary data replaces public-data baselines or fills
   gaps. (Pull from the existing GapCallout copy where helpful but
   rewrite for clarity.)

## Domain primer to include up front (before the modules)

A 600-800 word **"Insurance for builders"** primer covering:

- The three players the dashboard speaks to: **insurers**
  (write policies, take premium), **reinsurers** (buy CAT cover from
  insurers, run aggregate-portfolio models), **parametric
  underwriters** (write contracts that pay out on a measured trigger
  regardless of underlying loss).
- Core terminology defined in plain English with one example each:
  AAL (Average Annual Loss), EAL (Expected Annual Loss),
  PML (Probable Maximum Loss), Return Period, EP Curve,
  Premium Multiplier, Composite Risk Score, AAL multiplier,
  Capital Charge, Accumulation, Concentration Risk,
  Parametric Trigger, Threshold, Indemnity vs Parametric, Adjuster.
- Why climate-data-driven underwriting matters NOW: sea-level rise
  trend, wildfire-WUI growth, secondary perils (convective storm,
  flood) historically under-priced because they were modeled with
  inferred frequencies rather than measured intensities.
- Where DataSnake fits: ground-truth sensors (submarine, on-ground,
  met) provide directly-measured intensities at parametric-grade
  fidelity, replacing or augmenting catalog-inferred priors.

## Style + format requirements

- One H1 (`#`) at the top: "DataSnake Insurance Intelligence — Field
  Guide".
- One H2 (`##`) per module + one for the primer.
- H3 (`###`) for the seven subsections inside each module.
- Inline math is fine but no LaTeX — readable plain-text formulas.
- Short paragraphs (≤ 4 sentences). Lists where lists belong.
- Define each acronym **on first use within each module**. Repeat
  the definition; don't make me scroll back.
- For the Worked Example subsections, format as: **Scenario.** /
  **Inputs.** / **Output.** / **Action taken.** so I can scan it.
- End with a "Daily-read checklist" page: 6-8 quick prompts I can
  ask myself each morning while looking at the dashboard, e.g.
  "What's the highest risk score on the Command Center map today,
  and is it rising or stable?"

## Calibration notes (use these honestly)

- Numbers in modules 2-7 are CALIBRATED demo values, directionally
  correct against public benchmarks (FEMA NRI, NOAA SLR, NHC
  hurricane climatology, USGS UCERF3, CalFire, Lloyd's parametric
  structures) but NOT real customer policy data. The tutorial must
  flag this when discussing absolute figures so the reader doesn't
  cite them as live numbers.
- Module 1 (Overview / FEMA NRI) IS real public data — sourced
  annually from FEMA's National Risk Index v3. The active-threat
  strip uses our live ingest pipeline (USGS quakes, NWS alerts,
  EONET fires, GDACS, Smithsonian volcanoes, etc.).

## Output

A single Markdown file. ~3,000-4,500 words. No fluff intro
paragraph; jump straight into the primer, then the modules, then the
daily checklist. Optimize for re-readability: someone glancing for
30 seconds in the morning should be able to land on any section and
get value immediately.

When you're done, end the document with:

> _Generated as a daily-read field guide for the DataSnake Insurance
> Intelligence dashboard at hyperlocalwatch.com/insurance. Last
> updated: <date>._

---

## (Optional) Follow-up prompts to use AFTER the tutorial lands

Save these for later iterations once the field guide exists:

1. "Now produce a 5-minute partner-pitch deck (slide outline only) for
   a reinsurer based on this guide."
2. "Now produce a 10-question FAQ for an insurance buyer skeptical
   that sensor data tightens CAT modeling."
3. "Now write a one-page LinkedIn post (≤1,300 chars) summarising the
   most-investor-friendly insight from this guide."
4. "Now produce three sample weekly-newsletter blurbs (each ≤200
   words) — one per audience: insurer, reinsurer, parametric buyer."
