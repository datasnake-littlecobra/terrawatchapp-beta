// TerraWatch — Phase 9.8: Supabase-backed blog post storage.
//
// Replaces the Phase 9.7 build-time MD-file loader. Posts now live in
// public.blog_posts; admin UI does CRUD; public read goes through RLS
// (only published rows visible to non-admins). The two seed posts from
// migration 0019 keep /blog populated immediately after deploy.
//
// API parity with the old src/services/blog.ts:
//   - listPosts() / getPost(slug) / relatedPosts(slug, limit) — all kept
//     so existing views don't churn.
//   - Now async (DB-backed).
//
// Caching: simple in-memory cache keyed by query shape. Invalidated when
// the admin UI mutates posts (admin views call invalidateCache after
// publish/edit). Public consumers don't need to invalidate; the worst
// case is a stale draft showing as published for ~30s.

import { marked } from 'marked'
import { requireSupabase } from './supabase'

export interface BlogPost {
  id:            string
  slug:          string
  title:         string
  date:          Date
  excerpt:       string
  author:        string
  category:      string
  tags:          string[]
  heroImage:     string | null
  bodyHtml:      string
  bodyMd:        string
  readingMinutes: number
  published:     boolean
  publishedAt:   Date | null
}

interface BlogPostRow {
  id:               string
  slug:             string
  title:            string
  excerpt:          string | null
  body_md:          string
  category:         string
  tags:             string[]
  hero_image:       string | null
  published:        boolean
  author:           string
  published_at:     string | null
  reading_minutes:  number | null
  created_at:       string
  updated_at:       string
}

// 30 second cache window — short enough to feel live for the admin
// toggling published state, long enough to avoid hammering the DB on
// nav-bounces.
const CACHE_TTL_MS = 30_000

interface CacheEntry<T> { value: T; loaded: number }
const cache = new Map<string, CacheEntry<unknown>>()

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() - entry.loaded > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry.value
}
function cacheSet<T>(key: string, value: T): void {
  cache.set(key, { value, loaded: Date.now() })
}
export function invalidateBlogCache(): void {
  cache.clear()
}

function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

function rowToPost(row: BlogPostRow): BlogPost {
  const dateStr = row.published_at ?? row.created_at
  return {
    id:        row.id,
    slug:      row.slug,
    title:     row.title,
    date:      new Date(dateStr),
    excerpt:   row.excerpt ?? '',
    author:    row.author,
    category:  row.category,
    tags:      row.tags ?? [],
    heroImage: row.hero_image,
    bodyMd:    row.body_md,
    bodyHtml:  marked.parse(row.body_md, { async: false }) as string,
    readingMinutes: row.reading_minutes ?? readingTime(row.body_md),
    published:   row.published,
    publishedAt: row.published_at ? new Date(row.published_at) : null,
  }
}

// Public read — RLS handles the published filter. Authed admins also see
// drafts, but that path is /admin/blog so the public listPosts() ignores
// it. We do NOT pass a published filter explicitly; that's RLS's job.
export async function listPosts(): Promise<BlogPost[]> {
  const cached = cacheGet<BlogPost[]>('listPublic')
  if (cached) return cached

  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('published', true)
    .order('published_at', { ascending: false })
  if (error) throw error
  const posts = (data as BlogPostRow[]).map(rowToPost)
  cacheSet('listPublic', posts)
  return posts
}

export async function getPost(slug: string): Promise<BlogPost | null> {
  const cached = cacheGet<BlogPost>(`post:${slug}`)
  if (cached) return cached

  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const post = rowToPost(data as BlogPostRow)
  cacheSet(`post:${slug}`, post)
  return post
}

export async function relatedPosts(slug: string, limit = 3): Promise<BlogPost[]> {
  const all = await listPosts()
  const me = all.find((p) => p.slug === slug)
  if (!me) return all.slice(0, limit)
  const meTags = new Set(me.tags)
  return all
    .filter((p) => p.slug !== slug)
    .map((p) => {
      const tagOverlap = p.tags.reduce((n, t) => n + (meTags.has(t) ? 1 : 0), 0)
      return { post: p, score: tagOverlap + (p.category === me.category ? 1 : 0) }
    })
    .sort((a, b) => b.score - a.score || b.post.date.getTime() - a.post.date.getTime())
    .slice(0, limit)
    .map((s) => s.post)
}

// -------- Admin-only operations ------------------------------------------
// All gated by RLS: writes only succeed for is_admin() callers.

export async function listAllPostsAdmin(): Promise<BlogPost[]> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  invalidateBlogCache()
  return (data as BlogPostRow[]).map(rowToPost)
}

export async function getPostByIdAdmin(id: string): Promise<BlogPost | null> {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return rowToPost(data as BlogPostRow)
}

export interface BlogPostInput {
  slug:        string
  title:       string
  excerpt:     string
  body_md:     string
  category:    string
  tags:        string[]
  hero_image?: string | null
  author?:     string
  published?:  boolean
}

export async function createPostAdmin(input: BlogPostInput): Promise<BlogPost> {
  const supabase = requireSupabase()
  const reading_minutes = readingTime(input.body_md)
  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      slug:        input.slug,
      title:       input.title,
      excerpt:     input.excerpt,
      body_md:     input.body_md,
      category:    input.category,
      tags:        input.tags,
      hero_image:  input.hero_image ?? null,
      author:      input.author ?? 'DataSnake',
      published:   input.published ?? false,
      reading_minutes,
    })
    .select('*')
    .single()
  if (error) throw error
  invalidateBlogCache()
  return rowToPost(data as BlogPostRow)
}

export async function updatePostAdmin(id: string, input: Partial<BlogPostInput>): Promise<BlogPost> {
  const supabase = requireSupabase()
  const patch: Record<string, unknown> = { ...input }
  if (typeof input.body_md === 'string') {
    patch.reading_minutes = readingTime(input.body_md)
  }
  const { data, error } = await supabase
    .from('blog_posts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  invalidateBlogCache()
  return rowToPost(data as BlogPostRow)
}

export async function setPublishedAdmin(id: string, published: boolean): Promise<BlogPost> {
  return updatePostAdmin(id, { published })
}

export async function deletePostAdmin(id: string): Promise<void> {
  const supabase = requireSupabase()
  const { error } = await supabase.from('blog_posts').delete().eq('id', id)
  if (error) throw error
  invalidateBlogCache()
}
