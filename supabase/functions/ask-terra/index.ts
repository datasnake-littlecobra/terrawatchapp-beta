// TerraWatch — Ask Terra edge function
// Validates the caller's Supabase JWT, enforces a per-user daily quota, then
// calls Anthropic Claude Haiku 4.5 to produce a conversational explanation of
// the deterministic scoring output. The client never sees the Anthropic key.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.3'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const DAILY_LIMIT = Number(Deno.env.get('ASK_TERRA_DAILY_LIMIT') ?? '5')
const MODEL = 'claude-haiku-4-5-20251001'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Reason {
  source: string
  tone: string
  headline: string
  detail?: string
}

interface AskPayload {
  destination: { lat: number; lon: number; label: string; country: string }
  window: { start: string; end: string }
  context: {
    safetyScore: number
    verdict: 'go' | 'caution' | 'reconsider'
    reasons: Reason[]
    kpPeak: number
    recentQuakeCount: number
    historicalQuakeCount: number
    coastal: boolean
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildPrompt(p: AskPayload): string {
  const reasons = p.context.reasons
    .map((r) => `- [${r.source} / ${r.tone}] ${r.headline}${r.detail ? `: ${r.detail}` : ''}`)
    .join('\n')
  return [
    `Destination: ${p.destination.label}, ${p.destination.country} (${p.destination.lat.toFixed(3)}, ${p.destination.lon.toFixed(3)})`,
    `Window: ${p.window.start} → ${p.window.end}`,
    `Deterministic verdict: ${p.context.verdict} (${p.context.safetyScore}/100)`,
    `Peak Kp: ${p.context.kpPeak.toFixed(1)}`,
    `Recent quakes (last 72h): ${p.context.recentQuakeCount}`,
    `Historical M4.5+ (5y): ${p.context.historicalQuakeCount}`,
    `Coastal: ${p.context.coastal ? 'yes' : 'no'}`,
    '',
    'Weighted reasons:',
    reasons || '- none notable',
  ].join('\n')
}

const SYSTEM_PROMPT = `You are Terra, TerraWatch's travel-advisory assistant.
Given deterministic scoring data about a trip, produce a short conversational
explanation for a non-expert traveler. Be honest about risk but not alarmist.

Return STRICT JSON matching:
{
  "narrative": string,   // 2-4 sentences, plain English, no markdown
  "highlights": string[] // 2-4 short bullets, each <= 14 words, actionable
}

Do not include any text outside the JSON object. Do not recommend travel if
the verdict is "reconsider". Prefer concrete actions (pack, reschedule,
monitor) over generic advice.`

async function callAnthropic(payload: AskPayload): Promise<{ narrative: string; highlights: string[] }> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(payload) }],
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Anthropic ${res.status}: ${body}`)
  }
  const data = await res.json() as {
    content?: Array<{ type: string; text?: string }>
  }
  const text = data.content?.find((c) => c.type === 'text')?.text ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Ask Terra returned non-JSON response')
  const parsed = JSON.parse(match[0]) as { narrative?: string; highlights?: string[] }
  return {
    narrative: typeof parsed.narrative === 'string' ? parsed.narrative : '',
    highlights: Array.isArray(parsed.highlights)
      ? parsed.highlights.filter((h): h is string => typeof h === 'string').slice(0, 4)
      : [],
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return json({ error: 'Unauthorized' }, 401)

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfigured' }, 500)
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await adminClient.auth.getUser(jwt)
  if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)
  const userId = userData.user.id

  // Quota check
  const day = today()
  const { data: usageRow } = await adminClient
    .from('ask_terra_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle()
  const current = (usageRow as { count?: number } | null)?.count ?? 0
  if (current >= DAILY_LIMIT) {
    return json(
      { error: `Daily limit of ${DAILY_LIMIT} questions reached. Resets at 00:00 UTC.` },
      429,
    )
  }

  let payload: AskPayload
  try {
    payload = await req.json() as AskPayload
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (!payload?.destination || !payload?.context) {
    return json({ error: 'Missing destination or context' }, 400)
  }

  let result: { narrative: string; highlights: string[] }
  try {
    result = await callAnthropic(payload)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Upstream failure' }, 502)
  }

  // Increment quota (upsert)
  await adminClient
    .from('ask_terra_usage')
    .upsert(
      { user_id: userId, day, count: current + 1, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,day' },
    )

  return json({
    ...result,
    remaining: Math.max(0, DAILY_LIMIT - current - 1),
  })
})
