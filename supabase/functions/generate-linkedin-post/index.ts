// TerraWatch — Phase 9.17: LinkedIn post generator (admin-only).
//
// Reads docs/LINKEDIN_FEED.md from GitHub raw, picks the oldest topic
// whose sha256 hash is NOT in public.linkedin_posts, asks Claude to
// draft a polished LinkedIn post, writes a row with status='draft'.
//
// Mirrors generate-blog (Phase 9.9) for auth + quota + Anthropic call
// pattern. Smaller output shape (single LinkedIn variant) and the
// topic-source-from-doc is the new bit.
//
// Defense in depth:
//   - JWT required when called by an admin from the UI.
//   - Cron calls bypass JWT by using x-ingest-secret header (same
//     pattern as the ingest functions). When that header matches
//     INGEST_SECRET, the function uses the first admin user as the
//     attribution + skips the quota check.
//   - Server-side is_admin() check on the JWT path.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.3'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const INGEST_SECRET = Deno.env.get('INGEST_SECRET') ?? ''
const DAILY_LIMIT = Number(Deno.env.get('LINKEDIN_GEN_DAILY_LIMIT') ?? '5')
const MODEL = 'claude-sonnet-4-6'

// Where to fetch docs/LINKEDIN_FEED.md from. Defaults to the feature
// branch's raw URL on GitHub. Override at deploy time with
// LINKEDIN_FEED_URL secret once on main.
const LINKEDIN_FEED_URL = Deno.env.get('LINKEDIN_FEED_URL')
  ?? 'https://raw.githubusercontent.com/datasnake-littlecobra/terrawatchapp-beta/main/docs/LINKEDIN_FEED.md'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ingest-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface GenerateRequest {
  topic_override?: string             // bypass the doc-feed lookup
  source?:         'manual' | 'cron'  // attribution hint, not enforced
}

