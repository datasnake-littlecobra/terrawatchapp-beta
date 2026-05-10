// TerraWatch / DataSnake — Insurance Intelligence mock dataset.
//
// This dataset mirrors the real API contracts the DataSnake platform will
// expose to insurers, reinsurers, and parametric underwriters. Every shape
// here is intentionally verbatim with the spec so swapping in live data
// later is a single import change.
//
// Honesty note: figures are CALIBRATED — directionally accurate against
// public benchmarks (NOAA SLR rates, USGS seismic rates, FEMA NRI EAL,
// Lloyd's parametric structures) but not actual customer data. The "DEMO
// DATA" badges on every module make this explicit.

// ---------- Types ----------------------------------------------------

export type Peril = 'flood' | 'seismic' | 'wind' | 'wildfire' | 'surge'
export type RiskLabel = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL'
export type Trend = 'rising' | 'stable' | 'falling'

export interface RiskVerdict {
  location:           string
  coordinates:        { lat: number; lon: number }
  risk_score:         number          // 0-100
  risk_label:         RiskLabel
  verdict:            string
  verdict_detail:     string
  premium_multiplier: number
  aal_multiplier:     number
  perils:             Record<Peril, number>   // 0-10 per peril
  key_factors:        string[]
  data_sources:       string[]
  confidence:         number          // 0-1
  last_updated:       string          // ISO
}

export interface RiskCell {
  cell_id:         string             // pseudo-H3 id
  lat:             number
  lon:             number
  city:            string
  risk_score:      number
  trend:           Trend
  dominant_peril:  Peril
  exposure_usd:    number             // billions modeled
}

export interface EpCurvePoint {
  return_period:  number              // years
  baseline_loss:  number              // $B
  sensor_loss:    number              // $B
  saving:         number              // $B
}

export type EpCurveSet = Record<'flood' | 'seismic' | 'wind' | 'combined', EpCurvePoint[]>

export type ContractStatus = 'MONITORING' | 'WARNING' | 'TRIGGERED' | 'CLEAR'

export interface ParametricContract {
  contract_id:     string
  client:          string
  location:        string
  peril:           string             // narrower than Peril (e.g. "Storm Surge")
  threshold:       string             // human readable
  threshold_num:   number             // for math
  current_reading: number
  reading_unit:    string
  sensor_id:       string
  status:          ContractStatus
  trend:           Trend
  readings_24h:    number[]           // ~24 hourly samples
  payout_amount:   number             // $ if triggered
  last_updated:    string             // ISO
}

export interface PortfolioPolicy {
  policy_id:    string
  region:       string
  state:        string
  exposure_usd: number
  risk_score:   number
  perils:       Peril[]
  premium_usd:  number
  classified:   'priced_correctly' | 'underpriced' | 'overpriced'
}

export interface ClaimsEvent {
  event_id:              string
  event_name:            string
  date:                  string
  region:                string
  peak_surge_m:          number | null
  peak_wind_kmh:         number | null
  peak_rain_mm:          number | null
  sensor_ids:            string[]
  claims:                ClaimRecord[]
}

export interface ClaimRecord {
  claim_id:        string
  claimant:        string
  policy_type:     string
  claimed_damage:  'minor' | 'major' | 'total_loss'
  claim_amount:    number
  location:        string
  coordinates:     { lat: number; lon: number }
  sensor_reading:  string             // human readable: "Surge 2.3m"
  reading_value:   number              // for comparison
  threshold:       number              // expected value for the claimed damage tier
  verdict:         'CONSISTENT' | 'INCONSISTENT' | 'INSUFFICIENT'
  notes:           string
}

// ---------- Module 1: Risk Verdicts ---------------------------------

