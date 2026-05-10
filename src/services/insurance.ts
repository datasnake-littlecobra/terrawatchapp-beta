// TerraWatch — Phase 9.12 client wrappers for the Insurance dashboard.
// All RPCs are public (anon-readable); no auth gate.

import { requireSupabase } from './supabase'

// ---------- Counters --------------------------------------------------

export interface InsuranceCounters {
  countiesIndexed:           number
  totalEalUsd:               number
  highRiskCounties:          number
  activeThreatsInHighRisk:   number
  topStateName:              string | null
  topStateEalUsd:            number | null
  generatedAt:               Date
}

interface CountersBlob {
  counties_indexed?:           number | string
  total_eal_usd?:              number | string
  high_risk_counties?:         number | string
  active_threats_in_high_risk?: number | string
  top_state_by_eal?:           { state?: string; eal_usd?: number | string } | null
  generated_at?:               string
}

export async function fetchInsuranceCounters(): Promise<InsuranceCounters> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('insurance_counters')
  if (error) throw error
  const d = (data ?? {}) as CountersBlob
  const top = d.top_state_by_eal ?? null
  return {
    countiesIndexed:         Number(d.counties_indexed         ?? 0),
    totalEalUsd:             Number(d.total_eal_usd            ?? 0),
    highRiskCounties:        Number(d.high_risk_counties       ?? 0),
    activeThreatsInHighRisk: Number(d.active_threats_in_high_risk ?? 0),
    topStateName:            top?.state ?? null,
    topStateEalUsd:          top?.eal_usd != null ? Number(top.eal_usd) : null,
    generatedAt:             d.generated_at ? new Date(d.generated_at) : new Date(),
  }
}

// ---------- Top counties by hazard ------------------------------------

export type Hazard = 'flood' | 'wildfire' | 'hurricane' | 'tornado' | 'earthquake' | 'total'

export interface CountyHazardRow {
  countyFips: string
  state:      string
  countyName: string
  ealUsd:     number
  riskScore:  number | null
  population: number | null
}

interface CountyHazardRowRaw {
  county_fips: string
  state:       string
  county_name: string
  eal_usd:     number | string | null
  risk_score:  number | string | null
  population:  number | string | null
}

export async function fetchTopCountiesByHazard(
  hazard:  Hazard,
  maxRows: number = 10,
): Promise<CountyHazardRow[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('insurance_top_counties_by_hazard', {
    hazard, max_rows: maxRows,
  })
  if (error) throw error
  return ((data as CountyHazardRowRaw[] | null) ?? []).map((r) => ({
    countyFips: r.county_fips,
    state:      r.state,
    countyName: r.county_name,
    ealUsd:     Number(r.eal_usd ?? 0),
    riskScore:  r.risk_score == null ? null : Number(r.risk_score),
    population: r.population == null ? null : Number(r.population),
  }))
}

// ---------- County detail ---------------------------------------------

export interface CountyDetail {
  countyFips:               string
  state:                    string
  stateAbbrev:              string | null
  countyName:               string
  population:               number | null
  areaSqMi:                 number | null
  riskScore:                number | null
  riskRating:               string | null
  expectedAnnualLossTotal:  number | null
  socialVulnerability:      number | null
  communityResilience:      number | null
  ealFlood:                 number | null
  ealWildfire:              number | null
  ealHurricane:             number | null
  ealTornado:               number | null
  ealEarthquake:            number | null
  ealOther:                 Record<string, number>
  lat:                      number | null
  lon:                      number | null
  activeThreats24h:         number
}

interface CountyDetailRaw {
  county_fips:                  string
  state:                        string
  state_abbrev:                 string | null
  county_name:                  string
  population:                   number | string | null
  area_sq_mi:                   number | string | null
  risk_score:                   number | string | null
  risk_rating:                  string | null
  expected_annual_loss_total:   number | string | null
  social_vulnerability:         number | string | null
  community_resilience:         number | string | null
  eal_flood:                    number | string | null
  eal_wildfire:                 number | string | null
  eal_hurricane:                number | string | null
  eal_tornado:                  number | string | null
  eal_earthquake:               number | string | null
  eal_other:                    Record<string, number | string> | null
  lat:                          number | string | null
  lon:                          number | string | null
  active_threats_24h:           number | string | null
}

const numOrNull = (v: number | string | null | undefined): number | null =>
  v == null || v === '' ? null : Number(v)

