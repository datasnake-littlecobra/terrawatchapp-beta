<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { getPost, relatedPosts } from '@/services/blog'

const route = useRoute()
const router = useRouter()

const slug = computed(() => String(route.params.slug ?? ''))
const post = computed(() => getPost(slug.value))
const related = computed(() => post.value ? relatedPosts(post.value.slug, 3) : [])

// Hard-redirect to /blog if slug doesn't resolve. Avoids a stale 404 in
// router history if the user typo'd the URL.
watchEffect(() => {
  if (slug.value && !post.value) {
    router.replace('/blog')
  }
})

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}
</script>

<template>
  <article v-if="post" class="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <!-- Back link -->
    <RouterLink
      to="/blog"
      class="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink-primary text-sm mb-6 transition-colors"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" class="w-4 h-4">
        <path d="m15 18-6-6 6-6"/>
      </svg>
      All posts
    </RouterLink>

    <!-- Header -->
    <header class="mb-8">
      <div class="flex items-center gap-2 text-xs text-ink-muted mb-3">
        <span class="num">{{ fmtDate(post.date) }}</span>
        <span>·</span>
        <span class="uppercase tracking-wider text-[10px] font-semibold text-ink-muted/70">
          {{ post.category }}
        </span>
        <span>·</span>
        <span class="num">{{ post.readingMinutes }} min read</span>
      </div>
      <h1 class="text-2xl sm:text-4xl font-semibold text-ink-primary leading-tight">
        {{ post.title }}
      </h1>
      <p class="text-ink-muted text-sm mt-2">By {{ post.author }}</p>
    </header>

    <!-- Body — prose styling lives here, not in services/blog.ts -->
    <div
      class="prose-ink"
      v-html="post.bodyHtml"
    />

    <!-- Tags -->
    <div v-if="post.tags.length" class="mt-10 pt-6 border-t border-white/5">
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="t in post.tags"
          :key="t"
          class="text-[10px] uppercase tracking-wider text-ink-muted/70 border border-white/10 rounded px-1.5 py-0.5"
        >{{ t }}</span>
      </div>
    </div>

    <!-- Related posts -->
    <section v-if="related.length" class="mt-12 pt-8 border-t border-white/5">
      <h2 class="text-[10px] font-semibold tracking-widest uppercase text-ink-muted/70 mb-4">
        More posts
      </h2>
      <ul class="space-y-4">
        <li v-for="r in related" :key="r.slug">
          <RouterLink :to="`/blog/${r.slug}`" class="group block">
            <p class="text-sm font-medium text-ink-primary group-hover:text-accent transition-colors">
              {{ r.title }}
            </p>
            <p class="text-ink-muted text-xs mt-0.5">{{ r.excerpt }}</p>
          </RouterLink>
        </li>
      </ul>
    </section>
  </article>
</template>

<style>
/*
  Minimal "prose" styling for rendered markdown — keeps the post body
  legible on dark surface without pulling in the full @tailwindcss/typography
  package. Defines just the elements `marked` actually emits for our posts.
*/
.prose-ink {
  color: rgb(230 237 247 / 0.85);
  line-height: 1.7;
  font-size: 0.95rem;
}
@media (min-width: 640px) {
  .prose-ink { font-size: 1.05rem; }
}
.prose-ink p {
  margin: 1em 0;
}
.prose-ink h2 {
  color: rgb(230 237 247);
  font-size: 1.5rem;
  font-weight: 600;
  margin: 2em 0 0.6em;
  letter-spacing: -0.01em;
}
.prose-ink h3 {
  color: rgb(230 237 247);
  font-size: 1.2rem;
  font-weight: 600;
  margin: 1.5em 0 0.4em;
}
.prose-ink strong {
  color: rgb(230 237 247);
  font-weight: 600;
}
.prose-ink em {
  color: rgb(230 237 247);
  font-style: italic;
}
.prose-ink a {
  color: rgb(63 169 245);
  text-decoration: none;
  border-bottom: 1px solid rgb(63 169 245 / 0.4);
  transition: border-color 0.15s;
}
.prose-ink a:hover {
  border-color: rgb(63 169 245);
}
.prose-ink ul, .prose-ink ol {
  margin: 1em 0;
  padding-left: 1.5em;
}
.prose-ink li {
  margin: 0.4em 0;
}
.prose-ink blockquote {
  border-left: 3px solid rgb(63 169 245 / 0.5);
  padding-left: 1em;
  color: rgb(138 151 177);
  margin: 1.5em 0;
  font-style: italic;
}
.prose-ink code {
  background: rgb(17 26 46);
  border: 1px solid rgb(255 255 255 / 0.05);
  border-radius: 4px;
  padding: 0.1em 0.4em;
  font-family: ui-monospace, "Geist Mono", monospace;
  font-size: 0.85em;
  color: rgb(230 237 247);
}
.prose-ink pre {
  background: rgb(11 18 32);
  border: 1px solid rgb(255 255 255 / 0.05);
  border-radius: 8px;
  padding: 1em;
  overflow-x: auto;
  margin: 1.2em 0;
}
.prose-ink pre code {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 0.85em;
  line-height: 1.5;
}
.prose-ink hr {
  border: none;
  border-top: 1px solid rgb(255 255 255 / 0.1);
  margin: 2em 0;
}
</style>