interface LinkedInDraft {
  content:  string
  hashtags: string[]
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

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// =====================================================================
// Topic feed parsing
// =====================================================================

interface FeedTopic { text: string; hash: string }
interface ParsedFeed { topics: FeedTopic[]; styleNotes: string }

async function fetchFeed(): Promise<string> {
  const res = await fetch(LINKEDIN_FEED_URL, {
    headers: { 'cache-control': 'no-cache' },
  })
  if (!res.ok) throw new Error(`LINKEDIN_FEED_URL fetch failed: ${res.status}`)
  return await res.text()
}

async function parseFeed(text: string): Promise<ParsedFeed> {
  const topics: FeedTopic[] = []
  const lines = text.split(/\r?\n/)
  let inTopics = false
  let styleStart = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (/^## Topics\b/i.test(line))      { inTopics = true; continue }
    if (/^## Style notes\b/i.test(line)) { inTopics = false; styleStart = i; break }
    if (/^##\s/.test(line))              { inTopics = false; continue }
    if (inTopics) {
      const m = line.match(/^-\s+(.+?)\s*$/)
      if (m) {
        const text = m[1]!
        topics.push({ text, hash: await sha256Hex(text) })
      }
    }
  }
  const styleNotes = styleStart >= 0
    ? lines.slice(styleStart).join('\n').trim()
    : ''
  return { topics, styleNotes }
}

// =====================================================================
// Anthropic call
// =====================================================================

const SYSTEM_PROMPT = `You are the editorial assistant for the DataSnake LinkedIn
company page. DataSnake builds climate + insurance intelligence: real-time
hazard monitoring, an underwater + ground sensor fleet, and a Risk API that
serves insurers. The voice is honest, technically credible, and audience-aware.

Given a TOPIC (one short sentence) plus STYLE NOTES (persistent guidance
provided by the founder), return ONE structured JSON object:

{
  "content": string,    // the LinkedIn post body, 200-400 words, 2-3 paragraphs separated by blank lines, no hashtags inline
  "hashtags": string[]  // 3-5 hashtags each starting with '#'
}

Rules:
- Output ONLY the JSON object. No prose before or after. No markdown fences.
- Do not address the user. No "Here is the post:" framing.
- Do not invent product features. Stay specific to the topic.
- Do not invent statistics. Speak qualitatively if numbers aren't in the topic.
- Follow the style notes verbatim — voice, structure, hashtag guidance.
- Keep the first 1-2 lines strong; LinkedIn truncates after ~150 chars.
- No emoji unless the style notes say otherwise.`

function buildUserPrompt(topic: string, styleNotes: string): string {
  return [
    `TOPIC: ${topic}`,
    '',
    'STYLE NOTES:',
    styleNotes || '(none provided — default to professional voice, 3-5 hashtags, 200-400 words)',
  ].join('\n')
}

async function callAnthropic(topic: string, styleNotes: string): Promise<LinkedInDraft> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(topic, styleNotes) }],
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Anthropic ${res.status}: ${body}`)
  }
  const data = await res.json() as { content?: Array<{ type: string; text?: string }> }
  const text = data.content?.find((c) => c.type === 'text')?.text ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('generate-linkedin-post returned non-JSON response')
  let parsed: any
  try {
    parsed = JSON.parse(match[0])
  } catch (e) {
    throw new Error('Malformed JSON from Claude: ' + (e instanceof Error ? e.message : 'unknown'))
  }
  const content = String(parsed?.content ?? '').trim()
  const hashtags = Array.isArray(parsed?.hashtags)
    ? parsed.hashtags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 8)
    : []
  if (!content) throw new Error('Claude returned empty content')
  return { content, hashtags }
}

// =====================================================================
// Main handler
// =====================================================================

serve(async (req) => {
  console.log(`[generate-linkedin-post] ${req.method} ${req.url}`)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfigured' }, 500)
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ---- Auth: either user-JWT or cron secret -------------------------
  let userId: string | null = null
  let skipQuota = false

  const ingestSecret = req.headers.get('x-ingest-secret') ?? ''
  if (INGEST_SECRET && ingestSecret === INGEST_SECRET) {
    // Cron path. Attribute to the first admin in the system.
    const { data: firstAdmin } = await adminClient
      .from('user_profiles')
      .select('user_id')
      .eq('role', 'admin')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    userId = (firstAdmin as { user_id?: string } | null)?.user_id ?? null
    if (!userId) {
      console.error('[generate-linkedin-post] cron call but no admin user to attribute to')
      return json({ error: 'No admin user found to attribute draft to' }, 500)
    }
    skipQuota = true
    console.log(`[generate-linkedin-post] cron path; attribution user=${userId}`)
  } else {
    // JWT path.
    const authHeader = req.headers.get('authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ error: 'Unauthorized' }, 401)
    const { data: userData, error: userErr } = await adminClient.auth.getUser(jwt)
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)
    userId = userData.user.id

    const { data: profile, error: profileErr } = await adminClient
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()
    if (profileErr) return json({ error: 'Profile lookup failed' }, 500)
    if ((profile as { role?: string } | null)?.role !== 'admin') {
      return json({ error: 'Admin access required' }, 403)
    }
  }

  // ---- Quota (skipped on cron path) ---------------------------------
  let current = 0
  if (!skipQuota) {
    const day = today()
    const { data: usageRow } = await adminClient
      .from('linkedin_generator_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('day', day)
      .maybeSingle()
    current = (usageRow as { count?: number } | null)?.count ?? 0
    if (current >= DAILY_LIMIT) {
      return json(
        { error: `Daily limit of ${DAILY_LIMIT} generations reached. Resets at 00:00 UTC.` },
        429,
      )
    }
  }

  // ---- Body parse ---------------------------------------------------
  let payload: GenerateRequest = {}
  try {
    payload = await req.json() as GenerateRequest
  } catch { /* empty body is fine for cron path */ }

  // ---- Pick topic ---------------------------------------------------
  let topicText: string
  let topicHash: string
  if (payload.topic_override && payload.topic_override.trim().length >= 3) {
    topicText = payload.topic_override.trim()
    topicHash = await sha256Hex(topicText)
  } else {
    let feed: ParsedFeed
    try {
      const raw = await fetchFeed()
      feed = await parseFeed(raw)
    } catch (e) {
      console.error('[generate-linkedin-post] feed fetch/parse failed:', e)
      return json({ error: e instanceof Error ? e.message : 'Feed read failed' }, 502)
    }
    if (!feed.topics.length) {
      return json({ error: 'No topics found in docs/LINKEDIN_FEED.md under ## Topics.' }, 422)
    }
    // Find the oldest unprocessed topic.
    const hashes = feed.topics.map((t) => t.hash)
    const { data: existing } = await adminClient
      .from('linkedin_posts')
      .select('topic_hash')
      .in('topic_hash', hashes)
    const consumed = new Set(((existing ?? []) as Array<{ topic_hash: string }>).map((r) => r.topic_hash))
    const next = feed.topics.find((t) => !consumed.has(t.hash))
    if (!next) {
      return json({
        error: 'All topics in docs/LINKEDIN_FEED.md have been processed. Add a new bullet under ## Topics or pass topic_override.',
      }, 200)
    }
    topicText = next.text
    topicHash = next.hash
    var styleNotes = feed.styleNotes
  }

  // ---- Generate -----------------------------------------------------
  // styleNotes is unset when topic_override is used; pass empty.
  // @ts-ignore — styleNotes is hoisted by var above when feed path is used
  const finalStyleNotes = typeof styleNotes === 'string' ? styleNotes : ''
  let draft: LinkedInDraft
  try {
    draft = await callAnthropic(topicText, finalStyleNotes)
  } catch (e) {
    console.error('[generate-linkedin-post] Anthropic call failed:', e)
    return json({ error: e instanceof Error ? e.message : 'Upstream failure' }, 502)
  }

  // ---- Insert draft -------------------------------------------------
  const { data: inserted, error: insertErr } = await adminClient
    .from('linkedin_posts')
    .insert({
      topic_hash:   topicHash,
      topic_text:   topicText,
      status:       'draft',
      content:      draft.content,
      hashtags:     draft.hashtags,
      generated_by: userId,
    })
    .select('id')
    .single()
  if (insertErr || !inserted) {
    // Unique-violation on topic_hash means another concurrent run
    // already drafted this topic. Surface a friendly note.
    if (insertErr?.code === '23505') {
      return json({ error: 'Topic already drafted by a concurrent run.' }, 409)
    }
    console.error('[generate-linkedin-post] insert failed:', insertErr)
    return json({ error: insertErr?.message ?? 'Insert failed' }, 500)
  }

  // ---- Increment quota (skip on cron) -------------------------------
  if (!skipQuota) {
    await adminClient
      .from('linkedin_generator_usage')
      .upsert(
        { user_id: userId, day: today(), count: current + 1, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,day' },
      )
  }

  console.log(`[generate-linkedin-post] success post_id=${(inserted as { id: string }).id}`)
  return json({
    ok: true,
    post_id: (inserted as { id: string }).id,
    topic_text: topicText,
    remaining: skipQuota ? null : Math.max(0, DAILY_LIMIT - current - 1),
  })
})