export const RISK_VERDICTS: RiskVerdict[] = [
  {
    location: 'Miami Beach, FL',
    coordinates: { lat: 25.79, lon: -80.13 },
    risk_score: 87,
    risk_label: 'CRITICAL',
    verdict: 'INCREASE PREMIUM — CRITICAL COASTAL EXPOSURE',
    verdict_detail: 'Storm surge, sea-level acceleration, and hurricane landfall frequency combine to put this property in the top 1% of US underwriting risk. Standard market pricing materially understates 1-in-50yr loss potential.',
    premium_multiplier: 3.4,
    aal_multiplier: 2.8,
    perils: { flood: 9.2, seismic: 1.1, wind: 8.8, wildfire: 0.9, surge: 9.4 },
    key_factors: [
      'Sea-level rise 4.2 mm/yr above 30-yr baseline (DataSnake tidal sensor DS-C01)',
      'Storm-surge modeled at 3.1 m for 1-in-50yr event (submarine pressure array DS-SUB-003)',
      'Hurricane-landfall probability 34% over the next decade (NOAA + proprietary fusion)',
      'Saltwater intrusion detected in subsurface readings (submarine DS-SUB-003, +18% YoY)',
      'NFIP claims ratio 4.2× state mean for surrounding ZIP codes',
    ],
    data_sources: ['NOAA NWS', 'USGS', 'DataSnake Submarine Fleet', 'FEMA NFHL'],
    confidence: 0.91,
    last_updated: '2026-05-09T14:32:00Z',
  },
  {
    location: 'New Orleans, LA',
    coordinates: { lat: 29.95, lon: -90.07 },
    risk_score: 84,
    risk_label: 'CRITICAL',
    verdict: 'INCREASE PREMIUM — LEVEE-DEPENDENT EXPOSURE',
    verdict_detail: 'Below-sea-level construction with single-line-of-defense levee protection. Subsidence + sea-level rise compound annually; modeled losses understated by ~20% in legacy models.',
    premium_multiplier: 2.9,
    aal_multiplier: 2.4,
    perils: { flood: 9.6, seismic: 0.6, wind: 8.1, wildfire: 0.4, surge: 9.0 },
    key_factors: [
      'Land subsidence 6 mm/yr (DataSnake ground-motion node DS-GND-018)',
      'Levee overtopping probability 12% over 25-yr horizon (Copernicus DEM + sensor fusion)',
      'Pumping-system failure rate 3.1× national average (city operator data)',
      'Surge depth 4.4 m modeled in repeat-Katrina scenario',
    ],
    data_sources: ['NOAA NWS', 'USACE', 'DataSnake Ground Network', 'FEMA NFHL'],
    confidence: 0.88,
    last_updated: '2026-05-09T14:30:00Z',
  },
  {
    location: 'San Francisco, CA',
    coordinates: { lat: 37.77, lon: -122.41 },
    risk_score: 74,
    risk_label: 'HIGH',
    verdict: 'INCREASE PREMIUM — SEISMIC EXPOSURE DOMINANT',
    verdict_detail: 'Hayward + San Andreas proximity drives ~80% of modeled annual loss. Liquefaction corridors east of Market amplify damage in M7+ scenarios.',
    premium_multiplier: 2.1,
    aal_multiplier: 1.9,
    perils: { flood: 3.8, seismic: 9.1, wind: 2.6, wildfire: 5.2, surge: 4.5 },
    key_factors: [
      'Microseismic baseline +14% YoY along Hayward (DataSnake DS-GND-012)',
      'M6.7+ probability 31% over 30-yr horizon (USGS UCERF3 + sensor fusion)',
      'Liquefaction susceptibility mapped to address-level (Copernicus DEM + DS readings)',
      'Adjacent Diablo Range fire-weather days +22% over 10-yr trend',
    ],
    data_sources: ['USGS', 'CGS', 'DataSnake Ground Network', 'CalFire'],
    confidence: 0.93,
    last_updated: '2026-05-09T14:28:00Z',
  },
  {
    location: 'Houston, TX',
    coordinates: { lat: 29.76, lon: -95.36 },
    risk_score: 79,
    risk_label: 'HIGH',
    verdict: 'INCREASE PREMIUM — INLAND-FLOOD HOTSPOT',
    verdict_detail: 'Harvey-class inland flooding now ~1-in-25yr (was 1-in-100yr in 2000-era models). Rapid impervious-surface growth + bayou-system overflow drive material under-pricing.',
    premium_multiplier: 2.4,
    aal_multiplier: 2.1,
    perils: { flood: 9.0, seismic: 0.4, wind: 7.6, wildfire: 1.8, surge: 7.4 },
    key_factors: [
      'Bayou crest exceedance 4× in last 7 years (DataSnake DS-RAIN-022)',
      'Impervious-surface fraction +9% since 2015 (Copernicus land-cover)',
      'NFIP repeat-loss properties 2.7× state mean within 25 mi radius',
      'Hurricane-track climatology shifting NE — exposure-band updated',
    ],
    data_sources: ['NOAA NWS', 'USGS', 'Harris County FCD', 'DataSnake Rain Network'],
    confidence: 0.86,
    last_updated: '2026-05-09T14:31:00Z',
  },
  {
    location: 'Los Angeles, CA',
    coordinates: { lat: 34.05, lon: -118.24 },
    risk_score: 71,
    risk_label: 'HIGH',
    verdict: 'INCREASE PREMIUM — WUI WILDFIRE EXPOSURE',
    verdict_detail: 'Wildland-urban-interface parcels in the 90+ percentile of CalFire exposure. Multi-year drought signal + Santa Ana frequency push fire-weather days to record decadal highs.',
    premium_multiplier: 1.9,
    aal_multiplier: 1.8,
    perils: { flood: 2.4, seismic: 7.2, wind: 4.1, wildfire: 9.0, surge: 1.6 },
    key_factors: [
      'Fire-weather days +28% over 10-yr trend (DataSnake DS-MET-031)',
      'VPD anomaly +0.42 kPa above climatology (Copernicus reanalysis)',
      'Santa Ana wind-event frequency +17% (NWS LOX records)',
      'Dead-fuel moisture below critical threshold for 142 days last 12 mo',
    ],
    data_sources: ['CalFire', 'NWS', 'DataSnake Met Network', 'Copernicus'],
    confidence: 0.89,
    last_updated: '2026-05-09T14:29:00Z',
  },
  {
    location: 'Tampa, FL',
    coordinates: { lat: 27.95, lon: -82.46 },
    risk_score: 81,
    risk_label: 'HIGH',
    verdict: 'INCREASE PREMIUM — UNDER-WARNED SURGE BAY',
    verdict_detail: "Tampa Bay's geometry concentrates surge; a major-hurricane direct hit hasn't happened since 1921 and most active models systematically understate the worst-case.",
    premium_multiplier: 2.6,
    aal_multiplier: 2.2,
    perils: { flood: 8.5, seismic: 0.7, wind: 8.6, wildfire: 1.4, surge: 9.3 },
    key_factors: [
      'Bay-geometry surge-amplification factor 1.6× open-coast equivalent (DS submarine model)',
      'Coastal subsidence 2.8 mm/yr (DS-SUB-007)',
      "Reinsurance-aggregator concentration risk: 39% of state's total exposure within 30 mi",
      'Long-term landfall return-period understated in major industry models',
    ],
    data_sources: ['NOAA NWS', 'NHC', 'DataSnake Submarine Fleet'],
    confidence: 0.85,
    last_updated: '2026-05-09T14:33:00Z',
  },
  {
    location: 'Phoenix, AZ',
    coordinates: { lat: 33.45, lon: -112.07 },
    risk_score: 58,
    risk_label: 'ELEVATED',
    verdict: 'MONITOR — HEAT/DROUGHT TREND DOMINANT',
    verdict_detail: 'Heat-stress + drought-driven property degradation are emerging perils with limited historical loss data. Watch-list for premium repricing as actuarial signal builds.',
    premium_multiplier: 1.3,
    aal_multiplier: 1.2,
    perils: { flood: 2.2, seismic: 1.3, wind: 3.1, wildfire: 6.4, surge: 0.0 },
    key_factors: [
      'Days >43°C +41% over 20-yr trend (DataSnake DS-MET-044)',
      'Soil-moisture deficit at decadal record (Copernicus + DS network)',
      'Foundation-cracking claims +18% YoY in adjacent ZIPs',
      'Wildfire WUI growth +6% (CalFire-equivalent state data)',
    ],
    data_sources: ['NWS', 'DataSnake Met Network', 'Copernicus', 'AZ DEMA'],
    confidence: 0.82,
    last_updated: '2026-05-09T14:32:00Z',
  },
  {
    location: 'Boulder, CO',
    coordinates: { lat: 40.01, lon: -105.27 },
    risk_score: 64,
    risk_label: 'ELEVATED',
    verdict: 'MONITOR — POST-MARSHALL FIRE REGIME SHIFT',
    verdict_detail: '2021 Marshall Fire showed grass-fed conflagrations can hit suburban grids in winter. Wind-driven fire spread is fundamentally re-pricing front-range exposure.',
    premium_multiplier: 1.5,
    aal_multiplier: 1.4,
    perils: { flood: 3.1, seismic: 1.7, wind: 6.8, wildfire: 8.2, surge: 0.0 },
    key_factors: [
      'Chinook wind-event frequency +22% YoY (DS-MET-055)',
      'Grass + light-fuel moisture below 15-yr mean for 78 days last winter',
      'Suburban-grid spread modeled in DataSnake fire-physics layer',
      'Population density 4× state mean in WUI exposure band',
    ],
    data_sources: ['NWS', 'DataSnake Met Network', 'CO DFPC'],
    confidence: 0.81,
    last_updated: '2026-05-09T14:30:00Z',
  },
  {
    location: 'Honolulu, HI',
    coordinates: { lat: 21.31, lon: -157.86 },
    risk_score: 62,
    risk_label: 'ELEVATED',
    verdict: 'MONITOR — TSUNAMI + RAIN-BOMB EXPOSURE',
    verdict_detail: 'Pacific-rim tsunami probability + Kona-low rain-bomb frequency drive the ELEVATED rating. Otherwise low-volatility market.',
    premium_multiplier: 1.4,
    aal_multiplier: 1.3,
    perils: { flood: 6.1, seismic: 4.2, wind: 5.4, wildfire: 3.2, surge: 7.1 },
    key_factors: [
      'Pacific-rim tsunami probability 8% over 50-yr horizon (USGS + DS submarine)',
      'Submarine pressure-array signal indicates active fault stress (DS-SUB-011)',
      'Kona-low extreme rainfall events +14% over decadal trend',
    ],
    data_sources: ['USGS', 'NOAA PTWC', 'DataSnake Submarine Fleet'],
    confidence: 0.83,
    last_updated: '2026-05-09T14:32:00Z',
  },
  {
    location: 'Nashville, TN',
    coordinates: { lat: 36.16, lon: -86.78 },
    risk_score: 36,
    risk_label: 'MODERATE',
    verdict: 'STANDARD PREMIUM — TORNADO RISK ONLY',
    verdict_detail: 'Tornado-alley convective risk is the dominant peril; otherwise this is a low-cat market. Standard premium pricing is appropriate.',
    premium_multiplier: 1.0,
    aal_multiplier: 1.0,
    perils: { flood: 3.4, seismic: 1.8, wind: 6.4, wildfire: 1.2, surge: 0.0 },
    key_factors: [
      'EF2+ tornado return period stable at 1-in-12yr regional (NOAA SPC)',
      'No coastal/seismic exposure',
      'Drought signal flat against 30-yr baseline',
    ],
    data_sources: ['NOAA NWS', 'NOAA SPC', 'TN EMA'],
    confidence: 0.79,
    last_updated: '2026-05-09T14:30:00Z',
  },
]

