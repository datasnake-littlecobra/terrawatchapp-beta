// TerraWatch — Phase 9.9: AI blog generator (admin-only).
//
// Takes a topic + optional context, produces four platform-tailored
// outputs in a single Anthropic call:
//   - app:       canonical blog post (title + excerpt + body_md + category + tags)
//   - linkedin:  short professional post + hashtags
//   - reddit:    title + conversational body + suggested subreddits
//   - instagram: caption + hashtags + image prompt for future image-gen
//
// Defense in depth:
//   - JWT required (same pattern as ask-terra).
//   - Server-side `is_admin()` RPC check — non-admin JWT returns 403 even
//     if they discover the URL.
//   - Per-admin daily quota (default 5/day, env-tunable).
//
// The output is strictly drafts — nothing auto-publishes. The client
// pastes platform variants into LinkedIn/Reddit/Instagram manually for
// now; Phase 12 will wire OAuth + posting APIs.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.3'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const DAILY_LIMIT = Number(Deno.env.get('GENERATE_BLOG_DAILY_LIMIT') ?? '5')
const MODEL = 'claude-sonnet-4-6'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface GenerateRequest {
  topic:     string
  context?:  string
  audience?: 'general' | 'technical' | 'investor'
  tone?:     'professional' | 'conversational' | 'enthusiastic'
}

interface AppPostVariant {
  title:    string
  excerpt:  string
  body_md:  string
  category: string
  tags:     string[]
}
interface LinkedInVariant {
  post:     string
  hashtags: string[]
}
interface RedditVariant {
  title:      string
  body:       string
  subreddits: string[]
}
interface InstagramVariant {
  caption:      string
  hashtags:     string[]
  image_prompt: string
}

