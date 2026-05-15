// TerraWatch — Phase 9.12.2: per-card explainer content registry.
//
// One entry per metric-bearing card across the seven /insurance/* tabs.
// Each entry follows the MetricExplainer shape (see src/types/explainer.ts):
// formula(s) + source line + the four prose blocks (observation → risk
// → financial → business). Formulas come from docs/INSURANCE_SQL_WORKBOOK.md
// where possible so the inline panels stay aligned with the canonical
// math. Narrative is condensed from docs/INSURANCE_LAYMAN_EXPLAINER.md.
//
// Calibration semantics (see CalibrationBadge.vue):
//   - LIVE       → queried against public.fema_nri / public.events
//   - CALIBRATED → mock, but calibrated against published benchmarks
//   - DERIVED    → computed from other dashboard inputs

import type { MetricExplainer } from '@/types/explainer'

export const EXPLAINERS: Record<string, MetricExplainer> = {
  // =================================================================
  // Tab 1 — Overview ( /insurance ) — all LIVE against public.fema_nri
  // =================================================================

  'overview.hero-counters': {
    id: 'overview.hero-counters',
    title: 'Counters: counties indexed, total EAL, high-risk counties, live threats',
    tab: 'overview',
    tabLabel: 'Overview',
    calibration: 'live',
    sourceLine: 'public.fema_nri (FEMA NRI v3, annual) + public.events (live ingest, hourly cron)',
    formulas: [
      { label: 'Counties indexed',  expression: 'count(*) from public.fema_nri',                explanation: 'Every US county FEMA scored in the latest NRI release.' },
      { label: 'Total EAL',         expression: 'sum(expected_annual_loss_total)',              explanation: 'Sum of the EAL_VALT column across every county. EAL_VALT is FEMA\'s composite Expected Annual Loss in dollars, summed across all 18 modeled hazards.' },
      { label: 'High-risk counties', expression: 'count(*) where risk_score >= 80',             explanation: 'Counties FEMA placed in the top risk band. The 80-cutoff is the conventional "Very High" threshold from the NRI methodology.' },
      { label: 'Live threats',       expression: 'distinct states in events (last 24h, elevated) ∩ states with high-risk counties', explanation: 'Cross-references the live events feed (USGS quakes, NWS alerts, EONET wildfires, NHC tropical) against the set of high-risk states. Counts states with at least one elevated event in the last 24h.' },
    ],
    observation: 'Four numbers that frame the entire dashboard. Where the data comes from: a one-shot FEMA bulk load (~3,200 county rows) joined with the same continuously-ingested events table powering /alerts and /events.',
    risk_interpretation: 'The NRI score is a composite of expected loss × social vulnerability ÷ community resilience. A "high-risk county" means hazard frequency, dollar exposure, and population fragility all stack against the population there. The live threats column converts that static index into a real-time signal: which of those high-risk markets is actually elevated right now?',
    financial_interpretation: 'Total US EAL is FEMA\'s answer to "if you priced every parcel\'s catastrophe risk perfectly, what\'s the annual loss bill?" It sets the order-of-magnitude for the entire US property-cat market. High-risk county count is the addressable subset where premium adequacy matters most — those are the books where mispricing costs the most.',
    business_decision: 'An underwriter scans this row first. A spike in live threats inside high-risk counties means "today, lean conservative on new bind in those states." A drop in counties indexed (from a re-seed) means FEMA shifted its methodology — re-run sensitivity on the books.',
  },

  'overview.state-eal-chart': {
    id: 'overview.state-eal-chart',
    title: 'Total Expected Annual Loss by state',
    tab: 'overview',
    tabLabel: 'Overview',
    calibration: 'live',
    sourceLine: 'public.fema_nri grouped by state',
    formulas: [
      { label: 'State total EAL',  expression: 'sum(expected_annual_loss_total) group by state', explanation: 'EAL_VALT summed across every county in the state.' },
      { label: 'County count',     expression: 'count(*) group by state',                        explanation: 'Number of counties FEMA scored in that state. Larger states with many counties accumulate more total EAL even if per-county risk is moderate.' },
      { label: 'High-risk count',  expression: 'count(*) where risk_score >= 80 group by state', explanation: 'How many top-band counties live in this state — the "concentration of risk" indicator.' },
    ],
    observation: 'A horizontal bar chart of states ordered by total EAL. The biggest values are dominated by Texas, California, Florida — partly because they have many counties (size effect), partly because they have many catastrophic-hazard exposed counties (peril effect).',
    risk_interpretation: 'Total EAL by state is the natural unit for portfolio aggregation: most multi-state insurers think in state-level concentration limits. Reading the chart top-to-bottom tells you which states drive the bulk of US catastrophe loss.',
    financial_interpretation: 'Each bar represents the annual dollar loss FEMA expects across that state\'s entire built environment under historical climatology. A portfolio concentrated in the top-5 states is taking the bulk of the country\'s modeled cat exposure.',
    business_decision: 'A cat-modeling team uses this to set per-state PML targets and reinsurance treaty caps. A state-level underwriter uses it to decide whether to expand bind authority or pull back — if your top-3 states are also the top-3 here, you are concentrated.',
  },

  'overview.county-detail': {
    id: 'overview.county-detail',
    title: 'County detail panel: composite scores + per-hazard EAL breakdown',
    tab: 'overview',
    tabLabel: 'Overview',
    calibration: 'live',
    sourceLine: 'public.insurance_county_detail(fips) — single-row RPC + per-hazard EAL columns',
    formulas: [
      { label: 'Risk score',              expression: 'fema_nri.risk_score',                     explanation: 'FEMA\'s 0-100 composite for the county. Combines EAL, Social Vulnerability, and Community Resilience.' },
      { label: 'Social vulnerability',    expression: 'fema_nri.social_vulnerability',           explanation: 'Index from CDC SVI — how badly a community is positioned to absorb shock. Higher = more fragile.' },
      { label: 'Community resilience',    expression: 'fema_nri.community_resilience',           explanation: 'Index from BRIC — how well a community recovers. Higher = stronger.' },
      { label: 'Per-hazard EAL',          expression: 'eal_flood, eal_wildfire, eal_hurricane, eal_tornado, eal_earthquake', explanation: 'Five spotlight EAL columns. The remaining 13 NRI hazards roll into the eal_other jsonb.' },
    ],
    observation: 'Click any county in the top-N lists or any state in the chart to load this panel. It pulls one row from public.fema_nri and renders the composite scores plus a horizontal bar chart of EAL per peril.',
    risk_interpretation: 'The composite score answers "how risky overall?" The per-hazard breakdown answers "risky from what?" A county at score 85 driven 90% by flood is a fundamentally different underwriting decision from one at score 85 driven 50/50 by wildfire and seismic.',
    financial_interpretation: 'Sum of all per-hazard EAL values equals total EAL for the county. The shape of the bars tells the reinsurance buyer which peril treaty matters most for this geography — Florida coast → wind/surge dominated, Sonoma → wildfire dominated, Eastern Tennessee → tornado-flood mix.',
    business_decision: 'A cat-modeler uses this to validate vendor-model output ("AIR says 60% wind here, FEMA says 65% — within tolerance"). An underwriter uses it to set peril-specific exclusions in the policy form — if 80% of EAL is one peril, that peril\'s deductible and sublimit get the most attention.',
  },

  'overview.hazard-top-lists': {
    id: 'overview.hazard-top-lists',
    title: 'Top-10 counties by hazard (Flood / Wildfire / Hurricane)',
    tab: 'overview',
    tabLabel: 'Overview',
    calibration: 'live',
    sourceLine: 'public.insurance_top_counties_by_hazard(hazard, n)',
    formulas: [
      { label: 'Top-N for hazard X', expression: 'select * from fema_nri order by eal_<hazard> desc nulls last limit n', explanation: 'Pulls the N counties with the largest per-hazard EAL. Backed by a partial index per hazard column.' },
    ],
    observation: 'Three side-by-side lists for the three spotlight hazards. Each row is one county with its dollar EAL for that peril. Click any row to refocus the County Detail panel above.',
    risk_interpretation: 'These are the worst counties in the country for each peril. Flood top-10 is dominated by Mississippi River and Gulf-coast counties. Wildfire top-10 is California, Colorado, and the WUI in Oregon and Idaho. Hurricane top-10 is Florida and Gulf-coast Texas and Louisiana.',
    financial_interpretation: 'Per-hazard EAL is the dollar loss a perfectly-priced book would expect each year from this peril in this county. Summed across all top-10 counties for a peril, you usually get >20% of national EAL for that peril concentrated in <0.3% of US counties — the "fat tail" of cat exposure.',
    business_decision: 'A peril-specific underwriter (e.g. a flood reinsurer) reads only one of the three lists. The choice of which counties to bind, exclude, or surcharge for that single peril usually starts here. A multi-peril writer reads all three to find counties that show up in two or more — those are the structurally hardest to price.',
  },

  'overview.active-threats-strip': {
    id: 'overview.active-threats-strip',
    title: 'Active threat strip: live events in high-risk states',
    tab: 'overview',
    tabLabel: 'Overview',
    calibration: 'live',
    sourceLine: 'public.insurance_active_threats_in_high_risk(min_risk, n_states)',
    formulas: [
      { label: 'High-risk state set', expression: 'distinct state from fema_nri where risk_score >= min_risk',         explanation: 'Conventional cutoff: min_risk = 80. Any state containing at least one Very-High county counts.' },
      { label: 'Elevated events',     expression: 'select * from events where severity in (caution, danger) and occurred_at > now() - 24h', explanation: 'Joined on state-name match. Pulls from the same events table that powers /alerts and /events.' },
    ],
    observation: 'A horizontal strip across the bottom of the page showing the most recent elevated events from our live ingesters (USGS quakes M2.5+, NWS alerts, EONET wildfires, NHC tropical, SWPC space weather) that occurred in any state with at least one high-risk county.',
    risk_interpretation: 'The static FEMA index says "Florida is high-risk." The live strip says "Florida has an active hurricane warning right now." The combination is what makes the dashboard a real-time underwriting tool rather than an almanac.',
    financial_interpretation: 'Active threats in high-risk states drive immediate reserve adjustments — when a Cat-3 hurricane is in the Gulf, claims-reserving teams pre-fund Florida loss reserves before the storm landfalls. This strip is the trigger.',
    business_decision: 'A claims-ops manager refreshes this strip every morning. New elevated events in high-EAL states trigger pre-deployment of CAT adjusters. An underwriter watches it to time bind suspensions: an active hurricane warning is reason enough to pause new policies in the impact cone until landfall risk passes.',
  },

  // =================================================================
  // Tab 2 — Risk Verdict ( /insurance/verdict ) — CALIBRATED
  // =================================================================

  'verdict.risk-meter': {
    id: 'verdict.risk-meter',
    title: 'Address-level Risk Meter: composite score + premium and AAL multipliers',
    tab: 'verdict',
    tabLabel: 'Risk Verdict',
    calibration: 'calibrated',
    sourceLine: 'RISK_VERDICTS in src/data/insurance-mock.ts — calibrated against RMS 2018 multi-peril load factors',
    formulas: [
      { label: 'Risk score',          expression: 'composite(0..100) of peril severities × hazard × exposure', explanation: 'A weighted sum of the five peril sub-scores (flood, seismic, wind, wildfire, surge) calibrated so 100 ≈ uninsurable, 50 ≈ standard market.' },
      { label: 'Premium multiplier',  expression: '1 + (risk_score - 40) × k_p',                                explanation: 'Multiplier on the carrier\'s base rate. k_p is calibrated against RMS 2018 published load factors — at risk_score 80, premium runs ~3× standard market.' },
      { label: 'AAL multiplier',      expression: '1 + (risk_score - 40) × k_a',                                explanation: 'Multiplier on the portfolio\'s modeled Annual Aggregate Loss reserve. k_a is steeper than k_p because reserves track tail expectation, not mean.' },
    ],
    observation: 'A single risk meter (radial gauge) plus two stat tiles (premium × and AAL ×). Inputs are a property address (geocoded) and the calibrated peril sub-scores for that location.',
    risk_interpretation: 'The score is the underwriting summary — one number that captures "how bad is this address?" The multipliers translate that into dollars: how much more (or less) than a standard-market policy should cost, and how much to set aside for losses.',
    financial_interpretation: 'Premium multiplier × base rate × insured value = recommended premium. AAL multiplier × portfolio AAL = reserve adjustment for this risk. Both compound at the high end — a risk_score of 90 typically lands at ~4-6× premium and ~5-7× AAL.',
    business_decision: 'Underwriting committees use the meter as the first-pass decision: bind, modify, or decline. Multipliers feed directly into the rate-quote engine. Reinsurance buyers use the AAL × to set treaty layer attachment points for the at-risk policies.',
    assumptions: [
      'LOAD_FACTOR for "standard market" = 1.5× pure technical premium (industry convention).',
      'Premium multiplier capped at 5× — beyond that, most carriers decline rather than quote.',
      'AAL multiplier scaled to match cat-bond pricing observed in Lloyd\'s 2023 placements.',
    ],
  },

  'verdict.detail': {
    id: 'verdict.detail',
    title: 'Verdict detail: peril bars + sensor factors + data sources',
    tab: 'verdict',
    tabLabel: 'Risk Verdict',
    calibration: 'calibrated',
    sourceLine: 'RiskVerdict.perils / key_factors / data_sources in src/data/insurance-mock.ts',
    formulas: [
      { label: 'Peril bar height', expression: 'peril_score / 10',                       explanation: 'Each peril sub-score is on a 0-10 scale. The bar represents the share of the composite that peril contributes.' },
      { label: 'Confidence',       expression: '1 - σ(peril_scores) / 10',               explanation: 'Higher confidence when peril sub-scores agree across data sources; lower when readings disagree.' },
    ],
    observation: 'Five colored bars (one per peril), a list of sensor-driven factors that drove the score, and a row of pills naming the data sources. Each factor cites the specific sensor or dataset, so the verdict is auditable.',
    risk_interpretation: 'Peril bars tell you the composition of risk at this address. A risk_score of 72 driven by a 9.0 wildfire and a 2.0 flood reads differently from one driven by 5.0 flood and 5.0 wind — same total, different underwriting playbook.',
    financial_interpretation: 'The factor list defends the multipliers in front of a re-pricing committee. "Premium × 3.4 because (a) SLR-adjusted surge return-period dropped from 1-in-100 to 1-in-40, (b) wildfire WUI density increased 18% in 5 years, (c) building-stock vintage skews pre-1990." Each clause is auditable.',
    business_decision: 'Underwriters cite specific factors when issuing a non-standard quote. Reinsurance buyers use the source pills to confirm that the cedent\'s loss assumptions track the same models the reinsurer uses (RMS, AIR, FEMA NRI, NOAA).',
  },

  // =================================================================
  // Tab 3 — Command Center ( /insurance/map ) — CALIBRATED
  // =================================================================

  'map.kpi-strip': {
    id: 'map.kpi-strip',
    title: 'KPI strip: cells monitored, exposure, rising-risk count',
    tab: 'map',
    tabLabel: 'Command Center',
    calibration: 'calibrated',
    sourceLine: 'RISK_CELLS in src/data/insurance-mock.ts — calibrated against AIR Touchstone Re v9 + CRESTA AAL 2021',
    formulas: [
      { label: 'Cells monitored', expression: 'count(*) from risk_cells',                      explanation: 'Pseudo-H3 cells across the demo footprint. In production, swap for the real H3 cell table at resolution 7 (~5km hex).' },
      { label: 'Total exposure',  expression: 'sum(exposure_usd) from risk_cells',             explanation: 'Modeled insured value in billions of dollars across all cells.' },
      { label: 'Rising-risk',     expression: 'count(*) where trend = \'rising\'',             explanation: 'Cells whose composite risk score climbed in the trailing 30-day window. Trend is a derived field; the underlying source is the sensor-feed delta.' },
    ],
    observation: 'A row of stat tiles above the map. Each one rolls up the entire cell grid into a single headline number so the rest of the page reads in context.',
    risk_interpretation: 'Cells monitored is the network coverage. Exposure is the dollar amount the network is watching. Rising-risk is the operational urgency — how many cells got worse this month?',
    financial_interpretation: 'Rising-risk × average exposure per cell gives a back-of-envelope "dollars in motion." If 12 cells are trending and each cell averages $1.2B exposure, that is ~$14B of book value that needs re-pricing review this quarter.',
    business_decision: 'A portfolio-management team uses rising-risk as the worklist trigger — schedule re-inspection or re-pricing on those cells first. A CAT-modeling team uses exposure as the denominator for stress-testing scenarios.',
  },

  'map.markers': {
    id: 'map.markers',
    title: 'Map markers: color by score, size by exposure',
    tab: 'map',
    tabLabel: 'Command Center',
    calibration: 'calibrated',
    sourceLine: 'RISK_CELLS rendered via MapLibre GL — calibrated geographies (Miami, Houston, SF, NY tri-state, Sonoma County)',
    formulas: [
      { label: 'Marker color', expression: 'risk_score >= 80 → red, 60-80 → amber, 40-60 → blue, <40 → green', explanation: 'Three-tier severity color band — matches the rest of the app (danger / caution / accent / safe).' },
      { label: 'Marker size',  expression: 'sqrt(exposure_usd / 1e9) × k',                                     explanation: 'Square-root scaling so a 10× larger exposure shows as ~3× larger marker — perceptually accurate.' },
      { label: 'Trend ring',   expression: 'cell.trend in (rising, falling) → animated outer ring',            explanation: 'Visual indicator that the cell changed in the last 30 days. Static cells get no ring.' },
    ],
    observation: 'Each marker is one risk cell. Color encodes the composite score; size encodes the dollar exposure. Click to focus the rising-risk sidebar on that cell.',
    risk_interpretation: 'A small red marker is a high-risk but low-exposure cell — manageable. A large green marker is high-exposure but low-risk — also manageable. The problematic pattern is large + red, especially with a rising-trend ring.',
    financial_interpretation: 'The visual scan is the underwriter\'s "where is my book bleeding?" view. A cluster of large red rising-trend markers in a state where the carrier has high market share is a treaty-amendment conversation.',
    business_decision: 'Portfolio-management teams use this as a daily standup view — what changed since yesterday? Reinsurance buyers use it to argue for layer-shift on treaties: "we have $4B in newly-rising markers in your covered zone, we want the attachment lowered."',
  },

  'map.rising-risk-sidebar': {
    id: 'map.rising-risk-sidebar',
    title: 'Rising-risk markets sidebar: 30-day score deltas',
    tab: 'map',
    tabLabel: 'Command Center',
    calibration: 'calibrated',
    sourceLine: 'RISK_CELLS filtered to trend = \'rising\', ordered by score delta',
    formulas: [
      { label: 'Score delta',  expression: 'risk_score_now - risk_score_30d_ago',                explanation: 'Change in composite score over the trailing 30 days. Positive = worse, negative = better.' },
      { label: 'Trend label',  expression: 'delta > +5 → rising, delta < -5 → falling, else stable', explanation: 'Hysteresis band so small fluctuations do not trigger workflow.' },
    ],
    observation: 'A scrollable list of cells whose risk score climbed in the last 30 days. Each row shows the city, the new score, the delta in points, and the dominant peril driving the change.',
    risk_interpretation: 'Rising-risk is the leading indicator of loss-ratio deterioration. The geographies in the list this month are where claims volume is most likely to surprise next quarter.',
    financial_interpretation: 'A +12 point delta on a $4B exposure cell is roughly $100-200M of additional modeled annual loss exposure — material enough to trigger re-rating on the affected portfolio.',
    business_decision: 'A field underwriter uses the list as their weekly worklist: which markets need a new inspection visit? A pricing actuary uses the list to flag accounts in those cells for re-pricing at renewal. A reinsurance buyer uses the trend to argue for layer adjustments at next placement.',
  },

  // =================================================================
  // Tab 4 — EP Curves ( /insurance/ep-curves ) — CALIBRATED + 1 DERIVED
  // =================================================================

  'ep-curves.main-chart': {
    id: 'ep-curves.main-chart',
    title: 'Exceedance Probability curves: baseline vs sensor-informed',
    tab: 'ep-curves',
    tabLabel: 'EP Curves',
    calibration: 'calibrated',
    sourceLine: 'EP_CURVES in src/data/insurance-mock.ts — calibrated against Lloyd\'s 2023 Realistic Disaster Scenarios + CRESTA AAL 2021',
    formulas: [
      { label: 'Baseline loss at RP',         expression: 'industry-model loss for a 1-in-N year event',         explanation: 'The reference EP curve — what AIR, RMS, or in-house cat models produce from public hazard data alone.' },
      { label: 'Sensor-informed loss at RP',  expression: 'baseline × (1 - tightening_factor(RP))',              explanation: 'Sensor-driven curve. Tightening factor is larger at high return periods (rare, tail events) because that\'s where local data adds the most information.' },
      { label: 'Saving at RP',                expression: 'baseline_loss - sensor_loss',                          explanation: 'Dollar capital saved per return period — directly maps to held catastrophe capital reduction.' },
    ],
    observation: 'A log-scale line chart showing two EP curves per peril (flood / seismic / wind / combined): the baseline industry curve and the sensor-informed curve. The gap between them at any return period is the modeled capital saving from adding DataSnake telemetry.',
    risk_interpretation: 'EP curves are how the industry expresses cat tail risk: at the 1-in-100yr return period, the curve tells you the loss you should hold capital against. Tighter sensor curves narrow the uncertainty in the tail, which directly tightens the capital requirement.',
    financial_interpretation: 'The vertical gap at the 1-in-100yr point is the headline saving — the capital a portfolio could release if regulators accepted the sensor-informed model. Across the four perils, sample placements range $0.5B-$2B per book.',
    business_decision: 'CAT-modeling teams use EP curves to set treaty attachment points and limits. Capital-management teams use the tail values to size held catastrophe capital. The sensor-informed gap is the central pitch to a CFO: "release this much capital, deploy it in higher-return books."',
  },

  'ep-curves.callout': {
    id: 'ep-curves.callout',
    title: 'Annotation callout: 1-in-100yr saving + capital efficiency',
    tab: 'ep-curves',
    tabLabel: 'EP Curves',
    calibration: 'derived',
    sourceLine: 'derived from ep-curves.main-chart — same EP data, single point reported',
    formulas: [
      { label: '1-in-100yr saving', expression: 'baseline_loss(100) - sensor_loss(100)',                                explanation: 'The vertical gap at exactly the 1-in-100yr return period — the regulator-favorite reference point.' },
      { label: 'Capital efficiency', expression: 'saving / baseline_loss(100)',                                          explanation: 'Percentage of capital that can be released. A 22% efficiency means the carrier can hold 22% less catastrophe capital under the sensor-informed model.' },
    ],
    observation: 'A small annotation block above the chart calling out a single number — the dollar saving at the 1-in-100yr point and the corresponding percentage capital efficiency.',
    risk_interpretation: 'This is the "tl;dr" of the EP curve story. The 1-in-100yr point is the regulator-favorite reference: NAIC RBC, Solvency II SCR, and Lloyd\'s SST all evaluate tail capital at or near this return period.',
    financial_interpretation: 'A 22% capital efficiency on a $3B retained-loss carrier means ~$660M of catastrophe capital that can be redeployed into underwriting growth or returned to shareholders. The dollar number is the single most-shared figure in DataSnake investor decks.',
    business_decision: 'Chief Actuaries cite this number in capital-planning committee. CFOs use it to set ROE targets — released capital is no-cost growth fuel. Regulators see the same number when reviewing the carrier\'s internal model.',
  },

  'ep-curves.detail-table': {
    id: 'ep-curves.detail-table',
    title: 'EP detail table: per-RP baseline, sensor, saving',
    tab: 'ep-curves',
    tabLabel: 'EP Curves',
    calibration: 'calibrated',
    sourceLine: 'EP_CURVES rendered as a tabular view — same data as the chart',
    formulas: [
      { label: 'Annualized saving', expression: 'Σ saving_at_RP × annual_probability(RP)', explanation: 'Riemann sum across the return-period axis. Converts the curve\'s point savings into one annualized $/yr figure.' },
    ],
    observation: 'A table with one row per return period (10, 25, 50, 100, 250, 500 yrs) and three columns (baseline loss, sensor loss, saving). Sum row at the bottom shows annualized saving.',
    risk_interpretation: 'Same data as the chart, in a form a cat-modeler can paste into a treaty pricing spreadsheet. The annualized saving is the long-run expected gain — useful for budgeting treaty cost vs sensor-network cost.',
    financial_interpretation: 'Annualized saving is the apples-to-apples comparison number for the sensor-network annual subscription cost. If annualized saving > network cost, the network pays for itself in year one.',
    business_decision: 'Procurement teams use this table for the build-vs-buy decision. Treaty placement teams use it to argue for adjusted layer pricing on reinsurance — the curve quantifies the cedent\'s improved risk-selection quality.',
  },

  // =================================================================
  // Tab 5 — Parametric ( /insurance/parametric ) — CALIBRATED
  // =================================================================

  'parametric.kpi-strip': {
    id: 'parametric.kpi-strip',
    title: 'Parametric KPI strip: contract counts + payout at risk',
    tab: 'parametric',
    tabLabel: 'Parametric',
    calibration: 'calibrated',
    sourceLine: 'PARAMETRIC_CONTRACTS in src/data/insurance-mock.ts — calibrated against Lloyd\'s 2023 + ARC parametric structures',
    formulas: [
      { label: 'Status counts',    expression: 'count(*) group by status',                          explanation: 'How many contracts are MONITORING, WARNING, TRIGGERED, or CLEAR right now.' },
      { label: 'Payout at risk',   expression: 'sum(payout_amount) where status in (WARNING, TRIGGERED)', explanation: 'Total $ on the line across all contracts within one threshold step of triggering or already triggered.' },
    ],
    observation: 'A row of four stat tiles. The first three show the count of contracts by status; the fourth shows the dollar sum of payouts at risk (any contract that is WARNING or TRIGGERED).',
    risk_interpretation: 'Parametric contracts pay out based on a sensor reading crossing a threshold (e.g. wind > 175 km/h at a specific buoy). The KPI strip is the live operational view: how many are close to triggering, how much is on the line.',
    financial_interpretation: 'Payout at risk is the immediate cash exposure if every WARNING / TRIGGERED contract were to trip in the next 24 hours. It is the parametric-portfolio equivalent of "outstanding claims reserves" but updated in real-time from sensor feeds.',
    business_decision: 'Treasury teams use payout at risk to confirm cash liquidity. Claims-ops teams use the WARNING count to pre-stage adjuster networks. Parametric desks use the breakdown to confirm structures are functioning as designed — too many or too few WARNING contracts both signal threshold calibration issues.',
  },

  'parametric.contract-rows': {
    id: 'parametric.contract-rows',
    title: 'Contract rows: per-contract trigger logic and audit trail',
    tab: 'parametric',
    tabLabel: 'Parametric',
    calibration: 'calibrated',
    sourceLine: 'PARAMETRIC_CONTRACTS — one row per contract with threshold, current reading, status',
    formulas: [
      { label: 'Status', expression: 'if reading >= threshold → TRIGGERED; elif reading >= 0.9 × threshold → WARNING; elif reading >= 0.7 × threshold → MONITORING; else CLEAR', explanation: 'Three-band gating mirrors industry parametric structures. The 0.9 and 0.7 cutoffs are convention; specific contracts can override.' },
      { label: 'Trend',  expression: 'sign(slope(readings_24h))',                                                                                                                explanation: 'Linear fit slope over the last 24 hourly samples. Used to flag rising/falling without overreacting to single spikes.' },
    ],
    observation: 'One row per parametric contract showing the client, peril, threshold, the current sensor reading, the status chip, the 24h trend, and the dollar payout if triggered. Each row carries the contributing sensor ID for audit.',
    risk_interpretation: 'Parametric structures replace claims adjustment with a measurement. The row\'s status chip is the contract\'s current state; the trend says whether it\'s heading toward or away from a trigger.',
    financial_interpretation: 'A TRIGGERED row means the payout is owed and the claim is being prepared for wire. A WARNING row is a contingent liability — the carrier should pre-fund. The current reading is the dollars-on-the-line indicator.',
    business_decision: 'Claims teams clear TRIGGERED rows by validating the sensor record and authorizing the payout. Underwriting teams review WARNING rows in real time to confirm threshold calibration. Auditors use the sensor-ID + reading-history to defend the payout decision under reinsurance audit.',
    assumptions: [
      'Thresholds are contractual — they were negotiated at policy bind, not derived from the dashboard.',
      'Sensor authoritativeness is a separate question — the audit relies on each sensor being certified at bind.',
    ],
  },

  // =================================================================
  // Tab 6 — Portfolio ( /insurance/portfolio ) — CALIBRATED + 2 DERIVED
  // =================================================================

  'portfolio.kpi-strip': {
    id: 'portfolio.kpi-strip',
    title: 'Portfolio KPI strip: total exposure, avg risk, accumulation, underpriced %',
    tab: 'portfolio',
    tabLabel: 'Portfolio',
    calibration: 'calibrated',
    sourceLine: 'PORTFOLIO_POLICIES in src/data/insurance-mock.ts — calibrated against AIR Touchstone Re v9 portfolio distributions',
    formulas: [
      { label: 'Total exposure',  expression: 'sum(exposure_usd)',                                                       explanation: 'Sum of insured value across every policy in the book.' },
      { label: 'Avg risk score',  expression: 'avg(risk_score)',                                                          explanation: 'Mean composite risk across policies. Industry benchmark for a balanced personal-lines book is 38-45; commercial cat books can run 55+.' },
      { label: 'Accumulation',    expression: 'max(sum(exposure_usd) per region)',                                       explanation: 'The single largest dollar accumulation in any one region — the concentration limit watchdog.' },
      { label: 'Underpriced %',   expression: 'count(*) where classified = \'underpriced\' / count(*)',                  explanation: 'Share of policies whose premium is below pure technical (EAL × load_factor). The portfolio-level mispricing signal.' },
    ],
    observation: 'Four stat tiles framing the entire portfolio view. Each is a single-number summary of the underlying policy table.',
    risk_interpretation: 'Total exposure is "size of the book." Avg risk is "balance" — is the book skewed catastrophic? Accumulation is "concentration" — am I overweight one region? Underpriced % is "pricing discipline" — am I leaving money on the table?',
    financial_interpretation: 'Total × avg risk gives a rough modeled annual loss. Accumulation × 1-in-100yr loss-rate gives the tail event reserve. Underpriced % × avg policy premium × correction-factor gives the annual mispricing leakage.',
    business_decision: 'CRO uses accumulation against treaty limits. CFO uses underpriced % to size repricing initiatives. CAT-modeling head uses avg risk to set the bar for new-business risk appetite.',
  },

  'portfolio.eighty-twenty': {
    id: 'portfolio.eighty-twenty',
    title: '80/20 callout: % of policies that drive % of exposure',
    tab: 'portfolio',
    tabLabel: 'Portfolio',
    calibration: 'derived',
    sourceLine: 'derived from PORTFOLIO_POLICIES — sorted-cumsum on exposure_usd',
    formulas: [
      { label: '80/20 ratio', expression: 'min { N : Σ exposure_top_N >= 0.80 × Σ exposure_all } / count(*)', explanation: 'Share of policies that collectively hold 80% of exposure. Classic Pareto framing.' },
    ],
    observation: 'A small callout band that says "X% of policies drive 80% of exposure" — usually X is 15-25% in cat-exposed personal lines.',
    risk_interpretation: 'A low ratio (e.g. 12% of policies = 80% of exposure) means the book is concentrated — a handful of large policies dominate the cat risk. A higher ratio (e.g. 32%) means exposure is more evenly distributed.',
    financial_interpretation: 'Concentrated books are operationally cheaper to manage (fewer accounts) but financially riskier (one large loss is a bigger share of the book). The ratio drives both reinsurance structure and the resourcing of the strategic-accounts team.',
    business_decision: 'When the ratio drops below ~15%, reinsurance buyers usually move from quota-share to surplus-share treaties — surplus matches concentration better. Strategic accounts teams reorganize to give the top-of-book more white-glove attention.',
  },

  'portfolio.distribution': {
    id: 'portfolio.distribution',
    title: 'Distribution chart: policy count + exposure across risk bands',
    tab: 'portfolio',
    tabLabel: 'Portfolio',
    calibration: 'calibrated',
    sourceLine: 'PORTFOLIO_POLICIES bucketed into 10 risk-score bands',
    formulas: [
      { label: 'Policy count per band', expression: 'count(*) group by floor(risk_score / 10)',         explanation: 'Histogram of policies across the 0-100 risk band axis.' },
      { label: 'Exposure per band',     expression: 'sum(exposure_usd) group by floor(risk_score / 10)', explanation: 'Same bucketing but summing dollar exposure instead of count.' },
    ],
    observation: 'A combination chart — bars for policy count and a line for exposure, both on the same risk-score x-axis. The visual question: does exposure track count, or does the book carry disproportionate exposure in high-risk bands?',
    risk_interpretation: 'When the exposure line sits above the count bars in the high-risk bands, the book has "exposure mass in the tail" — large policies live in risky places. The inverse pattern (exposure line below count bars in the tail) is the healthy shape.',
    financial_interpretation: 'A right-skewed exposure line is the leading indicator of a loss-ratio shock — when the next catastrophic event hits, the high-risk bands will carry the bulk of the claims dollars.',
    business_decision: 'Pricing actuaries use the chart to argue for risk-band-specific rate increases. Reinsurance buyers use it to defend the choice of attachment point — "our exposure peaks in band 70-80, so we attach treaty at the 1-in-50yr loss expected from that band."',
  },

  'portfolio.fairness-scatter': {
    id: 'portfolio.fairness-scatter',
    title: 'Fairness scatter: EAL vs Premium with underpricing gap',
    tab: 'portfolio',
    tabLabel: 'Portfolio',
    calibration: 'calibrated',
    sourceLine: 'PORTFOLIO_POLICIES — each point is one policy plotted on (EAL, Premium). Fair-pricing line = EAL × LOAD_FACTOR',
    formulas: [
      { label: 'Fair premium', expression: 'EAL × LOAD_FACTOR',                                          explanation: 'Industry convention: LOAD_FACTOR = 1.5 covers expenses, profit margin, and risk capital. Pure technical premium would be 1.0×.' },
      { label: 'Pricing gap',  expression: 'fair_premium - actual_premium',                              explanation: 'Positive = underpriced (carrier loses money on tail). Negative = overpriced (carrier may lose business to competitors).' },
      { label: 'Underpricing $', expression: 'sum(pricing_gap) where pricing_gap > 0',                  explanation: 'Total $ of underpricing across the book. The "headline underpricing leakage" figure.' },
    ],
    observation: 'A scatter plot of EAL (x-axis) versus actual premium (y-axis), with a diagonal "fair pricing" reference line. Points above the line are overpriced; points below are underpriced.',
    risk_interpretation: 'Underpriced points concentrated at high EAL are the dangerous cohort — large modeled annual loss being charged less than the technically-fair premium. That gap accumulates into long-run losses.',
    financial_interpretation: 'The vertical distance between each point and the fair-pricing line is the per-policy mispricing in dollars. Summed across underpriced policies = annual leakage. A typical mid-size carrier shows $40-200M of underpricing leakage on a $5B book.',
    business_decision: 'Pricing committees identify the top-100 underpriced policies and target them for rate-correction at renewal. Reinsurance buyers cite the chart to justify rate increases — "the carrier is fixing 60% of its underpricing gap this renewal cycle, so the reinsurance technical premium can stay flat."',
  },

  'portfolio.peril-savings': {
    id: 'portfolio.peril-savings',
    title: 'Per-peril savings bar: 1-in-100yr saving per peril',
    tab: 'portfolio',
    tabLabel: 'Portfolio',
    calibration: 'calibrated',
    sourceLine: 'pulled from EP_CURVES — the 1-in-100yr saving for each peril, aggregated across portfolio',
    formulas: [
      { label: 'Per-peril saving', expression: 'EP_baseline(100, peril) - EP_sensor(100, peril)', explanation: 'Sensor-informed capital saving per peril at the 1-in-100yr return period.' },
    ],
    observation: 'A small horizontal bar chart with one bar per peril (flood, seismic, wind, surge, wildfire) showing the modeled 1-in-100yr capital saving. The largest bar usually belongs to the dominant portfolio peril.',
    risk_interpretation: 'The chart answers "which peril gives me the most capital relief from the sensor network?" Usually the answer is the most poorly-public-data-covered peril — surge and flood typically out-rank seismic.',
    financial_interpretation: 'Sum of bars = total capital saving across all perils. The bar shape guides where to deploy sensor density first — invest in the peril whose bar is fattest first.',
    business_decision: 'CAT-modeling heads use the chart to prioritize sensor-network roadmap. CFOs use it to communicate the capital-release story to the board — "the wind bar is $1.4B; that\'s what re-pricing wind capacity unlocks." ',
  },

  'portfolio.pricing-scatter': {
    id: 'portfolio.pricing-scatter',
    title: 'Pricing scatter: exposure vs risk score with cluster ellipses',
    tab: 'portfolio',
    tabLabel: 'Portfolio',
    calibration: 'calibrated',
    sourceLine: 'PORTFOLIO_POLICIES — each point is one policy plotted on (risk_score, exposure_usd)',
    formulas: [
      { label: 'Cluster ellipse', expression: '95% confidence ellipse around (mean, mean) per pricing class', explanation: 'Visual aid: groups underpriced / priced_correctly / overpriced cohorts into bivariate-normal contours.' },
    ],
    observation: 'A scatter plot of risk score (x) vs insured exposure (y), colored by pricing class. Three ellipses outline where each pricing class clusters.',
    risk_interpretation: 'The healthy pattern is a tight underpriced ellipse in the low-risk-low-exposure corner (small accounts that slipped through) and the bulk of the book in the priced-correctly ellipse. A diffuse underpriced ellipse spanning the chart is a systemic pricing problem.',
    financial_interpretation: 'Where the underpriced ellipse intersects the high-exposure region is where the carrier is losing the most money — those are the accounts to fix first. Multiplying ellipse area × density of high-EAL points estimates leakage concentration.',
    business_decision: 'Pricing leadership uses the ellipse pattern to decide between portfolio-wide rate filings (diffuse) and surgical account-level repricing (concentrated). Reinsurance buyers use it to communicate the cedent\'s "pricing discipline trajectory" across renewal cycles.',
  },

  'portfolio.heatmap': {
    id: 'portfolio.heatmap',
    title: 'Peril × Region heatmap: exposure concentration',
    tab: 'portfolio',
    tabLabel: 'Portfolio',
    calibration: 'calibrated',
    sourceLine: 'PORTFOLIO_POLICIES — each cell is sum(exposure_usd) for (region, peril)',
    formulas: [
      { label: 'Cell value',  expression: 'sum(exposure_usd) where peril in policy.perils group by (region, peril)', explanation: 'A policy with multiple perils contributes to multiple cells. Cells with no policies are blank.' },
      { label: 'Color scale', expression: 'log10(cell_value) → green-to-red gradient',                                explanation: 'Log scale because a few cells dominate; without log, the chart reads as "Florida wind" and nothing else.' },
    ],
    observation: 'A matrix with regions on one axis, perils on the other, and dollar exposure as cell color. Hot spots are the concentration concerns.',
    risk_interpretation: 'A single deeply-red cell (one region × one peril) is the concentration risk. Multiple dark cells in one region row mean a multi-peril concentration; multiple dark cells in one peril column mean a peril-specific tail.',
    financial_interpretation: 'The largest cell is the carrier\'s single biggest catastrophe accumulation. The reinsurance treaty structure should align with the heatmap\'s hot cells — limit by region for region-concentrated books, by peril for peril-concentrated books.',
    business_decision: 'CROs use the heatmap to validate that treaty layers correspond to actual concentrations. Underwriting heads use it to set quarterly bind-authority caps in the hottest cells. Strategic-planning uses cool cells as expansion targets.',
  },

  'portfolio.accumulation-zones': {
    id: 'portfolio.accumulation-zones',
    title: 'Accumulation zones: high-risk region rollup',
    tab: 'portfolio',
    tabLabel: 'Portfolio',
    calibration: 'derived',
    sourceLine: 'derived from PORTFOLIO_POLICIES — top-N regions by exposure where avg(risk_score) >= threshold',
    formulas: [
      { label: 'Zone exposure', expression: 'sum(exposure_usd) per region where region.avg_risk >= 70',                   explanation: 'Restricts to regions whose average risk is elevated; sums dollar exposure across all policies there.' },
      { label: 'Zone share',    expression: 'zone_exposure / total_book_exposure',                                          explanation: 'Percentage of the portfolio sitting in elevated-risk geographies.' },
    ],
    observation: 'A short list of "accumulation zones" — regions where both average risk score and dollar exposure exceed thresholds. Each entry shows the zone exposure, the share of the book, and the dominant peril.',
    risk_interpretation: 'Accumulation zones are the named geographies a CRO has to defend at every quarterly risk-committee meeting. The list itself rarely changes; what changes are the dollar values and which peril dominates each zone.',
    financial_interpretation: 'Zone exposure × zone-specific 1-in-100yr loss-rate = the held-capital requirement for that zone. Released capital from sensor-network savings (see EP curves) usually flows back into these zones as growth budget.',
    business_decision: 'A CRO presents this list verbatim at quarterly risk committees. A reinsurance buyer maps each zone to a specific layer in the treaty. A growth-strategy lead targets adjacent low-risk regions as expansion to dilute the zone share.',
  },

  // =================================================================
  // Tab 7 — Claims ( /insurance/claims ) — CALIBRATED + 1 DERIVED
  // =================================================================

  'claims.event-context': {
    id: 'claims.event-context',
    title: 'Event context: peak readings from the sensor network',
    tab: 'claims',
    tabLabel: 'Claims',
    calibration: 'calibrated',
    sourceLine: 'CLAIMS_EVENTS in src/data/insurance-mock.ts — calibrated against NHC post-storm reports, USGS shake-maps, NWS recorded gusts',
    formulas: [
      { label: 'Peak surge',  expression: 'max(reading) from sensors where peril = surge during event window',  explanation: 'Highest recorded storm surge in meters across event-region sensors.' },
      { label: 'Peak wind',   expression: 'max(reading) from sensors where peril = wind during event window',   explanation: 'Highest recorded gust in km/h.' },
      { label: 'Peak rain',   expression: 'sum(reading) from sensors where peril = rain during event window',   explanation: 'Total event-window rainfall in mm.' },
    ],
    observation: 'A small header for each claims event listing the recorded peak readings — surge, wind, rain — and the sensor IDs that captured them. This is the canonical "what actually happened" record for the event.',
    risk_interpretation: 'The peak values determine which contractual thresholds were crossed. A surge of 3.8m vs a 3.5m parametric threshold means the contract triggered; 3.4m means it didn\'t. The event context is the source of truth for every downstream claim verdict.',
    financial_interpretation: 'Recorded peaks feed both indemnity claims (which use them as the loss attribution baseline) and parametric claims (which use them as the trigger evidence). The sensor IDs make each number defensible at audit and at reinsurance recovery.',
    business_decision: 'Claims-ops uses the peak values to scope adjuster deployment. Indemnity adjusters use the data to validate or reject specific claimant attributions ("the surge here was 1.2m, your home is at 3m elevation"). Reinsurance recovery teams attach the records to treaty claim filings.',
  },

  'claims.summary-kpis': {
    id: 'claims.summary-kpis',
    title: 'Summary KPIs: verdict counts + $ at risk',
    tab: 'claims',
    tabLabel: 'Claims',
    calibration: 'derived',
    sourceLine: 'derived from CLAIMS_EVENTS — aggregate of per-claim verdicts',
    formulas: [
      { label: 'Verdict counts', expression: 'count(*) group by verdict',                                                explanation: 'How many claims land in each verdict bucket (APPROVED, FLAGGED, REJECTED, PENDING).' },
      { label: '$ at risk',      expression: 'sum(claim_amount) where verdict in (APPROVED, FLAGGED, PENDING)',          explanation: 'Total claim value that has not yet been definitively rejected — the open-claims liability for the event.' },
    ],
    observation: 'A row of stat tiles above the per-claim table. Counts per verdict and the dollar sum of open claims.',
    risk_interpretation: 'The verdict distribution tells the claims-ops manager how much human review capacity to deploy. A high FLAGGED count means many edge cases need adjuster judgment; a high REJECTED count means the sensor-readings clearly support denial.',
    financial_interpretation: '$ at risk is the loss-reserve estimate for this event. As adjusters resolve FLAGGED claims, this number moves into either approved-payouts or rejected, sharpening the reserve.',
    business_decision: 'Claims VPs use $ at risk as the headline event-loss tracker shown in daily executive briefings. Reinsurance recovery teams use it to file preliminary claim notices to treaty reinsurers.',
  },

  'claims.claim-verdicts': {
    id: 'claims.claim-verdicts',
    title: 'Per-claim verdicts: proximity gate + threshold logic',
    tab: 'claims',
    tabLabel: 'Claims',
    calibration: 'calibrated',
    sourceLine: 'CLAIMS_EVENTS[event].claims — one row per claim with sensor-driven verdict',
    formulas: [
      { label: 'Verdict', expression: 'if distance_to_sensor > radius_km → PENDING; elif reading >= threshold → APPROVED; elif reading >= 0.85 × threshold → FLAGGED; else REJECTED', explanation: 'Two-stage gate: first proximity (was the claimant within sensor coverage?), then threshold (did the local reading actually exceed the policy threshold?).' },
      { label: 'Confidence', expression: '1 - distance_to_sensor / radius_km',                                                                                                                explanation: 'Proximity-weighted confidence. Claims at the edge of sensor coverage get lower confidence; adjusters typically re-inspect the FLAGGED ones first.' },
    ],
    observation: 'A table of individual claims for the selected event. Each row shows the claimant, claim amount, distance to the relevant sensor, the recorded reading at that sensor, the policy threshold, and the resulting verdict.',
    risk_interpretation: 'The verdict is the sensor-driven recommendation. APPROVED rows are claims the sensor data clearly supports; REJECTED rows are claims the data clearly does not support; FLAGGED rows need human adjuster review; PENDING rows are outside sensor coverage and follow the conventional adjuster path.',
    financial_interpretation: 'APPROVED claims are pre-cleared for payout — they move to wire fastest. REJECTED claims save the carrier the loss but may need legal coverage. FLAGGED is the cohort that determines actual event-loss outcome; FLAGGED resolution speed is the single biggest determinant of event-close cycle time.',
    business_decision: 'Claims-ops triages adjuster capacity by verdict: FLAGGED first, PENDING second, APPROVED last (those are pre-cleared). Legal teams pre-review REJECTED records to scope litigation exposure. Reinsurance recovery teams batch APPROVED for the first claim filing wave.',
    limitations: [
      'Proximity gate assumes sensor density is high enough that most claims fall within radius_km. Sparse-sensor regions land too many PENDING.',
      'Threshold logic is one-dimensional — it doesn\'t capture compound events where multiple perils together exceed individual thresholds.',
    ],
  },

  // =================================================================
  // Phase 9.13.2 — Pipeline Showcase (sensor → transform → business)
  // =================================================================

  'pipeline.raw-timeseries': {
    id: 'pipeline.raw-timeseries',
    title: 'Raw sensor stream — per-sensor time-series',
    tab: 'pipeline',
    tabLabel: 'Pipeline',
    calibration: 'calibrated',
    sourceLine: 'public.measurements via public.measurements_series RPC. Sensors with source=\'datasnake\', source_tier=\'proprietary\' seeded by migration 0028; 10-min pg_cron keeps the stream live.',
    formulas: [
      { label: 'Series fetch',  expression: 'measurements_series(sensor, parameter, hours)', explanation: 'Auto-pivots: raw 10-min resolution if hours ≤ 36; hourly rollup with avg/min/max otherwise. Same RPC powering /monitoring/ocean.' },
      { label: 'Freshness',     expression: 'now() - max(observed_at)',                     explanation: 'How long ago the latest measurement landed. The 10-min cron means a healthy sensor reads "minutes ago" continuously.' },
    ],
    observation: 'The input layer. Pick any ocean or ground DataSnake sensor, pick a parameter (temperature, humidity, salinity, etc.), pick a time range. The raw time-series chart and the latest-value tile render directly from public.measurements with no preprocessing.',
    risk_interpretation: 'Raw measurements are the substrate that everything else in the pipeline is computed from. Sensor health (continuous fresh readings) is itself an underwriting signal — a sensor that goes silent suggests local disruption.',
    financial_interpretation: 'Coverage is value. The dollar premium DataSnake can charge for an "API with sensor-backed anomalies" is proportional to the density of proprietary rows per county. This chart is the unit demonstration: this single sensor produces N readings/day across M parameters; multiply by the deployed fleet.',
    business_decision: 'Operations teams use the freshness tile to triage sensor failures before they impact downstream parametric or anomaly outputs. Capacity planners use the deployed-fleet count to commit to coverage SLAs.',
    assumptions: [
      'Seeded data: 20 sensors (5 ocean + 15 ground) at metro locations matching the Command Center map. Real hardware will replace this without schema change — public.sensors / public.measurements stay identical.',
      'Cron writes one synthetic row per (sensor, parameter) every 10 minutes. The cron function (ds_proprietary_tick) is replaced by the ingest endpoint when hardware ships.',
    ],
  },

  'pipeline.hourly-rollup': {
    id: 'pipeline.hourly-rollup',
    title: 'Hourly rollup with min/max envelope',
    tab: 'pipeline',
    tabLabel: 'Pipeline',
    calibration: 'live',
    sourceLine: 'public.measurements_hourly materialized view (refreshed every 30 min by migration 0015).',
    formulas: [
      { label: 'Hourly bucket', expression: 'date_trunc(\'hour\', observed_at)',          explanation: 'Group raw 10-min samples into 60-min buckets.' },
      { label: 'avg_value',     expression: 'avg(value) per (sensor, parameter, hour)',  explanation: 'Centerline of the chart. The "true" sensor reading after noise reduction.' },
      { label: 'min/max band',  expression: '(min(value), max(value)) per bucket',       explanation: 'Shaded band on the chart. Width = intra-hour variability. A widening band is itself a useful signal (sensor wobble, environmental swing).' },
    ],
    observation: 'Same time-series, but at 7d+ ranges the chart switches to the hourly aggregate. The shaded band shows the within-hour min and max so you can see variability even when the centerline looks smooth.',
    risk_interpretation: 'Noise reduction. A single noisy 10-min spike is rarely actionable; an hour of consistent elevation is. The rollup is what makes longer windows useful instead of overwhelming.',
    financial_interpretation: 'Storage + query economics. Raw rows are pruned after 7 days (migration 0015); the hourly view retains 365 days. Long-window analytics (year-over-year peril trends, EP curve construction) read exclusively from the rollup, so the database stays small while the analytical reach stays long.',
    business_decision: 'Analytics teams use the rollup for any window > 36h. Anomaly detection (next card) is computed on top of the rollup so the rolling z-score is stable against minute-level noise. Production queries should NEVER seq-scan public.measurements for windows beyond 36h — the rollup is the answer.',
  },

  'pipeline.anomaly-strip': {
    id: 'pipeline.anomaly-strip',
    title: 'Anomaly detection — rolling 24h z-score',
    tab: 'pipeline',
    tabLabel: 'Pipeline',
    calibration: 'calibrated',
    sourceLine: 'public.measurements_anomalies RPC (migration 0029). Reads measurements_hourly with a 24-row window.',
    formulas: [
      { label: 'Rolling mean μ', expression: 'avg(value) over (order by hour rows between 23 preceding and current)', explanation: '24-hour trailing mean. Smooths daily seasonality without ignoring it; the next-day reading is compared to the same hour-of-day baseline.' },
      { label: 'Rolling std σ',  expression: 'stddev_samp(value) over (same window)',                                  explanation: 'Trailing standard deviation. Calibrates "how much variation is normal for this sensor right now."' },
      { label: 'z-score',        expression: '(value - μ) / σ',                                                        explanation: 'Standardized distance from the rolling baseline. Unitless, comparable across parameters and sensors.' },
      { label: 'is_anomaly',     expression: 'abs(z_score) > 2',                                                       explanation: 'Conventional cutoff — a 2-σ event happens ~5% of the time under a normal distribution, so |z|>2 is "noteworthy" and |z|>3 is "alarming."' },
    ],
    observation: 'Same time-series, now with a translucent rolling-mean ± 2σ band and red dots wherever |z| > 2. The seed migration injects one deliberate spike per sensor on day-3 at 14:00 so this chart always has something to flag for demo purposes.',
    risk_interpretation: 'This is the signal that justifies the proprietary tier. Public data (FEMA NRI annual, NOAA hourly) cannot detect a fast-moving local anomaly — the dispatch latency is too long. A sensor reading 18°C above its rolling baseline is the leading indicator that public sources will reflect hours later.',
    financial_interpretation: 'The anomaly is the parametric-trigger candidate. When an ocean pressure_dbar spike crosses a contractual threshold, a parametric contract fires and the payout is wired. The cost of building this layer (sensors + ingest) is justified entirely by the avoided false-positive rate compared to public-data-only models.',
    business_decision: 'Operations teams subscribe to anomaly notifications. Claims-ops uses anomaly density in a county as the trigger to pre-position adjusters before a CAT event lands. Underwriters use historical anomaly density (last 90 days) as a modifier to the risk_score.',
    limitations: [
      'Rolling 24h window means the first 24 hours of any new sensor have no anomaly detection (insufficient history). Seeded data assumes the sensor has been live for 7 days.',
      'Single-parameter detector. Compound events (heat + low-humidity + wind = wildfire) require the comparative-analysis layer (next card) plus business-logic on top.',
    ],
  },

  'pipeline.comparative': {
    id: 'pipeline.comparative',
    title: 'Comparative analysis — Pearson r between two parameters',
    tab: 'pipeline',
    tabLabel: 'Pipeline',
    calibration: 'calibrated',
    sourceLine: 'public.measurements_compare + public.measurements_correlation RPCs (migration 0029). Inner-join on hour bucket.',
    formulas: [
      { label: 'Aligned pairs', expression: 'measurements_compare(sensor, A, B, hours)',     explanation: 'Inner-joins the hourly rollups of two parameters on (sensor_id, hour). Only hours with both readings are kept.' },
      { label: 'Pearson r',     expression: 'corr(value_a, value_b) across the aligned pairs', explanation: 'Postgres aggregate. Returns a value in [-1, 1]: -1 = perfect inverse, 0 = no linear relationship, +1 = perfect positive.' },
      { label: 'Interpretation',expression: '|r| < 0.1 noise · 0.1-0.3 weak · 0.3-0.5 moderate · 0.5-0.7 strong · >0.7 very strong', explanation: 'Standard psych/social-science thresholds. Sensor-physics tends to land in moderate-to-strong if the pair is physically related.' },
    ],
    observation: 'A dual-axis line chart of two parameters (e.g. temperature vs humidity) on the same sensor, plus a side tile showing the Pearson correlation coefficient and sample count.',
    risk_interpretation: 'Physical sanity check. Temperature and humidity on a ground sensor should be negatively correlated (cool nights → high humidity). If they decorrelate, the sensor is either failing or experiencing a local anomaly (e.g. an irrigation event, or a fire suppressing humidity locally). Both are useful underwriting signals.',
    financial_interpretation: 'Audit defensibility. When a parametric trigger fires, the post-event review will ask "was this a real event or a sensor fault?" A continued tight correlation between two physically-coupled parameters across the event window is evidence of sensor health. A decorrelation is evidence the firing is spurious.',
    business_decision: 'Operations teams monitor pair-wise correlations as a sensor-health KPI. Underwriting auditors include the correlation history in the claims-defense packet. Compound-event detectors (Phase 9.15) read correlations as one of their inputs.',
  },

  'pipeline.business-outputs': {
    id: 'pipeline.business-outputs',
    title: 'Section C — sensor signal to underwriting action',
    tab: 'pipeline',
    tabLabel: 'Pipeline',
    calibration: 'derived',
    sourceLine: 'Each card cross-links the transformed signals (anomalies + correlations) to a specific dashboard tab where the signal materially changes a number.',
    formulas: [
      { label: 'Surge proxy → Parametric',    expression: 'rolling-max(pressure_dbar) over 1h ≥ contractual threshold',                              explanation: 'When the proxy crosses, the matching parametric contract\'s state transitions WARNING → TRIGGERED.' },
      { label: 'Flood index → Risk Verdict',  expression: 'rolling-mean(soil_moisture_pct, 24h) - seasonal_baseline(county, week)',                  explanation: 'Positive deviation indicates persistent saturation; raises the eal_flood sub-score in the Risk Verdict output.' },
      { label: 'Wildfire index → Risk Verdict', expression: 'air_temp_c × max(0, 1 - humidity_pct/100) × wind_speed_mps',                            explanation: 'Hot-Dry-Windy index. Above county-specific thresholds, raises eal_wildfire and forces a manual underwriting review.' },
      { label: 'EP-tightening → EP Curves',   expression: 'aggregated anomaly density across the county sensor fleet',                                explanation: 'More sensors with corroborating readings → tighter tail uncertainty → narrower 1-in-100yr band. Drives the headline capital saving on /insurance/ep-curves.' },
    ],
    observation: 'Five cards spelling out the value chain: sensor signal (left column of each card) → derived metric (middle) → insurance action (right) → live dashboard link. Each card is a deep-link to the tab where the signal currently surfaces.',
    risk_interpretation: 'The whole point. Without this section, the pipeline is interesting but commercially abstract. With it, the buyer sees exactly which existing dashboard their proprietary sensor data is going to enrich.',
    financial_interpretation: 'Every dollar of premium-pricing accuracy, every dollar of capital released by tightened EP tails, every dollar of fast-pay parametric payout — they all originate as a transformed sensor signal flowing through one of these links. This section is the demo-day slide before the close.',
    business_decision: 'Sales conversations open here. Risk-management committees track which links light up most for their book and prioritize sensor deployments accordingly. Reinsurance treaty negotiations cite specific links ("we reduced 1-in-100yr loss by $X via the EP-tightening signal").',
  },

  'pipeline.coverage-confidence': {
    id: 'pipeline.coverage-confidence',
    title: 'Coverage ratio → Risk API confidence boost',
    tab: 'pipeline',
    tabLabel: 'Pipeline',
    calibration: 'derived',
    sourceLine: 'Computed from public.sensors filtered to source_tier=\'proprietary\' joined to public.fema_nri by county polygon.',
    formulas: [
      { label: 'Coverage ratio',  expression: 'count(proprietary sensors in county) / max(1, public sensors in county)', explanation: 'A county with 10 DataSnake units and 1 NDBC/NWS reference has a 10:1 ratio.' },
      { label: 'Confidence boost', expression: 'min(0.20, log10(1 + ratio) × 0.10)',                                     explanation: 'Logarithmic, capped at +0.20 absolute on the Risk API\'s `confidence` field. A 10× ratio yields ~+0.10; 100× ~+0.20.' },
    ],
    observation: 'A scalar boost added to the Risk API\'s `confidence` field when the queried county has dense proprietary coverage. Currently the API returns the public-data confidence only; this card describes the upgrade path.',
    risk_interpretation: 'Confidence is the single most important post-score field for a procurement decision. An MGA underwriter weighs verdicts against their stated confidence — a 72/100 at 0.92 confidence triggers different actions than a 72/100 at 0.55. The proprietary-tier coverage ratio is the most defensible reason confidence should go up.',
    financial_interpretation: 'This is the upsell mechanic for paid-tier API plans. Free-tier returns public-data confidence; paid-tier returns confidence boosted by proprietary coverage in the queried county. Customers self-select: counties they care about most are exactly the counties where they\'re willing to pay for higher confidence.',
    business_decision: 'Sales engineers cite this when explaining the paid tier. Product teams choose sensor-deployment locations partly to lift this ratio in target counties. Coming online in a follow-up to Phase 9.13.2 — the API edge function currently returns `confidence` from the public-data formula only; wiring this boost is a one-day follow-up after a county-polygon migration.',
    limitations: [
      'Requires a county-polygon table to do the spatial join. Today we have fema_nri rows but not polygons. The polygon load is the same migration discussed for Phase 9.12.3 (address-level lookup).',
      'Sensitive to sparse-coverage gaming — a single sensor in a low-public-coverage county yields a misleadingly high ratio. Production version will floor the public-sensor count at a meaningful minimum.',
    ],
  },

  // =================================================================
  // Phase 9.13 — Risk API + Admin
  // =================================================================

  'api.risk-verdict-endpoint': {
    id: 'api.risk-verdict-endpoint',
    title: 'POST /functions/v1/insurance-risk-verdict',
    tab: 'api',
    tabLabel: 'Risk API',
    calibration: 'live',
    sourceLine: 'Edge Function backed by public.fema_nri + public.events; auth via public.api_keys hashed bearer',
    formulas: [
      { label: 'risk_score',         expression: 'fema_nri.risk_score',                                                                            explanation: 'FEMA NRI v3 composite (0-100). Combines EAL × Social Vulnerability ÷ Community Resilience.' },
      { label: 'premium_multiplier', expression: 'min(5, 1 + max(0, risk_score - 40) × 0.045)',                                                    explanation: 'Linear above a 40-point base, capped at 5×. Constants in src/lib/insuranceScore.ts (PREMIUM_K, PREMIUM_MAX) — duplicated verbatim in the Edge Function inline copy.' },
      { label: 'aal_multiplier',     expression: 'min(7, 1 + max(0, risk_score - 40) × 0.060)',                                                    explanation: 'Steeper than premium because reserves track tail expectation, not mean.' },
      { label: 'per-peril sub-score', expression: 'min(10, log10(1 + (eal / $100M) × 9) × 10)',                                                    explanation: 'Logarithmic normalization because per-county EAL spans ~6 orders of magnitude. $100M = ~90th-percentile single-peril county EAL; counties at/above saturate at 10.' },
      { label: 'confidence',         expression: '(1 - σ(perils)/10) × (populated_columns / 5)',                                                   explanation: 'Higher when peril sub-scores agree (low variance) AND the county has all 5 hazard columns populated.' },
      { label: 'rate limit',         expression: 'api_key_check_and_bump(sha256(bearer)) atomically increments api_key_usage; if count > daily_limit → 429', explanation: 'RLS-bypass SECURITY DEFINER RPC. One row per (key_id, day) in api_key_usage. Free plan default 100/day, paid 10k/day.' },
    ],
    observation: 'A single HTTP endpoint. Accepts county_fips OR (state + county) OR address OR (lat + lon). Geocodes addresses via Open-Meteo (same precedent as src/services/geocode.ts). Resolves to a county_fips, fetches one row from fema_nri, returns the JSON verdict.',
    risk_interpretation: 'This is the same computation the /insurance/verdict UI does, exposed as a callable B2B endpoint. An insurer integrates it into their underwriting engine and gets a sensor-grade risk score in <800ms per address.',
    financial_interpretation: 'The endpoint is the smallest commercial product DataSnake can ship. Revenue rank per ChatGPT: HIGH. Free tier (100/day) onboards an MGA without procurement; paid tier (10k/day) is the upsell. The sensor_backed_anomalies field stays empty until Phase 9.13.1 proprietary sensors come online — that\'s the higher-tier value-add.',
    business_decision: 'Underwriting engineers integrate this into their quote-engine. Pricing actuaries use the per-peril breakdown to argue for peril-specific deductibles. Claims-ops monitors active_events_in_state to time CAT-adjuster pre-deployment.',
    toy_example: 'curl -X POST $URL/functions/v1/insurance-risk-verdict \\\n  -H "Authorization: Bearer tw_..." \\\n  -d \'{"address":"Miami Beach, FL"}\'\n\n→ { "verdict": { "risk_score": 72, "premium_multiplier": 2.44, ... } }',
    assumptions: [
      'FEMA NRI v3 is annual + county-level. Intra-county heterogeneity (riverside vs hilltop parcel in the same county) is invisible to this endpoint.',
      'Address geocoding accuracy ≈ Open-Meteo geocoding accuracy (best-known place match, not parcel-level).',
      'Calibration constants (PREMIUM_K, AAL_K, EAL_REF) are intentionally documented and version-locked. Changing them requires a coordinated update in both src/lib/insuranceScore.ts and the Edge Function inline copy.',
    ],
    limitations: [
      'No parcel-level granularity. Use Phase 9.12.3 address lookup (queued) when an MGA wants address-resolution rather than county-resolution.',
      'Live event modifiers are reported but do NOT yet adjust the score numerically — they are surfaced as active_events_in_state so the caller can apply their own state-level modifier.',
    ],
  },

  'admin.api-keys': {
    id: 'admin.api-keys',
    title: 'API key admin: issue, list, revoke',
    tab: 'admin',
    tabLabel: 'Admin',
    calibration: 'live',
    sourceLine: 'public.api_keys + public.api_key_usage (migration 0027). Admin-only RLS via user_profiles.role = \'admin\'.',
    formulas: [
      { label: 'Key generation', expression: 'tw_ + base64url(32 random bytes) ≈ 47 chars total',  explanation: 'Generated client-side via crypto.getRandomValues. The raw key is hashed to sha256 hex and ONLY the hash is sent to the DB. Raw key is shown to the admin once at creation, never recoverable.' },
      { label: 'Prefix',         expression: 'rawKey.slice(0, 11) → "tw_xxxxxxxx"',                explanation: 'First 11 characters stored in cleartext for display in the admin table. Lets an admin identify a key without ever seeing the secret part.' },
      { label: 'Usage today',    expression: 'select count from api_key_usage where day = today()', explanation: 'Per-key daily counter, atomically bumped by the api_key_check_and_bump RPC.' },
      { label: 'Revocation',     expression: 'update api_keys set revoked_at = now() where id = ?', explanation: 'Soft-delete. Once revoked_at is non-null, the partial index api_keys_active_idx (where revoked_at is null) excludes the row, so the Edge Function returns 401 on next request.' },
    ],
    observation: 'A table of all issued keys with prefix, tenant, plan, daily limit, today\'s usage, created/last-used timestamps, status, and a revoke button. The "+ Issue new key" button opens a modal that generates a random key, displays it ONCE for copy-to-clipboard, and saves the hash to the database.',
    risk_interpretation: 'Operational control surface. Every issued key represents a tenant relationship. Revoke when a key leaks (e.g. accidental git commit) or a contract ends. Watch usage_today vs daily_limit to spot abuse or upgrade opportunities.',
    financial_interpretation: 'Free-tier keys (100/day) are essentially marketing — generous enough to demo, low enough that abuse is contained. Paid-tier keys (10k/day) represent active commercial relationships. The day a paid key consistently hits its limit is the day to schedule a tier-up call.',
    business_decision: 'When onboarding a new MGA partner: issue free-tier key for evaluation. When they sign a paid contract: issue a fresh paid-tier key and revoke the free one. When a key fires more than 80% of daily limit for 3+ days: outbound for upgrade conversation.',
    assumptions: [
      'Raw keys are NEVER stored — only their sha256 hash. Lost a key? Re-issue, do not "recover".',
      'Keys are global: a single key authenticates against the Risk API for whoever holds it. v1 has no per-key endpoint scoping; that\'s a Phase 9.13.x follow-up.',
    ],
    limitations: [
      'No usage-export endpoint yet (would help for monthly billing). Read api_key_usage directly via SQL for now.',
      'No per-key IP allowlist or referrer restrictions. If a key leaks, revoke + re-issue.',
    ],
  },
}