// ---------- Module 2: Command Center map cells ----------------------

// Pseudo-H3 cells representing portfolio-aggregated risk distribution.
// In production this would come from PostGIS H3 polyfills; the mock keeps
// it lat/lon + cell_id so the data shape matches the eventual API.
export const RISK_CELLS: RiskCell[] = [
  // Florida coast cluster — high
  { cell_id: '8928308280fffff', lat: 25.79, lon: -80.13, city: 'Miami Beach, FL',  risk_score: 87, trend: 'rising',  dominant_peril: 'surge',    exposure_usd: 142.3 },
  { cell_id: '8928308281fffff', lat: 27.95, lon: -82.46, city: 'Tampa, FL',        risk_score: 81, trend: 'rising',  dominant_peril: 'surge',    exposure_usd: 98.7 },
  { cell_id: '8928308282fffff', lat: 26.12, lon: -80.14, city: 'Fort Lauderdale',  risk_score: 79, trend: 'rising',  dominant_peril: 'flood',    exposure_usd: 64.1 },
  { cell_id: '8928308283fffff', lat: 30.33, lon: -81.65, city: 'Jacksonville, FL', risk_score: 67, trend: 'stable',  dominant_peril: 'wind',     exposure_usd: 41.4 },
  // Gulf coast cluster — high
  { cell_id: '8928308284fffff', lat: 29.95, lon: -90.07, city: 'New Orleans, LA',  risk_score: 84, trend: 'rising',  dominant_peril: 'flood',    exposure_usd: 88.2 },
  { cell_id: '8928308285fffff', lat: 29.76, lon: -95.36, city: 'Houston, TX',      risk_score: 79, trend: 'stable',  dominant_peril: 'flood',    exposure_usd: 156.5 },
  { cell_id: '8928308286fffff', lat: 27.80, lon: -97.39, city: 'Corpus Christi',   risk_score: 68, trend: 'stable',  dominant_peril: 'surge',    exposure_usd: 22.0 },
  // Atlantic mid — moderate
  { cell_id: '8928308287fffff', lat: 32.78, lon: -79.93, city: 'Charleston, SC',   risk_score: 71, trend: 'rising',  dominant_peril: 'surge',    exposure_usd: 38.4 },
  { cell_id: '8928308288fffff', lat: 35.78, lon: -78.64, city: 'Raleigh, NC',      risk_score: 38, trend: 'stable',  dominant_peril: 'wind',     exposure_usd: 18.1 },
  // Pacific seismic + fire
  { cell_id: '8928308289fffff', lat: 37.77, lon: -122.41, city: 'San Francisco',   risk_score: 74, trend: 'rising',  dominant_peril: 'seismic',  exposure_usd: 184.7 },
  { cell_id: '892830828affffe', lat: 34.05, lon: -118.24, city: 'Los Angeles, CA', risk_score: 71, trend: 'rising',  dominant_peril: 'wildfire', exposure_usd: 211.0 },
  { cell_id: '892830828bffffe', lat: 38.58, lon: -121.49, city: 'Sacramento, CA',  risk_score: 56, trend: 'rising',  dominant_peril: 'wildfire', exposure_usd: 33.2 },
  { cell_id: '892830828cffffe', lat: 40.01, lon: -105.27, city: 'Boulder, CO',     risk_score: 64, trend: 'rising',  dominant_peril: 'wildfire', exposure_usd: 17.4 },
  // Pacific NW — low/mod
  { cell_id: '892830828dffffe', lat: 47.61, lon: -122.33, city: 'Seattle, WA',     risk_score: 49, trend: 'stable',  dominant_peril: 'seismic',  exposure_usd: 76.0 },
  { cell_id: '892830828effffe', lat: 45.52, lon: -122.68, city: 'Portland, OR',    risk_score: 44, trend: 'stable',  dominant_peril: 'seismic',  exposure_usd: 31.1 },
  // Heat / drought
  { cell_id: '892830828fffffe', lat: 33.45, lon: -112.07, city: 'Phoenix, AZ',     risk_score: 58, trend: 'rising',  dominant_peril: 'wildfire', exposure_usd: 44.8 },
  { cell_id: '8928308290ffffe', lat: 36.17, lon: -115.14, city: 'Las Vegas, NV',   risk_score: 41, trend: 'stable',  dominant_peril: 'wildfire', exposure_usd: 28.6 },
  // Tornado alley
  { cell_id: '8928308291ffffe', lat: 35.47, lon: -97.52, city: 'Oklahoma City',    risk_score: 47, trend: 'stable',  dominant_peril: 'wind',     exposure_usd: 19.4 },
  { cell_id: '8928308292ffffe', lat: 36.16, lon: -86.78, city: 'Nashville, TN',    risk_score: 36, trend: 'falling', dominant_peril: 'wind',     exposure_usd: 22.1 },
  { cell_id: '8928308293ffffe', lat: 39.10, lon: -94.58, city: 'Kansas City, MO',  risk_score: 39, trend: 'stable',  dominant_peril: 'wind',     exposure_usd: 17.0 },
  // Pacific
  { cell_id: '8928308294ffffe', lat: 21.31, lon: -157.86, city: 'Honolulu, HI',    risk_score: 62, trend: 'stable',  dominant_peril: 'surge',    exposure_usd: 14.3 },
  // Northeast
  { cell_id: '8928308295ffffe', lat: 40.71, lon: -74.01, city: 'New York, NY',     risk_score: 55, trend: 'rising',  dominant_peril: 'surge',    exposure_usd: 312.4 },
  { cell_id: '8928308296ffffe', lat: 42.36, lon: -71.06, city: 'Boston, MA',       risk_score: 41, trend: 'stable',  dominant_peril: 'surge',    exposure_usd: 96.0 },
  { cell_id: '8928308297ffffe', lat: 39.95, lon: -75.17, city: 'Philadelphia, PA', risk_score: 33, trend: 'stable',  dominant_peril: 'flood',    exposure_usd: 71.2 },
]

