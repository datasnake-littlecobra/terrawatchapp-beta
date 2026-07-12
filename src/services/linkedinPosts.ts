// TerraWatch — Phase 9.17: LinkedIn posts admin client.
//
// Mirrors src/services/blogDb.ts pattern. RLS gates everything; service
// just wraps the queries. The generatePost call goes through the
// Edge Function (which inserts the draft server-side); everything else
// is direct table CRUD that RLS enforces is admin-only.

import { supabase } from './supabase'

export type LinkedInPostStatus =
  | 'draft' | 'approved' | 'scheduled' | 'published' | 'failed' | 'rejected'

export interface LinkedInPost {
  id:             string
  topicHash:      string
  topicText:      string
  status:         LinkedInPostStatus
  content:        string
  hashtags:       string[]
  scheduledFor:   Date | null
  publishedAt:    Date | null
  linkedinUrn:    string | null
  publishError:   string | null
  generatedBy:    string | null
  approvedBy:     string | null
  createdAt:      Date
  updatedAt:      Date
}

interface Row {
  id:             string
  topic_hash:     string
  topic_text:     string
  status:         LinkedInPostStatus
  content:        string
  hashtags:       string[]
  scheduled_for:  string | null
  published_at:   string | null
  linkedin_urn:   string | null
  publish_error:  string | null
  generated_by:   string | null
  approved_by:    string | null
  created_at:     string
  updated_at:     string
}

function rowToPost(r: Row): LinkedInPost {
  return {
    id:           r.id,
    topicHash:    r.topic_hash,
    topicText:    r.topic_text,
    status:       r.status,
    content:      r.content,
    hashtags:     r.hashtags ?? [],
    scheduledFor: r.scheduled_for ? new Date(r.scheduled_for) : null,
    publishedAt:  r.published_at  ? new Date(r.published_at)  : null,
    linkedinUrn:  r.linkedin_urn,
    publishError: r.publish_error,
    generatedBy:  r.generated_by,
    approvedBy:   r.approved_by,
    createdAt:    new Date(r.created_at),
    updatedAt:    new Date(r.updated_at),
  }
}

export async function listLinkedInPosts(): Promise<LinkedInPost[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('linkedin_posts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Row[]).map(rowToPost)
}

export async function getLinkedInPost(id: string): Promise<LinkedInPost | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('linkedin_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? rowToPost(data as Row) : null
}

export async function updateLinkedInPost(
  id: string,
  patch: { content?: string; hashtags?: string[]; scheduled_for?: string | null },
): Promise<LinkedInPost> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('linkedin_posts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Update failed')
  return rowToPost(data as Row)
}

export async function setLinkedInPostStatus(
  id: string,
  status: LinkedInPostStatus,
  extra: { scheduled_for?: string | null; approved_by?: string | null } = {},
): Promise<LinkedInPost> {
  if (!supabase) throw new Error('Supabase not configured')
  const patch: Record<string, unknown> = { status, ...extra }
  const { data, error } = await supabase
    .from('linkedin_posts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Update failed')
  return rowToPost(data as Row)
}

export async function deleteLinkedInPost(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from('linkedin_posts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// =====================================================================
// Edge Function caller — generate-linkedin-post
// =====================================================================

export interface GenerateResult {
  ok:         boolean
  post_id?:   string
  topic_text?: string
  remaining?: number | null
  error?:     string
}

export async function generateLinkedInPost(topicOverride?: string): Promise<GenerateResult> {
  if (!supabase) throw new Error('Supabase not configured')
  const body: Record<string, unknown> = { source: 'manual' }
  if (topicOverride && topicOverride.trim()) body.topic_override = topicOverride.trim()
  const { data, error } = await supabase.functions.invoke<GenerateResult>(
    'generate-linkedin-post',
    { body },
  )
  if (error) {
    let msg = error.message || 'Generation failed'
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.clone().json()
        if (body?.error) msg = `${body.error} (HTTP ${ctx.status})`
      }
    } catch { /* keep generic */ }
    throw new Error(msg)
  }
  if (!data) throw new Error('No response from server')
  return data
}