interface GenerateResponse {
  app:       AppPostVariant
  linkedin:  LinkedInVariant
  reddit:    RedditVariant
  instagram: InstagramVariant
  remaining: number
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

const SYSTEM_PROMPT = `You are TerraWatch's editorial assistant. TerraWatch is an
environmental-intelligence app made by DataSnake — a small team building real-time
hazard monitoring (earthquakes, weather, wildfires, oceans) and an underwater
sensor fleet. The voice is honest, technically credible, and audience-aware.
Avoid hype. Avoid emoji unless asked. Never invent product features that don't exist.

Given a topic, return ONE structured JSON object containing four platform
variants of the same content. Each variant is independently usable:

{
  "app": {
    "title": string,                                 // <= 80 chars, no clickbait
    "excerpt": string,                               // 1-2 sentence dek shown on the index
    "body_md": string,                               // markdown, 400-900 words, with H2 sections
    "category": "vision" | "engineering" | "release-notes" | "event-alert" | "tech-blog" | "guide" | "product",
    "tags": string[]                                 // 3-6 lowercase tags
  },
  "linkedin": {
    "post": string,                                  // <= 1300 chars, professional tone, 2-3 short paragraphs
    "hashtags": string[]                             // 3-5 hashtags, each starting with #
  },
  "reddit": {
    "title": string,                                 // <= 300 chars, descriptive not clickbait
    "body": string,                                  // 200-500 words, conversational, ends with a question
    "subreddits": string[]                           // 3-5 specific subreddit names like "r/datasets"
  },
  "instagram": {
    "caption": string,                               // <= 600 chars, first 125 chars are the hook
    "hashtags": string[],                            // 5-10 hashtags, each starting with #
    "image_prompt": string                           // describe a square image that would accompany the post
  }
}

Rules:
- Output ONLY the JSON object. No prose before or after. No markdown fences.
- Do not address the user. Do not include meta-commentary like "Here is the post:".
- Be specific about the topic. Don't write a generic post that could fit any subject.
- For LinkedIn use line breaks between paragraphs.
- For Reddit, no hashtags in body. End body with one open-ended question to invite discussion.
- For Instagram, the image_prompt must describe a single concrete scene; no "infographic" prompts.
- Never invent statistics. If a number is mentioned in the topic, you may use it; otherwise speak qualitatively.`

function buildUserPrompt(req: GenerateRequest): string {
  const lines = [
    `Topic: ${req.topic}`,
    req.audience ? `Primary audience: ${req.audience}` : '',
    req.tone ? `Tone: ${req.tone}` : '',
    req.context ? `\nAdditional context:\n${req.context}` : '',
  ].filter(Boolean)
  return lines.join('\n')
}

async function callAnthropic(req: GenerateRequest): Promise<Omit<GenerateResponse, 'remaining'>> {
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
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(req) }],
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
  if (!match) throw new Error('generate-blog returned non-JSON response')
  let parsed: any
  try {
    parsed = JSON.parse(match[0])
  } catch (e) {
    throw new Error('generate-blog returned malformed JSON: ' + (e instanceof Error ? e.message : 'unknown'))
  }
  if (!parsed?.app || !parsed?.linkedin || !parsed?.reddit || !parsed?.instagram) {
    throw new Error('generate-blog response missing one of: app, linkedin, reddit, instagram')
  }
  return {
    app: {
      title:    String(parsed.app.title ?? '').slice(0, 200),
      excerpt:  String(parsed.app.excerpt ?? ''),
      body_md:  String(parsed.app.body_md ?? ''),
      category: String(parsed.app.category ?? 'general'),
      tags:     Array.isArray(parsed.app.tags) ? parsed.app.tags.map((t: any) => String(t)).slice(0, 8) : [],
    },
    linkedin: {
      post:     String(parsed.linkedin.post ?? '').slice(0, 1500),
      hashtags: Array.isArray(parsed.linkedin.hashtags) ? parsed.linkedin.hashtags.map((t: any) => String(t)).slice(0, 8) : [],
    },
    reddit: {
      title:      String(parsed.reddit.title ?? '').slice(0, 300),
      body:       String(parsed.reddit.body ?? ''),
      subreddits: Array.isArray(parsed.reddit.subreddits) ? parsed.reddit.subreddits.map((t: any) => String(t)).slice(0, 6) : [],
    },
    instagram: {
      caption:      String(parsed.instagram.caption ?? '').slice(0, 800),
      hashtags:     Array.isArray(parsed.instagram.hashtags) ? parsed.instagram.hashtags.map((t: any) => String(t)).slice(0, 12) : [],
      image_prompt: String(parsed.instagram.image_prompt ?? ''),
    },
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

  // Server-side admin check — defense in depth alongside the route guard.
  const { data: profile, error: profileErr } = await adminClient
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  if (profileErr) return json({ error: 'Profile lookup failed' }, 500)
  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return json({ error: 'Admin access required' }, 403)
  }

  // Quota check
  const day = today()
  const { data: usageRow } = await adminClient
    .from('blog_generator_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle()
  const current = (usageRow as { count?: number } | null)?.count ?? 0
  if (current >= DAILY_LIMIT) {
    return json(
      { error: `Daily limit of ${DAILY_LIMIT} generations reached. Resets at 00:00 UTC.` },
      429,
    )
  }

  let payload: GenerateRequest
  try {
    payload = await req.json() as GenerateRequest
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (!payload?.topic || typeof payload.topic !== 'string' || payload.topic.trim().length < 3) {
    return json({ error: 'Topic is required (min 3 chars)' }, 400)
  }
  if (payload.topic.length > 500) {
    return json({ error: 'Topic too long (max 500 chars)' }, 400)
  }
  if (payload.context && payload.context.length > 4000) {
    return json({ error: 'Context too long (max 4000 chars)' }, 400)
  }

  let result: Omit<GenerateResponse, 'remaining'>
  try {
    result = await callAnthropic(payload)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Upstream failure' }, 502)
  }

  // Increment quota (upsert)
  await adminClient
    .from('blog_generator_usage')
    .upsert(
      { user_id: userId, day, count: current + 1, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,day' },
    )

  return json({
    ...result,
    remaining: Math.max(0, DAILY_LIMIT - current - 1),
  })
})
