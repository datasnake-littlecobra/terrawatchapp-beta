// TerraWatch — Phase 9.18.0: explainer registry types for the
// /weather-intelligence section.
//
// Mirrors src/types/explainer.ts shape but with the
// WeatherIntelligenceTab union so /weather-intelligence/glossary
// doesn't pollute the existing /insurance/glossary.

import type { Calibration, ExplainerFormula } from './explainer'

export type WeatherIntelligenceTab =
  | 'overview'
  | 'flash-flood'
  | 'seismic-precursor'
  | 'parametric'
  | 'underwriting'
  | 'claims'

export interface WeatherIntelligenceExplainer {
  id:            string                       // 'flash-flood.ep-curve'
  title:         string
  tab:           WeatherIntelligenceTab
  tabLabel:      string
  calibration:   Calibration
  sourceLine:    string
  formulas:      ExplainerFormula[]
  observation:               string
  risk_interpretation:       string
  financial_interpretation:  string
  business_decision:         string
  toy_example?:              string
  assumptions?:              string[]
  limitations?:              string[]
}

export const WI_TAB_ORDER: WeatherIntelligenceTab[] = [
  'overview',
  'flash-flood',
  'seismic-precursor',
  'parametric',
  'underwriting',
  'claims',
]

export const WI_TAB_LABELS: Record<WeatherIntelligenceTab, string> = {
  'overview':          'Overview',
  'flash-flood':       'Flash Flood',
  'seismic-precursor': 'Seismic Precursor',
  'parametric':        'Parametric',
  'underwriting':      'Underwriting',
  'claims':            'Claims',
}

export const WI_TAB_ROUTES: Record<WeatherIntelligenceTab, string> = {
  'overview':          '/weather-intelligence',
  'flash-flood':       '/weather-intelligence/flash-flood',
  'seismic-precursor': '/weather-intelligence/seismic-precursor',
  'parametric':        '/weather-intelligence/parametric',
  'underwriting':      '/weather-intelligence/underwriting',
  'claims':            '/weather-intelligence/claims',
}
