// TerraWatch — Phase 9.8: client-side <meta> tag manager.
//
// Updates document.title and the standard OG / Twitter card meta tags on
// route change. Used primarily by /blog/:slug to give each post its own
// social-preview metadata.
//
// Important caveat (documented in DEPLOY.md): most social-platform
// crawlers (LinkedIn, Reddit, Facebook) do not execute JavaScript, so
// they will NOT see these client-side updates — they fall back to whatever
// is in index.html. Twitter and Discord are partial exceptions. For
// per-post link previews to actually work in those platforms we'd need
// server-side meta-tag injection (Phase 9.8.1 fast-follow: Cloudflare
// Worker that intercepts /blog/:slug and rewrites the SPA shell). This
// composable gets us the in-app behavior right — page title in browser
// tabs, browser-history, and meta-aware bots that DO run JS.

import { onUnmounted, watch, type Ref } from 'vue'

export interface MetaInput {
  title?:       string
  description?: string
  image?:       string         // absolute URL
  url?:         string         // canonical URL; defaults to current location
  type?:        'website' | 'article'
  author?:      string
  publishedAt?: string         // ISO date for article type
}

const DEFAULTS: Required<Pick<MetaInput, 'title' | 'description' | 'type'>> = {
  title:       "TerraWatch — Know the ground you're on.",
  description: 'Real-time environmental intelligence — earthquakes, weather, space, ocean — for where you are and where you are going.',
  type:        'website',
}

// Set or create a tag matching `selector`. We store original values on
// first set so we can restore them on unmount — important for SPA
// navigation where the page-specific meta should not bleed into
// subsequent pages.
type TagState = { el: HTMLMetaElement; original: string | null }
const restoreStack: TagState[] = []

function setMetaProperty(property: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
  let original: string | null = null
  if (el) {
    original = el.getAttribute('content')
  } else {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
  restoreStack.push({ el, original })
}

function setMetaName(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  let original: string | null = null
  if (el) {
    original = el.getAttribute('content')
  } else {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
  restoreStack.push({ el, original })
}

function restoreAll() {
  while (restoreStack.length) {
    const entry = restoreStack.pop()
    if (!entry) continue
    if (entry.original === null) {
      entry.el.removeAttribute('content')
    } else {
      entry.el.setAttribute('content', entry.original)
    }
  }
}

function applyMeta(meta: MetaInput) {
  // Always reset previous overrides before applying new ones — otherwise
  // the per-call diff stacks and restoreAll() leaks across navigations.
  restoreAll()

  const title = meta.title ?? DEFAULTS.title
  const description = meta.description ?? DEFAULTS.description
  const type = meta.type ?? DEFAULTS.type
  const url = meta.url ?? (typeof window !== 'undefined' ? window.location.href : '')

  document.title = title

  setMetaName('description', description)

  setMetaProperty('og:title', title)
  setMetaProperty('og:description', description)
  setMetaProperty('og:type', type)
  if (url) setMetaProperty('og:url', url)
  if (meta.image) setMetaProperty('og:image', meta.image)

  setMetaName('twitter:card', meta.image ? 'summary_large_image' : 'summary')
  setMetaName('twitter:title', title)
  setMetaName('twitter:description', description)
  if (meta.image) setMetaName('twitter:image', meta.image)

  if (type === 'article') {
    if (meta.author) setMetaProperty('article:author', meta.author)
    if (meta.publishedAt) setMetaProperty('article:published_time', meta.publishedAt)
  }
}

/**
 * Reactively applies meta tags from a ref. The tags are restored to their
 * pre-set values when the component unmounts so SPA navigation doesn't
 * leak page-specific OG state into the next route.
 */
export function useMeta(source: Ref<MetaInput | null | undefined> | (() => MetaInput | null | undefined)): void {
  if (typeof window === 'undefined') return

  const stop = watch(
    source,
    (val) => {
      if (val) applyMeta(val)
      else applyMeta({})
    },
    { immediate: true, deep: true },
  )

  onUnmounted(() => {
    stop()
    restoreAll()
  })
}
