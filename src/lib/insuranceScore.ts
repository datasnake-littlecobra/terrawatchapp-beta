// TerraWatch — Phase 9.13: shared insurance scoring logic.
//
// Pure functions, no Vue imports, no Supabase. Same logic runs in:
//   - The Risk Verdict UI (src/features/insurance/RiskVerdictView.vue).
//   - The Risk API Edge Function (supabase/functions/insurance-risk-verdict).
//
// Calibration constants are documented in INSURANCE_LAYMAN_EXPLAINER.md
// and INSURANCE_SQL_WORKBOOK.md. Mirrored verbatim in the Deno-side
// inline copy of these constants — see the API edge function for the
// duplicate (Deno can't import from src/ at runtime, so the constants
// are checked-in twice with a comment pointing both ways).

export type RiskLabel = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL'
export type Tone      = 'safe' | 'caution' | 'danger'

export interface RawCountyRow {
  county_fips:                 string
  state:                       string
  county_name:                 string
  risk_score:                  number | null
  expected_annual_loss_total:  number | null
  social_vulnerability:        number | null
  community_resilience:        number | null
  eal_flood:                   number | null
  eal_wildfire:                number | null
  eal_hurricane:               number | null
  eal_tornado:                 number | null
  eal_earthquake:              number | null
}

export interface PerilSubscores {
  flood:    number
  seismic:  number
  wind:     number
  wildfire: number
  surge:    number
}

export interface ComputedVerdict {
  risk_score:          number
  risk_label:          RiskLabel
  verdict:             string
  premium_multiplier:  number
  aal_multiplier:      number
  perils:              PerilSubscores
  confidence:          number
}

// --------------------------------------------------------------------
// Calibration constants — keep in sync with the Deno-side copy in
// supabase/functions/insurance-risk-verdict/index.ts. Source: docs.
// --------------------------------------------------------------------

export const PREMIUM_K = 0.045   // slope of (risk - 40) → premium multiplier
export const AAL_K     = 0.060   // steeper slope for AAL reserves
export const PREMIUM_MAX = 5.0
export const AAL_MAX     = 7.0

// Risk label band cutoffs (composite 0-100 score).
export const LABEL_CUTOFFS: Array<{ min: number; label: RiskLabel }> = [
  { min: 85, label: 'CRITICAL' },
  { min: 70, label: 'HIGH'     },
  { min: 50, label: 'ELEVATED' },
  { min: 30, label: 'MODERATE' },
  { min: 0,  label: 'LOW'      },
]

// --------------------------------------------------------------------
// Functions
// --------------------------------------------------------------------

export function classifyRisk(score: number): RiskLabel {
  for (const c of LABEL_CUTOFFS) if (score >= c.min) return c.label
  return 'LOW'
}

export function classifyTone(score: number): Tone {
  if (score >= 70) return 'danger'
  if (score >= 40) return 'caution'
  return 'safe'
}

export function premiumMultiplier(riskScore: number): number {
  const m = 1 + Math.max(0, riskScore - 40) * PREMIUM_K
  return Math.min(m, PREMIUM_MAX)
}

export function aalMultiplier(riskScore: number): number {
  const m = 1 + Math.max(0, riskScore - 40) * AAL_K
  return Math.min(m, AAL_MAX)
}

// Convert the five per-hazard $EAL columns into a 0-10 sub-score per
// peril. Normalization is logarithmic because the EAL distribution
// across US counties spans ~6 orders of magnitude.
//
// We use a fixed $100M reference (≈ the 90th percentile of single-peril
// county EAL). Counties at or above the reference saturate at 10.
const EAL_REF = 100_000_000

function ealToSubscore(eal: number | null | undefined): number {
  if (eal == null || !Number.isFinite(eal) || eal <= 0) return 0
  const ratio = Math.log10(1 + eal / EAL_REF * 9)  // 0..1 at EAL_REF
  return Math.min(10, Math.max(0, ratio * 10))
}

export function computePerilSubscores(row: RawCountyRow): PerilSubscores {
  const flood     = ealToSubscore(row.eal_flood)
  const wildfire  = ealToSubscore(row.eal_wildfire)
  const hurricane = ealToSubscore(row.eal_hurricane)
  const tornado   = ealToSubscore(row.eal_tornado)
  const earthquake = ealToSubscore(row.eal_earthquake)
  // Map FEMA's five spotlight hazards into the API's five-peril contract.
  // Hurricane → wind (tornado contributes to wind too, max). Surge is
  // computed from hurricane EAL as a proxy (FEMA bundles surge into the
  // hurricane composite); we keep them separate in the API for clarity.
  return {
    flood,
    seismic:  earthquake,
    wind:     Math.max(hurricane, tornado),
    wildfire,
    surge:    hurricane * 0.7,
  }
}

export function buildVerdictText(label: RiskLabel, perils: PerilSubscores): string {
  const dominant = (Object.entries(perils) as Array<[keyof PerilSubscores, number]>)
    .sort((a, b) => b[1] - a[1])[0]
  const dominantPeril = dominant?.[0] ?? 'flood'
  switch (label) {
    case 'CRITICAL':
      return `Decline or refer. ${capitalize(dominantPeril)} exposure is at industry-uninsurable levels.`
    case 'HIGH':
      return `Bind only with elevated premium and peril-specific exclusions. ${capitalize(dominantPeril)} drives the risk.`
    case 'ELEVATED':
      return `Bind with caution — premium multiplier recommended. ${capitalize(dominantPeril)} is the dominant exposure.`
    case 'MODERATE':
      return `Bindable at standard rate with documentation. ${capitalize(dominantPeril)} contributes most.`
    case 'LOW':
      return `Bindable at preferred rate. No single peril dominates.`
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Confidence: higher when per-peril scores agree (low variance) and the
// county has all five hazard columns populated.
export function computeConfidence(row: RawCountyRow, perils: PerilSubscores): number {
  const vals = Object.values(perils)
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
  const sigma = Math.sqrt(variance)
  const populated = [
    row.eal_flood, row.eal_wildfire, row.eal_hurricane,
    row.eal_tornado, row.eal_earthquake,
  ].filter((v) => v != null && v > 0).length
  const completeness = populated / 5
  return Math.max(0, Math.min(1, (1 - sigma / 10) * completeness))
}

export function computeVerdict(row: RawCountyRow): ComputedVerdict {
  const perils = computePerilSubscores(row)
  const baseScore = row.risk_score ?? 0
  return {
    risk_score:         Math.round(baseScore),
    risk_label:         classifyRisk(baseScore),
    verdict:            buildVerdictText(classifyRisk(baseScore), perils),
    premium_multiplier: Number(premiumMultiplier(baseScore).toFixed(2)),
    aal_multiplier:     Number(aalMultiplier(baseScore).toFixed(2)),
    perils: {
      flood:    Number(perils.flood.toFixed(1)),
      seismic:  Number(perils.seismic.toFixed(1)),
      wind:     Number(perils.wind.toFixed(1)),
      wildfire: Number(perils.wildfire.toFixed(1)),
      surge:    Number(perils.surge.toFixed(1)),
    },
    confidence:         Number(computeConfidence(row, perils).toFixed(2)),
  }
}