// ---------- Module 3: EP curves -------------------------------------

// Modeled aggregate annual exceedance for a representative US-coastal
// portfolio. Baseline = legacy CAT-model (NEHRP / RMS-class assumptions);
// Sensor = same model with DataSnake real-time + sensor priors injected.
export const EP_CURVES: EpCurveSet = {
  flood: [
    { return_period: 10,  baseline_loss: 0.8,  sensor_loss: 0.7,  saving: 0.1 },
    { return_period: 25,  baseline_loss: 2.1,  sensor_loss: 1.7,  saving: 0.4 },
    { return_period: 50,  baseline_loss: 4.6,  sensor_loss: 3.6,  saving: 1.0 },
    { return_period: 100, baseline_loss: 9.4,  sensor_loss: 7.3,  saving: 2.1 },
    { return_period: 200, baseline_loss: 19.2, sensor_loss: 15.0, saving: 4.2 },
    { return_period: 500, baseline_loss: 35.0, sensor_loss: 27.6, saving: 7.4 },
  ],
  seismic: [
    { return_period: 10,  baseline_loss: 0.4,  sensor_loss: 0.3,  saving: 0.1 },
    { return_period: 25,  baseline_loss: 1.0,  sensor_loss: 0.8,  saving: 0.2 },
    { return_period: 50,  baseline_loss: 2.2,  sensor_loss: 1.7,  saving: 0.5 },
    { return_period: 100, baseline_loss: 4.8,  sensor_loss: 3.8,  saving: 1.0 },
    { return_period: 200, baseline_loss: 9.3,  sensor_loss: 7.5,  saving: 1.8 },
    { return_period: 500, baseline_loss: 17.0, sensor_loss: 13.4, saving: 3.6 },
  ],
  wind: [
    { return_period: 10,  baseline_loss: 0.5,  sensor_loss: 0.4,  saving: 0.1 },
    { return_period: 25,  baseline_loss: 1.4,  sensor_loss: 1.1,  saving: 0.3 },
    { return_period: 50,  baseline_loss: 3.0,  sensor_loss: 2.4,  saving: 0.6 },
    { return_period: 100, baseline_loss: 6.0,  sensor_loss: 4.7,  saving: 1.3 },
    { return_period: 200, baseline_loss: 12.0, sensor_loss: 9.4,  saving: 2.6 },
    { return_period: 500, baseline_loss: 22.0, sensor_loss: 17.2, saving: 4.8 },
  ],
  combined: [
    { return_period: 10,  baseline_loss: 1.2,  sensor_loss: 0.9,  saving: 0.3 },
    { return_period: 25,  baseline_loss: 3.1,  sensor_loss: 2.4,  saving: 0.7 },
    { return_period: 50,  baseline_loss: 6.8,  sensor_loss: 5.2,  saving: 1.6 },
    { return_period: 100, baseline_loss: 14.2, sensor_loss: 11.1, saving: 3.1 },
    { return_period: 200, baseline_loss: 28.5, sensor_loss: 22.3, saving: 6.2 },
    { return_period: 500, baseline_loss: 52.0, sensor_loss: 41.0, saving: 11.0 },
  ],
}

