// TerraWatch — Phase 9.7: blog post loader for MD-files-in-repo strategy.
//
// Posts live in /content/blog/*.md with YAML-style frontmatter. We use
// Vite's import.meta.glob to bundle them at build time — zero runtime
// cost, zero Supabase round-trips. When we eventually want admin-edited
// posts (post Phase 10 auth), this swaps to a Supabase-backed loader
// without changing the public API.
//
// Frontmatter format:
//   ---
//   title: "Why we built TerraWatch the way we did"
//   slug: why-we-built-terrawatch
//   date: 2026-05-05
//   excerpt: "Short blurb shown on the index page."
//   author: "DataSnake"
//   category: "engineering" | "vision" | "release-notes"
//   tags: [hazards, vue, supabase]
//   ---
//   <body markdown here>

import { marked } from 'marked'

export interface BlogPost {
  slug:     string
  title:    string
  date:     Date
  excerpt:  string
  author:   string
  category: string
  tags:     string[]
  bodyHtml: string
  bodyMd:   string
  readingMinutes: number
}

interface Frontmatter {
  title?:    string
  slug?:     string
  date?:     string
  excerpt?:  string
  author?:   string
  category?: string
  tags?:     string[]
}

// Inline frontmatter parser — keeps us off `gray-matter` (which pulls in a
// browser-incompatible Buffer). Only handles flat strings + a string-array
// for `tags`. Adequate for what we need; bail to a richer parser only if a
// post body legitimately needs nested YAML.
function parseFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: raw }
  const fm: Frontmatter = {}
  const lines = (match[1] ?? '').split(/\r?\n/)
  for (const line of lines) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (!kv) continue
    const key = kv[1] as keyof Frontmatter
    let value = (kv[2] ?? '').trim()
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    if (key === 'tags') {
      const arr = value.match(/^\[(.*)\]$/)
      if (arr) {
        ;(fm as Record<string, unknown>)[key] = arr[1]!
          .split(',')
          .map((t) => t.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean)
      }
    } else {
      ;(fm as Record<string, unknown>)[key] = value
    }
  }
  return { frontmatter: fm, body: match[2] ?? '' }
}

// Estimate at 200 wpm — close enough for the "5 min read" badge.
function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

function slugFromPath(path: string): string {
  const m = path.match(/\/([^/]+)\.md$/)
  return m ? (m[1] ?? '') : ''
}

// import.meta.glob with `?raw` returns each file as a string at build time.
// `eager: true` means everything's bundled into the main chunk for /blog —
// fine for ~10 posts; switch to lazy if we ever exceed ~50.
const FILES = import.meta.glob<string>('/content/blog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

function buildPost(path: string, raw: string): BlogPost | null {
  const { frontmatter, body } = parseFrontmatter(raw)
  if (!frontmatter.title) return null

  const slug = frontmatter.slug || slugFromPath(path)
  if (!slug) return null

  const dateStr = frontmatter.date ?? new Date().toISOString().slice(0, 10)
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return null

  return {
    slug,
    title:    frontmatter.title,
    date,
    excerpt:  frontmatter.excerpt   ?? '',
    author:   frontmatter.author    ?? 'DataSnake',
    category: frontmatter.category  ?? 'general',
    tags:     frontmatter.tags      ?? [],
    bodyMd:   body,
    bodyHtml: marked.parse(body, { async: false }) as string,
    readingMinutes: readingTime(body),
  }
}

// Eager-loaded module-scope cache. Posts are static — no need to recompute
// on every nav. Sorted newest-first so the index renders chronologically.
const POSTS: BlogPost[] = Object.entries(FILES)
  .map(([path, raw]) => buildPost(path, raw))
  .filter((p): p is BlogPost => p !== null)
  .sort((a, b) => b.date.getTime() - a.date.getTime())

export function listPosts(): BlogPost[] {
  return POSTS
}

export function getPost(slug: string): BlogPost | null {
  return POSTS.find((p) => p.slug === slug) ?? null
}

export function relatedPosts(slug: string, limit = 3): BlogPost[] {
  const me = getPost(slug)
  if (!me) return POSTS.slice(0, limit)
  return POSTS
    .filter((p) => p.slug !== slug)
    .map((p) => ({ post: p, score: tagOverlap(p.tags, me.tags) + (p.category === me.category ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || b.post.date.getTime() - a.post.date.getTime())
    .slice(0, limit)
    .map((s) => s.post)
}

function tagOverlap(a: string[], b: string[]): number {
  const set = new Set(a)
  let n = 0
  for (const t of b) if (set.has(t)) n++
  return n
}
