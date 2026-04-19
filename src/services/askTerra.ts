import { requireSupabase } from './supabase'
import type { TripRequest, TravelVerdict } from '@/stores/travel'

export interface AskTerraResponse {
  narrative: string
  highlights: string[]
  remaining: number
}

export class AskTerraQuotaError extends Error {
  remaining = 0
  constructor(message: string) {
    super(message)
    this.name = 'AskTerraQuotaError'
  }
}

export class AskTerraAuthRequiredError extends Error {
  constructor() {
    super('Sign in to ask Terra.')
    this.name = 'AskTerraAuthRequiredError'
  }
}

interface AskTerraPayload {
  destination: {
    lat: number
    lon: number
    label: string
    country: string
  }
  window: { start: string; end: string }
  context: {
    safetyScore: number
    verdict: 'go' | 'caution' | 'reconsider'
    reasons: Array<{ source: string; tone: string; headline: string; detail?: string }>
    kpPeak: number
    recentQuakeCount: number
    historicalQuakeCount: number
    coastal: boolean
  }
}

function buildPayload(req: TripRequest, verdict: TravelVerdict): AskTerraPayload {
  return {
    destination: {
      lat: req.destination.lat,
      lon: req.destination.lon,
      label: req.destination.name,
      country: req.destination.country,
    },
    window: {
      start: req.start.toISOString(),
      end: req.end.toISOString(),
    },
    context: {
      safetyScore: verdict.score.score,
      verdict: verdict.verdict,
      reasons: verdict.score.reasons.map((r) => {
        const out: { source: string; tone: string; headline: string; detail?: string } = {
          source: r.source,
          tone: r.tone,
          headline: r.headline,
        }
        if (r.detail) out.detail = r.detail
        return out
      }),
      kpPeak: verdict.kpPeak,
      recentQuakeCount: verdict.recentQuakes.length,
      historicalQuakeCount: verdict.historicalQuakeCount,
      coastal: Boolean(verdict.station),
    },
  }
}

export async function askTerra(
  req: TripRequest,
  verdict: TravelVerdict,
): Promise<AskTerraResponse> {
  const supabase = requireSupabase()
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) throw new AskTerraAuthRequiredError()

  const payload = buildPayload(req, verdict)
  const { data, error } = await supabase.functions.invoke<AskTerraResponse>('ask-terra', {
    body: payload,
  })

  if (error) {
    const ctx = error.context as { status?: number; error?: { message?: string } } | undefined
    if (ctx?.status === 429) {
      const quotaError = new AskTerraQuotaError(
        ctx.error?.message ?? 'Daily limit reached.',
      )
      throw quotaError
    }
    throw error
  }
  if (!data) throw new Error('Ask Terra returned no response.')
  return data
}