// ---------- Module 4: Parametric contracts --------------------------

export const PARAMETRIC_CONTRACTS: ParametricContract[] = [
  {
    contract_id: 'PAR-2026-001',
    client: 'Reinsurer A (anonymized)',
    location: 'Gulf Coast, TX',
    peril: 'Storm Surge',
    threshold: '3.0 m peak surge',
    threshold_num: 3.0,
    current_reading: 1.2,
    reading_unit: 'm',
    sensor_id: 'DS-SUB-003',
    status: 'MONITORING',
    trend: 'stable',
    readings_24h: [0.9, 1.0, 1.1, 1.0, 1.2, 1.1, 1.2, 1.3, 1.3, 1.2, 1.2, 1.3, 1.2, 1.1, 1.0, 1.1, 1.2, 1.2, 1.3, 1.2, 1.1, 1.2, 1.2, 1.2],
    payout_amount: 12_000_000,
    last_updated: '2026-05-09T14:30:00Z',
  },
  {
    contract_id: 'PAR-2026-004',
    client: "Lloyd's Syndicate B (anonymized)",
    location: 'San Andreas Zone, CA',
    peril: 'Seismic',
    threshold: 'M6.2',
    threshold_num: 6.2,
    current_reading: 2.1,
    reading_unit: 'M (microseismic)',
    sensor_id: 'DS-GND-012',
    status: 'MONITORING',
    trend: 'rising',
    readings_24h: [1.1, 1.3, 1.4, 1.6, 1.8, 2.0, 2.1, 2.0, 2.1, 2.2, 2.1, 2.3, 2.2, 2.2, 2.1, 2.3, 2.2, 2.2, 2.1, 2.2, 2.1, 2.1, 2.2, 2.1],
    payout_amount: 25_000_000,
    last_updated: '2026-05-09T14:32:00Z',
  },
  {
    contract_id: 'PAR-2026-007',
    client: 'Captive Mutual C',
    location: 'Sonoma County, CA',
    peril: 'Fire-Weather Index',
    threshold: 'FWI ≥ 50',
    threshold_num: 50,
    current_reading: 41,
    reading_unit: 'FWI',
    sensor_id: 'DS-MET-031',
    status: 'WARNING',
    trend: 'rising',
    readings_24h: [22, 25, 28, 31, 33, 36, 38, 39, 40, 40, 41, 42, 42, 41, 41, 40, 41, 42, 41, 42, 41, 42, 41, 41],
    payout_amount: 8_500_000,
    last_updated: '2026-05-09T14:34:00Z',
  },
  {
    contract_id: 'PAR-2026-011',
    client: 'Insurer D (US-NE)',
    location: 'New York Bight',
    peril: 'Significant Wave Height',
    threshold: '7.5 m',
    threshold_num: 7.5,
    current_reading: 2.4,
    reading_unit: 'm',
    sensor_id: 'DS-SUB-018',
    status: 'CLEAR',
    trend: 'stable',
    readings_24h: [2.1, 2.2, 2.0, 2.1, 2.3, 2.2, 2.1, 2.4, 2.3, 2.2, 2.4, 2.3, 2.2, 2.4, 2.3, 2.2, 2.5, 2.4, 2.3, 2.4, 2.3, 2.4, 2.4, 2.4],
    payout_amount: 5_000_000,
    last_updated: '2026-05-09T14:30:00Z',
  },
  {
    contract_id: 'PAR-2026-015',
    client: 'Reinsurer E (Asia-Pac)',
    location: 'Tokyo Bay, JP',
    peril: 'Tsunami DART',
    threshold: '0.6 m amplitude',
    threshold_num: 0.6,
    current_reading: 0.04,
    reading_unit: 'm',
    sensor_id: 'DS-SUB-022',
    status: 'MONITORING',
    trend: 'stable',
    readings_24h: [0.03, 0.04, 0.04, 0.03, 0.04, 0.04, 0.04, 0.05, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04],
    payout_amount: 40_000_000,
    last_updated: '2026-05-09T14:31:00Z',
  },
  {
    contract_id: 'PAR-2026-019',
    client: 'Agribusiness F',
    location: 'Iowa Cornbelt',
    peril: 'Cumulative Rainfall Deficit',
    threshold: '< 250 mm growing season',
    threshold_num: 250,
    current_reading: 218,
    reading_unit: 'mm season-to-date',
    sensor_id: 'DS-RAIN-044',
    status: 'TRIGGERED',
    trend: 'rising',
    readings_24h: [203, 205, 208, 209, 210, 211, 212, 213, 214, 214, 215, 215, 215, 216, 216, 216, 217, 217, 217, 217, 218, 218, 218, 218],
    payout_amount: 3_200_000,
    last_updated: '2026-05-09T14:29:00Z',
  },
]

