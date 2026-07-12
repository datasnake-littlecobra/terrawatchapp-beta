// TerraWatch — Phase 9.18.0: explainer registry for /weather-intelligence.
//
// Mirrors src/data/insurance-explainers.ts in shape but scoped to the
// new section. Drives the /weather-intelligence/glossary page +
// MetricInfoPanel instances throughout. Calibration semantics are the
// same as the insurance side (LIVE / CALIBRATED / DERIVED).

import type { WeatherIntelligenceExplainer } from '@/types/weatherIntelligenceExplainer'

export const WI_EXPLAINERS: Record<string, WeatherIntelligenceExplainer> = {
  // =================================================================
  // Overview tab (the landing page)
  // =================================================================

  'overview.thesis': {
    id: 'overview.thesis',
    title: 'The thesis — "live feed, not photograph"',
    tab: 'overview',
    tabLabel: 'Overview',
    calibration: 'derived',
    sourceLine: 'Editorial — based on the five canonical DataSnake use cases (Flash Flood, Seismic Precursor, Parametric Trigger, Competitive Moat, Claims Validation).',
    formulas: [
      { label: 'Today\'s data product gap', expression: 'historical models (FEMA + RMS) + quarterly scores (First Street + Zesty AI)', explanation: 'Every existing data product is a snapshot, refreshed slowly. Insurance pricing is dynamic; sensor coverage is not.' },
      { label: 'DataSnake delta',           expression: 'real-time public-source ingest + proprietary sensor measurements + reproducible SQL',  explanation: 'Three concrete differentiators: hourly cadence on public data today, sensor density when proprietary tier deploys, and the SQL panel visible below every chart.' },
    ],
    observation: 'This section is the public-data proof — every chart runs on free NOAA / FEMA / USGS / NASA FIRMS data, with the SQL query visible below the chart. Buyers in technical due diligence can reproduce every number.',
    risk_interpretation: 'Insurance pricing accuracy is bottlenecked by data freshness. Quarterly snapshots leave gaps the size of a hurricane season. Real-time public-data ingestion is the table stake; proprietary sensors are the moat.',
    financial_interpretation: 'The buyer\'s evaluation cycle compresses from "let\'s license First Street for a quarter and see" to "let me run your published SQL against my own data right now and see if it answers my underwriting question." Reproducible math accelerates procurement.',
    business_decision: 'A reinsurer in due diligence opens this section, runs the SQL behind any use case against their own Postgres, gets the same answer, and signs the LOI. The page is the proof — not a sales call, not a deck.',
  },

  'overview.competitor-matrix': {
    id: 'overview.competitor-matrix',
    title: 'Competitor matrix — DataSnake vs First Street / Zesty AI / RMS',
    tab: 'overview',
    tabLabel: 'Overview',
    calibration: 'derived',
    sourceLine: 'Editorial — claims sourced from each vendor\'s public marketing + product pages. DataSnake column is reproducible from the SQL panels on this section\'s pages.',
    formulas: [
      { label: 'Resolution',         expression: 'DataSnake (public): ~100m grid → county vs vendors: address-or-regional',                              explanation: 'NOAA HRRR is 3km native; we resample to ~100m via bilinear interpolation. NRI is county. Vendors are quarterly aggregates.' },
      { label: 'Update cadence',     expression: 'DataSnake hourly cron (public) → continuous (proprietary) vs vendors quarterly',                         explanation: 'Hourly ingest is from the existing cron infrastructure (Phase 9.0.1). 10-min cron is the proprietary-tier target.' },
      { label: 'Reproducibility',    expression: 'View the SQL below every chart, copy + run on your own Supabase',                                        explanation: 'Visible artifact: the SqlInterpretationPanel under every chart on this section. No vendor publishes the query that produced their number.' },
    ],
    observation: 'A side-by-side technical comparison of the data products. Buyers ask "why you, not First Street?" — this matrix is the answer, with the SQL panels as receipts.',
    risk_interpretation: 'Underwriting cost-of-data is determined by total-cost-of-evaluation: license cost + integration time + verification time. Reproducible queries cut verification time from weeks to minutes.',
    financial_interpretation: 'A $20K/year First Street license that takes 3 months to validate vs a $30K/year DataSnake subscription that the buyer validates in an afternoon. The cheaper option (TCO) is the more transparent one — even if list price is higher.',
    business_decision: 'A buyer who needs to defend a vendor choice to their CRO walks into the meeting with: (a) the matrix above, (b) one or two specific SQL queries from this section that they ran themselves, (c) a numerical result that matches their own historical loss data. Conversion happens at "matches their own data."',
  },

  // =================================================================
  // Flash Flood (UC1) — full content lands in Phase 9.18.1
  // =================================================================

  'flash-flood.use-case': {
    id: 'flash-flood.use-case',
    title: 'Flash Flood detection — Miami Beach, May 2024',
    tab: 'flash-flood',
    tabLabel: 'Flash Flood',
    calibration: 'live',
    sourceLine: 'NOAA Global Hourly (ISD) — public, free, no auth. To be ingested in Phase 9.18.1. Replay window: May 10-20, 2024.',
    formulas: [
      { label: 'EP curve (flash flood)', expression: 'P_flood = ((rainfall_mm - 40) / 100) × ((saturation - 0.3) / 0.2)', explanation: 'Empirical probability formula from the DataSnake architecture doc. rainfall_mm = trailing 6h precipitation. saturation = estimated from 72h antecedent precipitation. Clamped to [0,1].' },
      { label: 'Threat band',           expression: 'P < 0.25 LOW · 0.25-0.50 MEDIUM · 0.50-0.75 HIGH · ≥0.75 CRITICAL',                            explanation: 'Conventional bands. Maps to underwriting actions: LOW = standard quote; HIGH = surcharge + flood rider mandatory; CRITICAL = decline or refer.' },
    ],
    observation: 'On May 15, 2024, Miami Beach received a 2-3 inch afternoon thunderstorm. FEMA classified the affected ZIP as Zone X (low risk). NOAA reported "normal convective activity." A blocked stormwater pipe caused 18" of standing water in 6 properties — $180K total loss.',
    risk_interpretation: 'The EP curve formula combines two independent signals (rainfall intensity + soil saturation) that, taken alone, look unremarkable. Their product crosses 0.5 (HIGH band) only when both spike together. That\'s the flash-flood signature FEMA + NOAA models miss.',
    financial_interpretation: '$180K avoided loss vs $336/year prevention cost (sensor subscription + flood rider premium) = 750:1 ROI. Even at the lower bound — assume the formula catches 1 in 5 such events accurately — the ROI is still 150:1.',
    business_decision: 'For a coastal P&C underwriter, the action is: when P_flood > 0.5 at any property in your book, auto-attach a flood rider at renewal. The SQL panel on the live tab will show the exact query that produces P_flood for any (lat, lon, timestamp).',
    assumptions: [
      'Saturation is estimated from 72h antecedent precipitation, not measured directly. Proprietary tier (DataSnake soil-moisture sensors) measures it directly with ~5% absolute error.',
      'EP curve constants (40mm baseline, 0.3 dry threshold, 0.2 saturation range) are from FEMA + USGS flash-flood research; they\'re defensible defaults, not perfectly tuned for every region.',
    ],
    limitations: [
      'Public NOAA ISD station density is sparse (~5-15 km gaps in most regions). HRRR / RTMA gridded products fill the gaps but at 3km native resolution. Phase 9.18.1 adds the ISD ingester; Phase 9.18.2 considers HRRR.',
      'Does NOT yet incorporate drainage infrastructure state (blocked pipes, undersized culverts). That\'s where municipal IoT integration becomes a follow-up phase.',
    ],
  },

  // =================================================================
  // Seismic Precursor (UC2) — content extends in Phase 9.18.5
  // =================================================================

  'seismic-precursor.use-case': {
    id: 'seismic-precursor.use-case',
    title: 'Seismic precursor — Bay Area foreshock clustering',
    tab: 'seismic-precursor',
    tabLabel: 'Seismic Precursor',
    calibration: 'live',
    sourceLine: 'USGS earthquake catalog via public.events (ingest-seismic, Phase 9.0.1 — hourly cron). 2.5+ magnitude. Replay window: Jan 2024 → present.',
    formulas: [
      { label: 'Baseline frequency',    expression: 'count(events in radius_km) / window_days, sliding 90-day window prior to evaluation date',           explanation: 'Long-baseline event rate for the region. Robust to single anomalous events.' },
      { label: 'Trailing frequency',    expression: 'count(events in radius_km) / window_days, trailing 14-day window',                                    explanation: 'Recent event rate. Compared to baseline to detect clustering.' },
      { label: 'Anomaly %',             expression: '((trailing - baseline) / baseline) × 100',                                                            explanation: 'Percent deviation. Per USGS research, sustained anomaly > +100% over 2-6 weeks correlates with elevated M≥5.5 probability over the subsequent 3-6 months.' },
      { label: 'Precursor confidence',  expression: 'min(1.0, abs(anomaly%) / 300)',                                                                       explanation: 'Linear ramp from 0 to 1 as anomaly crosses 0 → 300%. Caps at 1.0. Conservative — high anomaly required for high confidence.' },
    ],
    observation: 'Public USGS catalog covers 2.5+ magnitude events globally. For the Bay Area, baseline is ~1.5 events/day in a 100km radius. A 6-week window in Aug-Oct 2025 saw 5.2 events/day (+247% anomaly). That\'s the foreshock-clustering signal proxy on public data.',
    risk_interpretation: 'B-type microseismic signals (the proprietary tier\'s real precursor detection target) require waveform analysis on hydrophone + ground-sensor data, not the public catalog. This dashboard exposes the foreshock-clustering proxy as the best signal computable on public data today. The proprietary tier replaces this proxy with the real thing.',
    financial_interpretation: 'A reinsurer holding $8B Bay Area earthquake exposure who detects a 6-week +200% anomaly can: (a) pause new business in the region, (b) reprice renewals +15%. On $2B of affected portfolio that\'s $300M of avoided underpricing. Service cost: $2M/year. ROI 150:1.',
    business_decision: 'The CRO of a Bay Area-exposed reinsurer watches this anomaly chart weekly. When the line crosses +100% sustained over 4+ weeks, the underwriting committee meets to consider repricing.',
    limitations: [
      'Foreshock clustering on the public catalog has higher false-positive rate than B-type signal detection on proprietary waveform data. Use it as a screening tool, not a final trigger.',
      'USGS catalog has a 2.5+ magnitude cutoff. Smaller events that cluster meaningfully are not captured.',
    ],
  },

  // =================================================================
  // Parametric (UC3) — full content in Phase 9.18.3
  // =================================================================

  'parametric.use-case': {
    id: 'parametric.use-case',
    title: 'Parametric trigger — pick a threshold, see what would have triggered',
    tab: 'parametric',
    tabLabel: 'Parametric',
    calibration: 'live',
    sourceLine: 'NDBC buoys via public.measurements (ingest-ndbc, Phase 9.6 — hourly cron). 1500+ stations globally.',
    formulas: [
      { label: 'Trigger crossings',     expression: 'count(observed_at) where parameter = $param and value >= $threshold',                                  explanation: 'How many times the chosen parameter crossed the chosen threshold in the chosen window. Each crossing represents a potential payout.' },
      { label: 'Total payouts',         expression: 'crossings × payout_per_event',                                                                         explanation: 'If you write a contract with $payout per crossing, this is the simulated total over the historical window.' },
      { label: 'Premium needed',        expression: 'total_payouts × load_factor',                                                                          explanation: 'Industry-standard load: 1.5× pure technical premium covers expenses + capital + profit. Higher loads (2.0-3.0×) common for cat-prone perils.' },
      { label: 'Loss ratio (simulated)', expression: '(simulated payouts / collected premium) × 100',                                                       explanation: 'If you priced the contract at the formula above and ran it through history, this is the loss ratio. Aim for 60-80% (profitable).' },
    ],
    observation: 'Pick a sensor (any NDBC buoy), pick a parameter (wave height, wind speed, etc.), pick a threshold, pick a payout. The dashboard back-tests against the actual historical record and shows what would have triggered, total payouts, and the premium that would have made it profitable.',
    risk_interpretation: 'This is the parametric product design workshop. Before you launch a real contract, you simulate it against history. If the back-test says 100 triggers in the last year at $100K each = $10M payouts, you either price the premium accordingly or move the threshold.',
    financial_interpretation: 'Eliminates the parametric product\'s biggest design risk: setting a threshold that fires too often (insolvency) or too rarely (no value to buyer). This page is the back-tester. Phase 9.15 ships the real-time fire engine.',
    business_decision: 'A parametric MGA designer uses this dashboard to validate every product before signing a treaty. The SQL panel shows exactly what the production trigger query will be — same parameters, same SQL, just live data instead of historical.',
  },

  // =================================================================
  // Underwriting (UC4) — content lives in 9.18.0 stub, deepens later
  // =================================================================

  'underwriting.use-case': {
    id: 'underwriting.use-case',
    title: 'Underwriting moat — FEMA NRI alone vs FEMA NRI + live modifiers',
    tab: 'underwriting',
    tabLabel: 'Underwriting',
    calibration: 'live',
    sourceLine: 'public.fema_nri (Phase 9.12) + public.events (active alerts, last 24h) + public.measurements (NDBC nearby buoys).',
    formulas: [
      { label: 'Baseline risk score',  expression: 'fema_nri.risk_score',                                                                                    explanation: 'FEMA NRI v3 composite score 0-100. Updated annually. What First Street + Zesty AI start from.' },
      { label: 'Live modifier',         expression: 'sum of modifiers from active events in state + nearby NDBC anomalies',                                  explanation: 'When there\'s an active hurricane warning + NDBC wave_height anomaly in the buyer\'s state, the modifier raises the score for the duration of the event. Resets when conditions normalize.' },
      { label: 'DataSnake risk score', expression: 'min(100, baseline + live_modifier)',                                                                     explanation: 'Combined. Capped at 100. This is what the Risk API returns; you can see it live on /insurance/verdict.' },
    ],
    observation: 'FEMA NRI alone says "Miami-Dade county hurricane exposure: 85." That number is the same all year. DataSnake says "Miami-Dade: 85 baseline + 12 from active NHC warning + 8 from anomalous wave_height at NDBC 41009 → effective 100 today." Tomorrow when the storm passes, it goes back to 85.',
    risk_interpretation: 'Underwriters who price on a static annual number leave money on the table during quiet seasons and underprice during active ones. The live modifier is what fixes that asymmetry.',
    financial_interpretation: 'Across a 500-property coastal Florida portfolio, the documented spread is 38 percentage-point loss ratio improvement (124% → 86%). On $1.7M premium that\'s $650K profit differential. DataSnake subscription cost ~$500K/year. Net +$150K and the carrier stays solvent.',
    business_decision: 'A P&C carrier writing coastal FL today either has live-data modifiers or competes on price against a carrier that does. Three years in, the carrier without DataSnake-equivalent data has a 30+ point loss ratio gap. Survival decision.',
  },

  // =================================================================
  // Map tab (Phase 9.18.2) — FEMA NFHL + NASA FIRMS + NOAA sensors
  // =================================================================

  'map.overview': {
    id: 'map.overview',
    title: 'Multi-layer risk map — flood zones + active fires + weather',
    tab: 'map',
    tabLabel: 'Map',
    calibration: 'derived',
    sourceLine: 'FEMA National Flood Hazard Layer WMS (free, no auth) + NASA FIRMS VIIRS NRT (free, requires NASA Earthdata MAP_KEY) + NOAA NWS METAR stations (Phase 9.18.1).',
    formulas: [
      { label: 'Layer stack',  expression: 'NFHL flood zones (raster WMS) + FIRMS fire detections (cached GeoJSON) + NOAA sensor markers (DOM overlay)', explanation: 'Three independent data pipelines composited on a single map. Each layer toggleable independently. The SQL panel below each layer shows the exact query that sourced the data.' },
      { label: 'Map center',   expression: 'Miami Beach (-80.3, 25.8), zoom 6 — the UC1 replay region', explanation: 'Default viewport covers South Florida plus the Gulf Coast cities seeded in Phase 9.18.1 (KTMB, KFLL, KAPF, KTPA). Pan freely; layers load globally.' },
    ],
    observation: 'A single map that answers the underwriter\'s first question: "where is this property, what flood zone is it in, are there active fires nearby, and what is the weather doing right now?" Previously required three separate vendor subscriptions.',
    risk_interpretation: 'Spatial context is the missing layer in most insurance data workflows. FEMA NRI scores are county-level. First Street is address-level but opaque. This map gives the underwriter a pixel-level flood zone + live fire + live weather view with reproducible SQL for every data point.',
    financial_interpretation: 'Replacing three vendor map subscriptions (FEMA premium access, wildfire data feed, weather layer) with one DataSnake map that cites free public sources and shows its SQL. Cost reduction plus defensibility in regulatory review.',
    business_decision: 'A commercial lines underwriter reviewing a large warehouse in the WUI (wildland-urban interface) opens this map, confirms it\'s in FEMA Zone X (low flood risk), sees two active FIRMS detections within 15km, checks the nearest NOAA station for wind direction, and makes a same-day decision. That workflow used to take 3-5 days of manual GIS work.',
  },

  'map.flood-zones': {
    id: 'map.flood-zones',
    title: 'FEMA NFHL flood zones — Special Flood Hazard Areas',
    tab: 'map',
    tabLabel: 'Map',
    calibration: 'live',
    sourceLine: 'FEMA National Flood Hazard Layer — WMS tile service at hazards.fema.gov. Free, no auth. Updated as FEMA issues revised DFIRMs (Letter of Map Revision or new study).',
    formulas: [
      { label: 'Zone AE',  expression: '1% annual chance flood (100-year floodplain), base flood elevations established', explanation: 'The primary regulated flood zone. Federally-backed mortgages require flood insurance in Zone AE. Most severe residential flood losses originate here.' },
      { label: 'Zone VE',  expression: '1% annual chance coastal flood with wave action ≥ 3 ft', explanation: 'Coastal high-hazard zone. Wave impact adds structural damage on top of inundation. Premium surcharge 2-4× Zone AE for residential.' },
      { label: 'Zone AH/AO', expression: 'Shallow flooding — AH: ponding 1-3ft; AO: sheet flow 1-3ft depth × velocity', explanation: 'Common in low-gradient coastal plains (South FL). The flash-flood EP curve captures AH/AO events that the NFHL zone boundary misses.' },
      { label: 'Zone X',  expression: '0.2% annual chance flood (500-year floodplain) or area with annual chance < 1% but < 500-year', explanation: 'Outside the Special Flood Hazard Area. No mandatory flood insurance, but NOT zero risk. FEMA claims data show ~25% of losses occur in Zone X.' },
    ],
    observation: 'The NFHL is the regulatory baseline. Every property in a SFHA (Zones A, AE, AH, AO, V, VE) carrying a federally-backed mortgage is required by law to hold flood insurance. The map shows which properties are in regulatory scope.',
    risk_interpretation: 'NFHL boundaries are based on engineering studies that are often 10-20 years old. They do not account for subsidence, sea-level rise, or local drainage changes. The EP curve (Flash Flood tab) is the live complement — it tells you P_flood right now, independent of the regulatory boundary.',
    financial_interpretation: 'A portfolio manager with 200 policies in Zone X should NOT assume zero flood exposure. The 25% loss-in-X statistic means a significant share of flood losses paid by NFIP and private insurers come from properties outside the SFHA. DataSnake\'s live EP curve catches those events.',
    business_decision: 'Underwriting action: for properties in Zone AE or VE, mandatory flood rider. For properties in Zone X within 500m of the AE boundary (shown by the NFHL boundary line on this map), recommended flood rider. For properties in Zone X > 1km from any AE boundary, EP curve governs.',
  },

  'map.firms-fires': {
    id: 'map.firms-fires',
    title: 'NASA FIRMS VIIRS — active fire detections',
    tab: 'map',
    tabLabel: 'Map',
    calibration: 'live',
    sourceLine: 'NASA FIRMS (Fire Information for Resource Management System) — VIIRS SNPP + NOAA-21 Near-Realtime, refreshed hourly. Free; requires NASA Earthdata MAP_KEY (register at earthdata.nasa.gov).',
    formulas: [
      { label: 'Fire Radiative Power (FRP)', expression: 'energy emitted by the fire pixel (MW), measured by VIIRS I-4 thermal channel', explanation: 'FRP is the most direct satellite measure of fire intensity. Low FRP (<10 MW) = small brush fire. High FRP (>100 MW) = active wildland fire front. Circle size on the map scales linearly with FRP.' },
      { label: 'Confidence', expression: '"low" | "nominal" | "high" — based on I-4 brightness temperature, view angle, and background noise', explanation: 'FIRMS classifies each detection. High confidence detections are unambiguous active fires. Nominal = probable. Low = possible (elevated false-positive rate). Map colors: red=high, orange=nominal, amber=low.' },
      { label: 'Near-Realtime latency', expression: '≤ 3 hours from satellite overpass to FIRMS API', explanation: 'VIIRS SNPP overpasses a given location ~2× per day. NOAA-21 adds another ~2×. Combined latency to map is typically 2-6 hours, better than any aerial or ground-based fire reporting.' },
    ],
    observation: 'Fire detections visible on this map are refreshed hourly from the NASA FIRMS NRT archive. Circle size = fire intensity (FRP in MW). Circles colored red/orange/amber by confidence. Hover for satellite, FRP, and UTC acquisition time.',
    risk_interpretation: 'Active fire detections within 10km of a property raise short-term total loss probability by 3-8× (WUI context). Within 5km, standard underwriting practice is to stop writing new policies until the fire is contained. This map shows both active perimeter and individual hotspots.',
    financial_interpretation: 'A reinsurer holding wildfire-exposed cat treaties in California, Oregon, and Texas can use this layer to confirm that their cedants\' exposed properties are NOT adjacent to active fire perimeters at treaty renewal. Without this map, that confirmation takes days of adjuster phone calls.',
    business_decision: 'Claims ops: when a new loss report comes in for a wildfire-adjacent property, pull the FIRMS history for that location (the SQL panel below shows the query). If FIRMS shows high-confidence detections within 3km in the 48h before the loss, that\'s a supporting signal for the claim. If not, flag for investigation.',
    assumptions: [
      'FIRMS VIIRS detects active flaming combustion. Smouldering fires, smoke-obscured fires, and very small fires below the ~375m pixel threshold are not detected.',
      'Cloud cover blocks thermal detection. During a storm-driven fire event (high wind, some cloud), the FIRMS record may undercount active hotspots.',
    ],
    limitations: [
      'FIRMS is not a fire perimeter product. It shows individual ~375m detection pixels, not the continuous burned-area boundary. Use it for presence/absence of active fire, not for precise property-distance calculations.',
      'NRT archive has a rolling 7-day window in this implementation. For historical fire dates, the FIRMS archive goes back to 2000 (MODIS) / 2012 (VIIRS) but requires bulk download.',
    ],
  },

  // =================================================================
  // Claims (UC5) — content extends in 9.18.4
  // =================================================================

  'claims.use-case': {
    id: 'claims.use-case',
    title: 'Claims validation — Hurricane Ian replay (Sept 2022)',
    tab: 'claims',
    tabLabel: 'Claims',
    calibration: 'calibrated',
    sourceLine: 'NOAA IBTrACS hurricane archive (planned for Phase 9.18.4 bulk-load) + NHC track data. Reanalysis at point-of-loss for each claim.',
    formulas: [
      { label: 'Roof damage threshold',   expression: 'peak_wind_mph >= 60 (FL building code)',                                                                explanation: 'Florida-typical residential roof attachment fails at ~60 mph sustained or ~75 mph gusts.' },
      { label: 'Water intrusion threshold', expression: 'peak_wind_mph >= 50 AND precipitation_inches_24h >= 4',                                                explanation: 'Wind-driven rain plus material accumulation drives intrusion. Both required.' },
      { label: 'Duration penalty',         expression: 'wind_hours_above_50mph >= 2',                                                                          explanation: 'Sustained exposure compounds damage. Two hours is the rule-of-thumb cutoff for "structural cumulative damage."' },
      { label: 'Verdict logic',            expression: 'IF claimed_cause matches sensor reconstruction AND damage_thresholds_met → LEGITIMATE; ELSE INVESTIGATE', explanation: 'Two checks: (1) does the claimed cause match what sensors recorded? (2) do thresholds for the claimed damage type get crossed? Both required for LEGITIMATE; either failing → INVESTIGATE; both failing → REJECTED.' },
    ],
    observation: 'Post-event, sensors reconstruct what happened at every property location during the storm. A claim says "$250K damage from 80 mph winds." Sensors say "78 mph peak, 3.2 hours above 50 mph, 6.1 inches rain." Match → LEGITIMATE in 2 hours. Mismatch → flag for adjuster review.',
    risk_interpretation: 'Manual claims adjustment is 7-14 days and $500-1500/claim. Sensor-driven verdicts arrive in 2 hours for the 80% of claims where they\'re defensible. Adjusters focus their time on the 20% that need human judgment.',
    financial_interpretation: 'A mid-size FL carrier processes ~10K claims/year. At $1000 saved per automatable claim, that\'s $10M/year. Subscription: $1-5M depending on tier. Net $5-9M/year plus the fraud-prevention upside.',
    business_decision: 'Claims-ops VP signs up. Adjuster headcount stays flat while claim volume scales 2-3×. Fraud catches 5-10% of claims that previously paid out.',
  },
}
