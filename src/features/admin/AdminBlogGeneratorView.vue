<script setup lang="ts">
// TerraWatch — Phase 9.9: AI blog generator UI (admin-only).
//
// One topic in → four platform-tailored outputs out. Tabs let the admin
// preview each variant; per-tab Copy ships the formatted text to the
// clipboard for manual paste into the destination platform. "Save app
// version as draft" persists the canonical post into public.blog_posts
// with published=false; admin uses /admin/blog to flip it live.

import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { marked } from 'marked'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import {
  generateBlog,
  GenerateBlogAuthError,
  GenerateBlogForbiddenError,
  GenerateBlogQuotaError,
  type GenerateBlogResponse,
} from '@/services/generateBlog'
import { createPostAdmin } from '@/services/blogDb'

type Tab = 'app' | 'linkedin' | 'reddit' | 'instagram'

const router = useRouter()

const topic = ref('')
const context = ref('')
const tone = ref<'professional' | 'conversational' | 'enthusiastic'>('professional')
const audience = ref<'general' | 'technical' | 'investor'>('general')

const result = ref<GenerateBlogResponse | null>(null)
const generating = ref(false)
const errorMsg = ref<string | null>(null)
const activeTab = ref<Tab>('app')
const copiedTab = ref<Tab | null>(null)
const saving = ref(false)
const savedPostId = ref<string | null>(null)

const remaining = computed(() => result.value?.remaining ?? null)

async function generate() {
  if (generating.value) return
  if (topic.value.trim().length < 3) {
    errorMsg.value = 'Enter a topic of at least a few words.'
    return
  }
  generating.value = true
  errorMsg.value = null
  result.value = null
  savedPostId.value = null
  try {
    const req: Parameters<typeof generateBlog>[0] = {
      topic: topic.value.trim(),
      tone:  tone.value,
      audience: audience.value,
    }
    if (context.value.trim()) req.context = context.value.trim()
    result.value = await generateBlog(req)
    activeTab.value = 'app'
  } catch (e) {
    if (e instanceof GenerateBlogQuotaError) {
      errorMsg.value = e.message
    } else if (e instanceof GenerateBlogAuthError) {
      errorMsg.value = 'Please sign in.'
    } else if (e instanceof GenerateBlogForbiddenError) {
      errorMsg.value = "Admin access required."
    } else {
      errorMsg.value = e instanceof Error ? e.message : 'Generation failed.'
    }
  } finally {
    generating.value = false
  }
}

const appBodyHtml = computed(() => {
  const md = result.value?.app.body_md
  if (!md) return ''
  return marked.parse(md, { async: false }) as string
})

function tabContent(tab: Tab): string {
  if (!result.value) return ''
  if (tab === 'app') {
    const a = result.value.app
    return `# ${a.title}\n\n${a.excerpt}\n\n${a.body_md}\n\n---\nCategory: ${a.category}\nTags: ${a.tags.join(', ')}`
  }
  if (tab === 'linkedin') {
    const l = result.value.linkedin
    return `${l.post}\n\n${l.hashtags.join(' ')}`
  }
  if (tab === 'reddit') {
    const r = result.value.reddit
    return `Title: ${r.title}\n\n${r.body}\n\nSuggested subreddits: ${r.subreddits.join(', ')}`
  }
  const i = result.value.instagram
  return `${i.caption}\n\n${i.hashtags.join(' ')}\n\n[Image prompt: ${i.image_prompt}]`
}