// ---------- Module 5: Portfolio sample ------------------------------

export const PORTFOLIO_POLICIES: PortfolioPolicy[] = (() => {
  // Synthetic but rule-based: ~120 policies across regions, with a
  // long-tail concentration of high-exposure / high-risk policies that
  // mirrors real reinsurance portfolios (3% drives ~50% of CAT exposure).
  const policies: PortfolioPolicy[] = []
  const archetypes: Array<{ region: string; state: string; perils: Peril[]; baseScore: number; baseExp: number }> = [
    { region: 'Miami-Dade',     state: 'FL', perils: ['surge','flood','wind'],     baseScore: 85, baseExp: 12.0 },
    { region: 'Tampa Bay',      state: 'FL', perils: ['surge','wind','flood'],     baseScore: 81, baseExp: 9.5  },
    { region: 'New Orleans',    state: 'LA', perils: ['flood','surge','wind'],     baseScore: 84, baseExp: 8.0  },
    { region: 'Houston',        state: 'TX', perils: ['flood','wind','surge'],     baseScore: 79, baseExp: 11.0 },
    { region: 'San Francisco',  state: 'CA', perils: ['seismic','wildfire'],       baseScore: 74, baseExp: 14.0 },
    { region: 'Los Angeles',    state: 'CA', perils: ['wildfire','seismic'],       baseScore: 71, baseExp: 13.0 },
    { region: 'Charleston',     state: 'SC', perils: ['surge','wind'],             baseScore: 71, baseExp: 5.0  },
    { region: 'Boulder',        state: 'CO', perils: ['wildfire'],                 baseScore: 64, baseExp: 3.0  },
    { region: 'Phoenix',        state: 'AZ', perils: ['wildfire'],                 baseScore: 58, baseExp: 4.0  },
    { region: 'Seattle',        state: 'WA', perils: ['seismic'],                  baseScore: 49, baseExp: 6.0  },
    { region: 'Nashville',      state: 'TN', perils: ['wind'],                     baseScore: 36, baseExp: 2.0  },
    { region: 'Raleigh',        state: 'NC', perils: ['wind'],                     baseScore: 38, baseExp: 1.8  },
    { region: 'Kansas City',    state: 'MO', perils: ['wind'],                     baseScore: 39, baseExp: 1.5  },
    { region: 'Boston',         state: 'MA', perils: ['surge','wind'],             baseScore: 41, baseExp: 8.0  },
    { region: 'New York',       state: 'NY', perils: ['surge','flood'],            baseScore: 55, baseExp: 25.0 },
  ]

  let id = 1
  for (const a of archetypes) {
    // Each archetype gets 5-12 policies with jittered values
    const n = 5 + Math.floor(Math.random() * 8)
    for (let i = 0; i < n; i++) {
      // PRNG seed is not deterministic but mock data tolerates it
      const score = Math.max(20, Math.min(99, Math.round(a.baseScore + (Math.random() - 0.5) * 18)))
      const exp = Math.max(0.2, a.baseExp * (0.4 + Math.random() * 1.2))
      // Premium follows risk score with some pricing-error spread to surface
      // under/overpriced policies in the scatter chart.
      const correctPremium = exp * 0.012 * (score / 50)
      const pricingError = (Math.random() - 0.5) * 0.5  // -25% to +25%
      const premium = correctPremium * (1 + pricingError)
      const classified = pricingError < -0.1
        ? 'underpriced'
        : pricingError > 0.1
          ? 'overpriced'
          : 'priced_correctly'
      policies.push({
        policy_id: `POL-${String(id++).padStart(5, '0')}`,
        region: a.region,
        state: a.state,
        exposure_usd: Math.round(exp * 1e8) / 1e8,
        risk_score: score,
        perils: a.perils,
        premium_usd: Math.round(premium * 1e6) / 1e6,
        classified,
      })
    }
  }
  return policies
})()

