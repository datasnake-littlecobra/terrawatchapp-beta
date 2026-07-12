// TerraWatch — Phase 10.0: service layer for /ai-models section.

import { supabase } from './supabase'
import type { ModelRegistryEntry, InferenceResult } from '@/types/aiModels'

interface RegistryRow {
  slug:         string
  name:         string
  tier:         number
  score:        number
  status:       string
  architecture: string | null
  dataset_name: string | null
  dataset_url:  string | null
  accuracy_pct: number | null
  description:  string | null
}

interface InferenceRow {
  id:             number
  input_source:   string
  detected_class: string
  confidence:     number | string
  lat:            number | null
  lon:            number | null
  metadata:       Record<string, unknown> | null
  inferred_at:    string
}

export async function fetchModelRegistry(): Promise<ModelRegistryEntry[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('model_registry')
    .select('*')
    .order('score', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as RegistryRow[]).map((r) => ({
    slug:         r.slug,
    name:         r.name,
    tier:         r.tier as 1 | 2 | 3,
    score:        r.score,
    status:       r.status as ModelRegistryEntry['status'],
    architecture: r.architecture,
    datasetName:  r.dataset_name,
    datasetUrl:   r.dataset_url,
    accuracyPct:  r.accuracy_pct,
    description:  r.description,
  }))
}

export async function fetchInferenceResults(
  slug:  string,
  limit = 50,
): Promise<InferenceResult[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('model_inference_results', {
    p_slug:  slug,
    p_limit: limit,
  })
  if (error) {
    console.warn('[aiModels] model_inference_results:', error.message)
    return []
  }
  return ((data ?? []) as InferenceRow[]).map((r) => ({
    id:            r.id,
    inputSource:   r.input_source,
    detectedClass: r.detected_class,
    confidence:    Number(r.confidence),
    lat:           r.lat,
    lon:           r.lon,
    metadata:      r.metadata ?? {},
    inferredAt:    new Date(r.inferred_at),
  }))
}
