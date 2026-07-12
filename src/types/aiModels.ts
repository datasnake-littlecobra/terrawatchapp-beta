// TerraWatch — Phase 10.0: AI/ML Intelligence section types.

export type AIModelStatus = 'demo' | 'training' | 'live' | 'planned'

export type AIModelTab =
  | 'overview'
  | 'pipeline-detection'
  | 'oil-spill'
  | 'seismic-insar'
  | 'marine-biota'
  | 'glossary'

export interface ModelRegistryEntry {
  slug:         string
  name:         string
  tier:         1 | 2 | 3
  score:        number
  status:       AIModelStatus
  architecture: string | null
  datasetName:  string | null
  datasetUrl:   string | null
  accuracyPct:  number | null
  description:  string | null
}

export interface InferenceResult {
  id:            number
  inputSource:   string
  detectedClass: string
  confidence:    number
  lat:           number | null
  lon:           number | null
  metadata:      Record<string, unknown>
  inferredAt:    Date
}

export const AI_TAB_ORDER: AIModelTab[] = [
  'overview',
  'pipeline-detection',
  'oil-spill',
  'seismic-insar',
  'marine-biota',
  'glossary',
]

export const AI_TAB_LABELS: Record<AIModelTab, string> = {
  'overview':           'Overview',
  'pipeline-detection': 'Pipeline',
  'oil-spill':          'Oil Spill',
  'seismic-insar':      'Seismic InSAR',
  'marine-biota':       'Marine Biota',
  'glossary':           'Glossary',
}

export const AI_TAB_ROUTES: Record<AIModelTab, string> = {
  'overview':           '/ai-models',
  'pipeline-detection': '/ai-models/pipeline-detection',
  'oil-spill':          '/ai-models/oil-spill',
  'seismic-insar':      '/ai-models/seismic-insar',
  'marine-biota':       '/ai-models/marine-biota',
  'glossary':           '/ai-models/glossary',
}