// ---------- Module 6: Claims events ---------------------------------

export const CLAIMS_EVENTS: ClaimsEvent[] = [
  {
    event_id: 'EVT-2026-04-15-GULFSTORM',
    event_name: 'Gulf Coast Storm — April 2026',
    date: '2026-04-15',
    region: 'Gulf Coast (TX/LA)',
    peak_surge_m: 2.1,
    peak_wind_kmh: 145,
    peak_rain_mm: 168,
    sensor_ids: ['DS-GND-008', 'DS-SUB-003', 'DS-RAIN-022'],
    claims: [
      { claim_id: 'CLM-0041', claimant: 'Property A',  policy_type: 'Homeowners',   claimed_damage: 'total_loss', claim_amount: 850_000,
        location: 'Galveston, TX',     coordinates: { lat: 29.30, lon: -94.79 },
        sensor_reading: 'Surge 2.3 m',  reading_value: 2.3, threshold: 2.0,
        verdict: 'CONSISTENT',
        notes: 'Submarine pressure array recorded surge above total-loss threshold for ~90 minutes at this exact lat/lon.' },
      { claim_id: 'CLM-0042', claimant: 'Property B',  policy_type: 'Commercial',   claimed_damage: 'major',      claim_amount: 1_200_000,
        location: 'Galveston, TX',     coordinates: { lat: 29.32, lon: -94.81 },
        sensor_reading: 'Surge 1.9 m',  reading_value: 1.9, threshold: 1.5,
        verdict: 'CONSISTENT',
        notes: 'Sustained surge + saltwater intrusion consistent with major-damage tier.' },
      { claim_id: 'CLM-0043', claimant: 'Property C',  policy_type: 'Homeowners',   claimed_damage: 'minor',      claim_amount: 32_000,
        location: 'Houston, TX',       coordinates: { lat: 29.76, lon: -95.36 },
        sensor_reading: 'Rain 78 mm',   reading_value: 78,  threshold: 60,
        verdict: 'CONSISTENT',
        notes: 'Inland rainfall consistent with minor flood-damage tier.' },
      { claim_id: 'CLM-0044', claimant: 'Property D',  policy_type: 'Homeowners',   claimed_damage: 'total_loss', claim_amount: 720_000,
        location: 'Lake Charles, LA',  coordinates: { lat: 30.22, lon: -93.21 },
        sensor_reading: 'Surge 0.4 m',  reading_value: 0.4, threshold: 2.0,
        verdict: 'INCONSISTENT',
        notes: 'Claimed total-loss surge damage but sensor network recorded < 0.5 m within 5 mi. Recommend on-site inspection.' },
      { claim_id: 'CLM-0045', claimant: 'Property E',  policy_type: 'Commercial',   claimed_damage: 'major',      claim_amount: 410_000,
        location: 'Beaumont, TX',      coordinates: { lat: 30.08, lon: -94.10 },
        sensor_reading: 'Wind 142 km/h', reading_value: 142, threshold: 120,
        verdict: 'CONSISTENT',
        notes: 'Wind speed consistent with claimed structural damage.' },
      { claim_id: 'CLM-0046', claimant: 'Property F',  policy_type: 'Homeowners',   claimed_damage: 'major',      claim_amount: 280_000,
        location: 'Cameron Parish, LA', coordinates: { lat: 29.80, lon: -93.32 },
        sensor_reading: 'Wind 48 km/h, Surge 0.6 m', reading_value: 0.6, threshold: 1.5,
        verdict: 'INSUFFICIENT',
        notes: 'Sensor coverage in remote parish is sparse; nearest sensor 14 mi away. Recommend supplemental data request.' },
      { claim_id: 'CLM-0047', claimant: 'Property G',  policy_type: 'Auto',         claimed_damage: 'total_loss', claim_amount: 64_000,
        location: 'Galveston, TX',     coordinates: { lat: 29.31, lon: -94.80 },
        sensor_reading: 'Surge 2.2 m',  reading_value: 2.2, threshold: 1.0,
        verdict: 'CONSISTENT',
        notes: 'Vehicle submerged consistent with surge depth.' },
    ],
  },
  {
    event_id: 'EVT-2026-03-22-SFEQ',
    event_name: 'Bay Area Tremor — March 2026',
    date: '2026-03-22',
    region: 'San Francisco Bay Area, CA',
    peak_surge_m: null,
    peak_wind_kmh: null,
    peak_rain_mm: null,
    sensor_ids: ['DS-GND-012', 'DS-GND-013', 'DS-GND-014'],
    claims: [
      { claim_id: 'CLM-0101', claimant: 'Property H', policy_type: 'Commercial', claimed_damage: 'major',   claim_amount: 2_100_000,
        location: 'Oakland, CA',     coordinates: { lat: 37.80, lon: -122.27 },
        sensor_reading: 'PGA 0.31 g, M5.4', reading_value: 0.31, threshold: 0.25,
        verdict: 'CONSISTENT',
        notes: 'Liquefaction-corridor reading exceeded major-damage PGA threshold.' },
      { claim_id: 'CLM-0102', claimant: 'Property I', policy_type: 'Homeowners', claimed_damage: 'major',   claim_amount: 380_000,
        location: 'Berkeley, CA',    coordinates: { lat: 37.87, lon: -122.27 },
        sensor_reading: 'PGA 0.06 g, M5.4', reading_value: 0.06, threshold: 0.20,
        verdict: 'INCONSISTENT',
        notes: 'PGA on bedrock substrate well below major-damage threshold. Recommend on-site review.' },
      { claim_id: 'CLM-0103', claimant: 'Property J', policy_type: 'Homeowners', claimed_damage: 'minor',   claim_amount: 18_000,
        location: 'San Francisco', coordinates: { lat: 37.77, lon: -122.41 },
        sensor_reading: 'PGA 0.09 g, M5.4', reading_value: 0.09, threshold: 0.05,
        verdict: 'CONSISTENT',
        notes: 'Minor cosmetic damage consistent with felt intensity.' },
      { claim_id: 'CLM-0104', claimant: 'Property K', policy_type: 'Commercial', claimed_damage: 'total_loss', claim_amount: 4_600_000,
        location: 'San Mateo, CA',   coordinates: { lat: 37.56, lon: -122.32 },
        sensor_reading: 'PGA 0.04 g, M5.4', reading_value: 0.04, threshold: 0.40,
        verdict: 'INCONSISTENT',
        notes: 'Total-loss claim implies PGA an order of magnitude higher than recorded. Likely pre-existing damage; investigate.' },
    ],
  },
]

// ---------- Helpers ---------------------------------------------------

export function riskColor(score: number): string {
  if (score >= 70) return '#FF6B6B'   // danger
  if (score >= 40) return '#F5B74A'   // caution
  return '#3DDC97'                    // safe
}

export function riskLabel(score: number): RiskLabel {
  if (score >= 80) return 'CRITICAL'
  if (score >= 65) return 'HIGH'
  if (score >= 50) return 'ELEVATED'
  if (score >= 30) return 'MODERATE'
  return 'LOW'
}

export function fmtUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '—'
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`
  if (usd >= 1e9)  return `$${(usd / 1e9).toFixed(2)}B`
  if (usd >= 1e6)  return `$${(usd / 1e6).toFixed(1)}M`
  if (usd >= 1e3)  return `$${(usd / 1e3).toFixed(0)}K`
  return `$${usd.toFixed(0)}`
}

export function statusColor(s: ContractStatus): string {
  switch (s) {
    case 'TRIGGERED': return '#FF6B6B'
    case 'WARNING':   return '#F5B74A'
    case 'MONITORING':return '#3FA9F5'
    case 'CLEAR':     return '#3DDC97'
  }
}
