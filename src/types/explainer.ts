// TerraWatch — Phase 9.12.2: per-card "How is this calculated?" panels.
//
// MetricExplainer is the shape of one inline explainer entry. The full
// set lives in src/data/insurance-explainers.ts keyed by card-id (e.g.
// 'overview.hero-counters', 'portfolio.fairness-scatter'). Both the
// MetricInfoPanel component and the GlossaryView render against this
// shape.
//
// The four prose blocks (observation / risk_interpretation /
// financial_interpretation / business_decision) follow the teaching
// framework used in the companion docs: raw signal → risk concept →
// dollar implication → underwriter action.

export type Calibration = 'live' | 'calibrated' | 'derived'

export type InsuranceTab =
  | 'overview'
  | 'verdict'
  | 'map'
  | 'ep-curves'
  | 'parametric'
  | 'portfolio'
  | 'claims'
  | 'api'
  | 'admin'

export interface ExplainerFormula {
  label: string
  expression: string
  explanation: string
}

export interface MetricExplainer {
  id:            string                       // 'overview.hero-counters'
  title:         string                       // panel header
  tab:           InsuranceTab
  tabLabel:      string                       // 'Overview', 'Portfolio', etc.
  calibration:   Calibration
  sourceLine:    string                       // 'public.fema_nri (live)' or 'calibrated against RMS 2018'
  formulas:      ExplainerFormula[]
  observation:               string
  risk_interpretation:       string
  financial_interpretation:  string
  business_decision:         string
  toy_example?:              string
  assumptions?:              string[]
  limitations?:              string[]
}

export const TAB_ORDER: InsuranceTab[] = [
  'overview',
  'verdict',
  'map',
  'ep-curves',
  'parametric',
  'portfolio',
  'claims',
  'api',
  'admin',
]

export const TAB_LABELS: Record<InsuranceTab, string> = {
  'overview':   'Overview',
  'verdict':    'Risk Verdict',
  'map':        'Command Center',
  'ep-curves':  'EP Curves',
  'parametric': 'Parametric',
  'portfolio':  'Portfolio',
  'claims':     'Claims',
  'api':        'Risk API',
  'admin':      'Admin',
}

export const TAB_ROUTES: Record<InsuranceTab, string> = {
  'overview':   '/insurance',
  'verdict':    '/insurance/verdict',
  'map':        '/insurance/map',
  'ep-curves':  '/insurance/ep-curves',
  'parametric': '/insurance/parametric',
  'portfolio':  '/insurance/portfolio',
  'claims':     '/insurance/claims',
  'api':        '/insurance/api',
  'admin':      '/admin/api-keys',
}
