// TerraWatch — Phase 9.8.1: Cloudflare Worker that injects per-post OG
// meta tags into the SPA shell for /blog/:slug routes.
//
// Why this exists: src/composables/useMeta.ts updates <title>, og:*, and
// twitter:* tags on route change client-side, but most social-platform
// crawlers (LinkedIn, Reddit, Facebook, WhatsApp) DO NOT execute
// JavaScript. They scrape whatever is in the static HTML shell. Without
// this Worker, deep links to a blog post show the site-wide defaults
// rather than the per-post title + image.
//
// What it does:
//   1. Match GET/HEAD on /blog/:slug.
//   2. Look up the post in Supabase via PostgREST using the public anon
//      key (RLS bound to published=true, so unpublished drafts never
//      leak).
//   3. Fetch the static SPA shell from the ASSETS binding.
//   4. Rewrite <title>, meta name="description", and the og:* /
//      twitter:* tags. Inject article:* tags for richer cards.
//   5. Return the rewritten HTML with a 5-minute CDN cache.
//   6. On any failure, fall through to the unmodified shell — better to
//      render the SPA than an error page.
//
// Required environment variables (set in Cloudflare dashboard →
// Worker → Settings → Variables and Secrets, plaintext):
//   SUPABASE_URL       — same value as VITE_SUPABASE_URL
//   SUPABASE_ANON_KEY  — same value as VITE_SUPABASE_ANON_KEY
// Both are public-by-design (RLS gates real access).

const SLUG_RE = /^\/blog\/([a-z0-9][a-z0-9-]*)\/?$/i

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function fetchPost(slug, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null
  const qs = new URLSearchParams({
    select: 'title,excerpt,hero_image,published_at,author',
    slug:   `eq.${slug}`,
    published: 'eq.true',
    limit:  '1',
  })
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/blog_posts?${qs.toString()}`, {
    headers: {
      'apikey':        env.SUPABASE_ANON_KEY,
      'authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      'accept':        'application/json',
    },
    cf: { cacheTtl: 60, cacheEverything: true },
  })
  if (!res.ok) return null
  const rows = await res.json()
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

async function renderBlogPost(slug, request, env) {
  const post = await fetchPost(slug, env)

  // Always serve the same shell — if the slug is unknown or the post is
  // unpublished, the SPA's BlogPostView will redirect to /blog client-side.
  const shellReq = new Request(new URL('/index.html', request.url), {
    method:  'GET',
    headers: request.headers,
  })
  const shellRes = await env.ASSETS.fetch(shellReq)
  if (!post) return shellRes

  const origin = new URL(request.url).origin
  const canonicalUrl = `${origin}/blog/${slug}`
  const title = `${post.title} — TerraWatch Blog`
  const description = (post.excerpt && post.excerpt.length)
    ? post.excerpt
    : `${post.title} — read on TerraWatch.`

  let imageUrl = ''
  if (post.hero_image) {
    imageUrl = String(post.hero_image).startsWith('http')
      ? post.hero_image
      : `${origin}${post.hero_image}`
  }

  let html = await shellRes.text()

  // Replace <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeText(title)}</title>`)

  // Replace meta name="description"
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeAttr(description)}" />`,
  )

  // Strip the default og:* and twitter:* tags from index.html so we can
  // emit a clean per-post block instead of dueling tags.
  html = html
    .replace(/<meta\s+property="og:[^"]+"\s+content="[^"]*"\s*\/?>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]+"\s+content="[^"]*"\s*\/?>/gi, '')

  const tags = [
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta property="og:url" content="${escapeAttr(canonicalUrl)}" />`,
    `<meta property="og:site_name" content="TerraWatch" />`,
    imageUrl ? `<meta property="og:image" content="${escapeAttr(imageUrl)}" />` : '',
    imageUrl ? `<meta property="og:image:alt" content="${escapeAttr(post.title)}" />` : '',
    post.published_at ? `<meta property="article:published_time" content="${escapeAttr(post.published_at)}" />` : '',
    post.author       ? `<meta property="article:author" content="${escapeAttr(post.author)}" />`               : '',
    `<meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
    imageUrl ? `<meta name="twitter:image" content="${escapeAttr(imageUrl)}" />` : '',
  ].filter(Boolean).join('\n    ')

  // Inject just before </head>. Falls through harmlessly if shell is missing </head>.
  html = html.replace('</head>', `    ${tags}\n  </head>`)

  return new Response(html, {
    status: 200,
    headers: {
      'content-type':  'text/html;charset=utf-8',
      // 5-minute CDN cache. LinkedIn caches aggressively at their end too;
      // use their post inspector to force-refresh after a title edit.
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const m = url.pathname.match(SLUG_RE)
    if (m && (request.method === 'GET' || request.method === 'HEAD')) {
      try {
        return await renderBlogPost(m[1], request, env)
      } catch (_e) {
        // Fall through to ASSETS on any error so we never serve a 5xx.
        return env.ASSETS.fetch(request)
      }
    }
    return env.ASSETS.fetch(request)
  },
}