async function copyTab(tab: Tab) {
  try {
    await navigator.clipboard.writeText(tabContent(tab))
    copiedTab.value = tab
    setTimeout(() => {
      if (copiedTab.value === tab) copiedTab.value = null
    }, 1800)
  } catch {
    errorMsg.value = 'Clipboard access denied.'
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function saveAppDraft() {
  if (!result.value || saving.value) return
  saving.value = true
  errorMsg.value = null
  try {
    const a = result.value.app
    const post = await createPostAdmin({
      slug:     slugify(a.title) || `draft-${Date.now()}`,
      title:    a.title,
      excerpt:  a.excerpt,
      body_md:  a.body_md,
      category: a.category,
      tags:     a.tags,
      published: false,
    })
    savedPostId.value = post.id
    setTimeout(() => router.push(`/admin/blog/${post.id}`), 600)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Save failed.'
  } finally {
    saving.value = false
  }
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'app',       label: 'App' },
  { id: 'linkedin',  label: 'LinkedIn' },
  { id: 'reddit',    label: 'Reddit' },
  { id: 'instagram', label: 'Instagram' },
]
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-8">
    <header class="mb-6">
      <p class="text-ink-muted text-xs tracking-widest uppercase">Admin · Generate</p>
      <h1 class="text-2xl sm:text-3xl font-semibold mt-1">New post</h1>
      <p class="text-ink-muted text-sm mt-1">
        Topic in. Four platform-tailored drafts out: app blog, LinkedIn, Reddit, Instagram.
        Copy each variant, paste it into the destination platform, then save the app version
        as a draft to refine and publish.
      </p>
    </header>

    <!-- Generation form -->
    <Card padded elevated>
      <form class="space-y-3" @submit.prevent="generate">
        <label class="block">
          <span class="text-ink-muted text-xs tracking-widest uppercase">Topic</span>
          <textarea
            v-model="topic"
            rows="2"
            required
            placeholder="What's the post about? E.g. 'How we shipped the ocean monitoring dashboard in five days'"
            class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl px-3 py-2 text-sm"
            maxlength="500"
          ></textarea>
        </label>

        <label class="block">
          <span class="text-ink-muted text-xs tracking-widest uppercase">Optional context</span>
          <textarea
            v-model="context"
            rows="3"
            placeholder="Any specifics the model should ground in — links, numbers, source names, prior posts to reference, etc."
            class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl px-3 py-2 text-sm"
            maxlength="4000"
          ></textarea>
        </label>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="block">
            <span class="text-ink-muted text-xs tracking-widest uppercase">Audience</span>
            <select
              v-model="audience"
              class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-10 px-3 text-sm"
            >
              <option value="general">General</option>
              <option value="technical">Technical</option>
              <option value="investor">Investor</option>
            </select>
          </label>
          <label class="block">
            <span class="text-ink-muted text-xs tracking-widest uppercase">Tone</span>
            <select
              v-model="tone"
              class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-10 px-3 text-sm"
            >
              <option value="professional">Professional</option>
              <option value="conversational">Conversational</option>
              <option value="enthusiastic">Enthusiastic</option>
            </select>
          </label>
        </div>

        <div class="flex flex-wrap gap-3 items-center pt-2">
          <Button type="submit" variant="primary" size="md" :disabled="generating">
            <span v-if="generating">Generating…</span>
            <span v-else>⚡ Generate</span>
          </Button>
          <span v-if="remaining !== null" class="text-xs text-ink-muted">
            {{ remaining }} generations left today
          </span>
        </div>

        <p v-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>
      </form>
    </Card>

    <!-- Result tabs -->
    <Card v-if="result" padded elevated class="mt-6">
      <!-- Tab strip -->
      <div class="flex gap-1 p-1 rounded-xl border border-white/10 bg-surface-0 mb-4 overflow-x-auto">
        <button
          v-for="t in TABS"
          :key="t.id"
          type="button"
          class="h-9 px-4 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
          :class="activeTab === t.id
            ? 'bg-accent/20 text-accent'
            : 'text-ink-muted hover:text-ink-primary'"
          @click="activeTab = t.id"
        >{{ t.label }}</button>
      </div>

      <!-- App tab -->
      <div v-if="activeTab === 'app'" class="space-y-3">
        <div>
          <span class="text-[10px] uppercase tracking-wider text-ink-muted/70">Title</span>
          <p class="text-lg font-semibold text-ink-primary">{{ result.app.title }}</p>
        </div>
        <div>
          <span class="text-[10px] uppercase tracking-wider text-ink-muted/70">Excerpt</span>
          <p class="text-sm text-ink-muted">{{ result.app.excerpt }}</p>
        </div>
        <div class="flex flex-wrap gap-2 items-center text-xs">
          <span class="text-[10px] uppercase tracking-wider text-ink-muted/70">Category:</span>
          <span class="text-accent font-medium">{{ result.app.category }}</span>
          <span class="text-ink-muted/40">·</span>
          <span class="text-[10px] uppercase tracking-wider text-ink-muted/70">Tags:</span>
          <span class="text-ink-muted">{{ result.app.tags.join(', ') }}</span>
        </div>
        <div>
          <span class="text-[10px] uppercase tracking-wider text-ink-muted/70 block mb-1">Body preview</span>
          <div class="prose-ink border border-white/5 rounded-lg p-4 max-h-96 overflow-y-auto" v-html="appBodyHtml" />
        </div>
      </div>

      <!-- LinkedIn tab -->
      <div v-else-if="activeTab === 'linkedin'" class="space-y-3">
        <div>
          <span class="text-[10px] uppercase tracking-wider text-ink-muted/70">Post (≤1300 chars)</span>
          <p class="text-sm whitespace-pre-wrap text-ink-primary mt-1">{{ result.linkedin.post }}</p>
          <p class="text-[10px] text-ink-muted/60 mt-1">{{ result.linkedin.post.length }} characters</p>
        </div>
        <div>
          <span class="text-[10px] uppercase tracking-wider text-ink-muted/70">Hashtags</span>
          <p class="text-sm text-accent mt-1">{{ result.linkedin.hashtags.join(' ') }}</p>
        </div>
      </div>

      <!-- Reddit tab -->
      <div v-else-if="activeTab === 'reddit'" class="space-y-3">
        <div>
          <span class="text-[10px] uppercase tracking-wider text-ink-muted/70">Title</span>
          <p class="text-lg font-medium text-ink-primary">{{ result.reddit.title }}</p>
        </div>
        <div>
          <span class="text-[10px] uppercase tracking-wider text-ink-muted/70">Body</span>
          <p class="text-sm whitespace-pre-wrap text-ink-primary mt-1">{{ result.reddit.body }}</p>
        </div>
        <div>
          <span class="text-[10px] uppercase tracking-wider text-ink-muted/70">Suggested subreddits</span>
          <p class="text-sm text-accent mt-1">{{ result.reddit.subreddits.join(', ') }}</p>
        </div>
      </div>

      <!-- Instagram tab -->
      <div v-else-if="activeTab === 'instagram'" class="space-y-3">
        <div>
          <span class="text-[10px] uppercase tracking-wider text-ink-muted/70">Caption</span>
          <p class="text-sm whitespace-pre-wrap text-ink-primary mt-1">{{ result.instagram.caption }}</p>
        </div>
        <div>
          <span class="text-[10px] uppercase tracking-wider text-ink-muted/70">Hashtags</span>
          <p class="text-sm text-accent mt-1">{{ result.instagram.hashtags.join(' ') }}</p>
        </div>
        <div>
          <span class="text-[10px] uppercase tracking-wider text-ink-muted/70">Image prompt</span>
          <p class="text-sm italic text-ink-muted mt-1">{{ result.instagram.image_prompt }}</p>
        </div>
      </div>

      <!-- Action row -->
      <div class="mt-5 pt-4 border-t border-white/5 flex flex-wrap gap-2">
        <button
          type="button"
          class="h-10 px-4 rounded-xl border border-white/10 text-sm text-ink-primary hover:bg-white/5 transition-colors"
          @click="copyTab(activeTab)"
        >
          {{ copiedTab === activeTab ? 'Copied' : 'Copy ' + activeTab }}
        </button>
        <Button
          v-if="activeTab === 'app'"
          type="button"
          variant="primary"
          size="md"
          :disabled="saving"
          @click="saveAppDraft"
        >
          {{ saving ? 'Saving…' : 'Save app version as draft' }}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="md"
          :disabled="generating"
          @click="generate"
        >Regenerate all</Button>
      </div>
      <p v-if="savedPostId" class="text-safe text-xs mt-2">
        Saved as draft. Redirecting to editor…
      </p>
    </Card>

    <p class="text-ink-muted/60 text-xs mt-6 leading-relaxed">
      Drafts only — nothing auto-publishes. Direct posting to LinkedIn/Reddit/Instagram via
      their APIs is queued for Phase 12.
    </p>
  </div>
</template>

<style scoped>
.prose-ink {
  color: rgb(230 237 247 / 0.85);
  line-height: 1.6;
  font-size: 0.85rem;
}
.prose-ink :deep(h2) {
  color: rgb(230 237 247);
  font-size: 1.05rem;
  font-weight: 600;
  margin: 1.4em 0 0.4em;
}
.prose-ink :deep(h3) {
  color: rgb(230 237 247);
  font-size: 0.95rem;
  font-weight: 600;
  margin: 1.2em 0 0.3em;
}
.prose-ink :deep(p) { margin: 0.7em 0; }
.prose-ink :deep(ul), .prose-ink :deep(ol) { margin: 0.6em 0; padding-left: 1.4em; }
.prose-ink :deep(strong) { color: rgb(230 237 247); }
.prose-ink :deep(code) {
  background: rgb(17 26 46);
  padding: 0.05em 0.35em;
  border-radius: 3px;
  font-size: 0.85em;
}
</style>