export async function fetchCountyDetail(countyFips: string): Promise<CountyDetail | null> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('insurance_county_detail', {
    p_county_fips: countyFips,
  })
  if (error) throw error
  const rows = (data as CountyDetailRaw[] | null) ?? []
  const r = rows[0]
  if (!r) return null
  const otherRaw = r.eal_other ?? {}
  const ealOther: Record<string, number> = {}
  for (const [k, v] of Object.entries(otherRaw)) {
    if (v == null) continue
    const n = Number(v)
    if (Number.isFinite(n)) ealOther[k] = n
  }
  return {
    countyFips:               r.county_fips,
    state:                    r.state,
    stateAbbrev:              r.state_abbrev ?? null,
    countyName:               r.county_name,
    population:               numOrNull(r.population),
    areaSqMi:                 numOrNull(r.area_sq_mi),
    riskScore:                numOrNull(r.risk_score),
    riskRating:               r.risk_rating ?? null,
    expectedAnnualLossTotal:  numOrNull(r.expected_annual_loss_total),
    socialVulnerability:      numOrNull(r.social_vulnerability),
    communityResilience:      numOrNull(r.community_resilience),
    ealFlood:                 numOrNull(r.eal_flood),
    ealWildfire:              numOrNull(r.eal_wildfire),
    ealHurricane:             numOrNull(r.eal_hurricane),
    ealTornado:               numOrNull(r.eal_tornado),
    ealEarthquake:            numOrNull(r.eal_earthquake),
    ealOther,
    lat:                      numOrNull(r.lat),
    lon:                      numOrNull(r.lon),
    activeThreats24h:         Number(r.active_threats_24h ?? 0),
  }
}

// ---------- State EAL aggregation -------------------------------------

export interface StateEalRow {
  state:          string
  stateAbbrev:    string | null
  countyCount:    number
  totalEalUsd:    number
  avgRiskScore:   number | null
  maxRiskScore:   number | null
  highRiskCount:  number
}

interface StateEalRowRaw {
  state:           string
  state_abbrev:    string | null
  county_count:    number | string
  total_eal_usd:   number | string | null
  avg_risk_score:  number | string | null
  max_risk_score:  number | string | null
  high_risk_count: number | string
}

export async function fetchStateEal(maxRows: number = 25): Promise<StateEalRow[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('insurance_state_eal', { max_rows: maxRows })
  if (error) throw error
  return ((data as StateEalRowRaw[] | null) ?? []).map((r) => ({
    state:          r.state,
    stateAbbrev:    r.state_abbrev ?? null,
    countyCount:    Number(r.county_count ?? 0),
    totalEalUsd:    Number(r.total_eal_usd ?? 0),
    avgRiskScore:   numOrNull(r.avg_risk_score),
    maxRiskScore:   numOrNull(r.max_risk_score),
    highRiskCount:  Number(r.high_risk_count ?? 0),
  }))
}

// ---------- Active threats in high-risk counties ----------------------

export interface ActiveThreat {
  eventId:            string
  source:             string
  category:           string
  severity:           string
  title:              string
  occurredAt:         Date
  country:            string | null
  region:             string | null
  matchedState:       string
  matchedCountyFips:  string
  matchedRiskScore:   number
}

interface ActiveThreatRaw {
  event_id:             string
  source:               string
  category:             string
  severity:             string
  title:                string
  occurred_at:          string
  country:              string | null
  region:               string | null
  matched_state:        string
  matched_county_fips:  string
  matched_risk_score:   number | string
}

export async function fetchActiveThreatsInHighRisk(
  minRisk: number = 80,
  maxRows: number = 50,
): Promise<ActiveThreat[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('insurance_active_threats_in_high_risk', {
    min_risk: minRisk, max_rows: maxRows,
  })
  if (error) throw error
  return ((data as ActiveThreatRaw[] | null) ?? []).map((r) => ({
    eventId:           r.event_id,
    source:            r.source,
    category:          r.category,
    severity:          r.severity,
    title:             r.title,
    occurredAt:        new Date(r.occurred_at),
    country:           r.country,
    region:            r.region,
    matchedState:      r.matched_state,
    matchedCountyFips: r.matched_county_fips,
    matchedRiskScore:  Number(r.matched_risk_score),
  }))
}

// ---------- Choropleth feed (kept for future county-map support) ------

export type ChoroplethMetric = 'risk_score' | 'eal_total' | 'eal_flood' | 'eal_wildfire' | 'eal_hurricane'

export interface ChoroplethCell { countyFips: string; value: number }

export async function fetchChoroplethLayer(
  metric: ChoroplethMetric,
): Promise<ChoroplethCell[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase.rpc('insurance_choropleth_layer', { metric })
  if (error) throw error
  return ((data as Array<{ county_fips: string; value: number | string }> | null) ?? [])
    .map((r) => ({ countyFips: r.county_fips, value: Number(r.value) }))
}
