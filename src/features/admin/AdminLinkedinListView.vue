<script setup lang="ts">
// TerraWatch — Phase 9.17: LinkedIn drafts dashboard.
//
// Lists every draft + approved + scheduled + published post. Generate
// from next topic in docs/LINKEDIN_FEED.md, edit, approve, reject,
// delete. Mirrors AdminBlogListView in shape; LinkedIn-specific
// status pills + narrative top card.

import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  listLinkedInPosts,
  generateLinkedInPost,
  setLinkedInPostStatus,
  deleteLinkedInPost,
  type LinkedInPost,
  type LinkedInPostStatus,
} from '@/services/linkedinPosts'
import Card from '@/ui/Card.vue'

const posts = ref<LinkedInPost[]>([])
const loading = ref(true)
const generating = ref(false)
const errorMsg = ref<string | null>(null)
const lastGenerated = ref<string | null>(null)
const busyId = ref<string | null>(null)
const filter = ref<'all' | LinkedInPostStatus>('all')

const FILTERS: Array<{ key: 'all' | LinkedInPostStatus; label: string }> = [
  { key: 'all',       label: 'All' },
  { key: 'draft',     label: 'Drafts' },
  { key: 'approved',  label: 'Approved' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
  { key: 'failed',    label: 'Failed' },
  { key: 'rejected',  label: 'Rejected' },
]

const visible = computed(() =>
  filter.value === 'all' ? posts.value : posts.value.filter((p) => p.status === filter.value),
)

const countsByStatus = computed(() => {
  const m = new Map<LinkedInPostStatus, number>()
  for (const p of posts.value) m.set(p.status, (m.get(p.status) ?? 0) + 1)
  return m
})

async function refresh() {
  loading.value = true
  try {
    posts.value = await listLinkedInPosts()
    errorMsg.value = null
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Load failed'
  } finally {
    loading.value = false
  }
}

async function generate() {
  if (generating.value) return
  generating.value = true
  errorMsg.value = null
  lastGenerated.value = null
  try {
    const r = await generateLinkedInPost()
    if (r.ok && r.topic_text) lastGenerated.value = r.topic_text
    else if (r.error)         errorMsg.value = r.error
    await refresh()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Generation failed'
  } finally {
    generating.value = false
  }
}

async function setStatus(p: LinkedInPost, status: LinkedInPostStatus) {
  if (busyId.value) return
  busyId.value = p.id
  try {
    await setLinkedInPostStatus(p.id, status)
    await refresh()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Status update failed'
  } finally {
    busyId.value = null
  }
}

async function remove(p: LinkedInPost) {
  if (busyId.value) return
  if (!confirm(`Delete this LinkedIn ${p.status}? This can't be undone.`)) return
  busyId.value = p.id
  try {
    await deleteLinkedInPost(p.id)
    await refresh()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Delete failed'
  } finally {
    busyId.value = null
  }
}

function statusClass(s: LinkedInPostStatus): string {
  if (s === 'draft')     return 'border-white/10 text-ink-muted bg-white/[0.04]'
  if (s === 'approved')  return 'border-accent/40 text-accent bg-accent/[0.08]'
  if (s === 'scheduled') return 'border-caution/40 text-caution bg-caution/[0.08]'
  if (s === 'published') return 'border-safe/40 text-safe bg-safe/[0.08]'
  if (s === 'failed')    return 'border-danger/40 text-danger bg-danger/[0.08]'
  if (s === 'rejected')  return 'border-white/10 text-ink-muted/60 bg-white/[0.02]'
  return 'border-white/10 text-ink-muted bg-white/[0.02]'
}

function fmtDate(d: Date): string {
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function preview(s: string, n = 140): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

onMounted(refresh)
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">
    <header class="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <p class="text-ink-muted text-xs tracking-widest uppercase">Admin · LinkedIn</p>
        <h1 class="text-2xl sm:text-3xl font-semibold mt-1">LinkedIn auto-poster</h1>
        <p class="text-ink-muted text-sm mt-1 max-w-2xl">
          Topics live in
          <code class="text-accent">docs/LINKEDIN_FEED.md</code>.
          Click "+ Generate from next topic" or wait for the Mon/Wed/Fri
          09:00 UTC cron. Review, edit, approve. Phase 9.17 ships
          copy-to-clipboard only; Phase 9.17.1 wires LinkedIn auto-publish.
        </p>
      </div>
      <button
        type="button"
        class="h-10 px-4 rounded-xl bg-accent text-surface-0 text-sm font-medium hover:bg-accent-deep hover:text-ink-primary transition-colors disabled:opacity-40"
        :disabled="generating"
        @click="generate"
      >
        <span v-if="generating">Generating…</span>
        <span v-else>+ Generate from next topic</span>
      </button>
    </header>

    <p v-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>
    <p v-if="lastGenerated" class="text-safe text-sm">
      ✓ Drafted: <span class="text-ink-primary">{{ lastGenerated }}</span>
    </p>

    <!-- Status filter chips -->
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="f in FILTERS"
        :key="f.key"
        type="button"
        class="text-xs px-3 py-1.5 rounded-full border transition-colors"
        :class="filter === f.key
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-white/10 text-ink-muted hover:text-ink-primary hover:border-white/20'"
        @click="filter = f.key"
      >
        {{ f.label }}
        <span v-if="f.key !== 'all'" class="num text-ink-muted/60 ml-1">
          ({{ countsByStatus.get(f.key) ?? 0 }})
        </span>
        <span v-else class="num text-ink-muted/60 ml-1">({{ posts.length }})</span>
      </button>
    </div>

    <Card padded>
      <p v-if="loading" class="text-ink-muted text-sm">Loading…</p>
      <p v-else-if="!visible.length" class="text-ink-muted text-sm">
        <template v-if="filter === 'all'">No posts yet. Click "+ Generate from next topic" to draft your first.</template>
        <template v-else>No posts with status "{{ filter }}".</template>
      </p>

      <ul v-else class="divide-y divide-white/5">
        <li v-for="p in visible" :key="p.id" class="py-4 flex items-start gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span
                class="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border"
                :class="statusClass(p.status)"
              >{{ p.status }}</span>
              <span class="text-xs text-ink-muted">{{ fmtDate(p.createdAt) }}</span>
            </div>
            <p class="text-ink-primary text-sm font-medium">{{ preview(p.topicText, 100) }}</p>
            <p class="text-ink-muted text-xs mt-1 leading-relaxed">{{ preview(p.content, 220) }}</p>
            <p v-if="p.hashtags.length" class="text-accent text-xs font-mono mt-1.5">
              {{ p.hashtags.join(' ') }}
            </p>
            <p v-if="p.publishError" class="text-danger text-xs mt-1">⚠ {{ p.publishError }}</p>
          </div>
          <div class="flex flex-col items-end gap-1 shrink-0">
            <RouterLink
              :to="`/admin/linkedin/${p.id}`"
              class="text-xs text-accent hover:text-accent-deep"
            >edit →</RouterLink>
            <button
              v-if="p.status === 'draft'"
              type="button"
              class="text-xs text-safe hover:underline disabled:opacity-40"
              :disabled="busyId === p.id"
              @click="setStatus(p, 'approved')"
            >approve</button>
            <button
              v-if="p.status === 'draft' || p.status === 'approved'"
              type="button"
              class="text-xs text-ink-muted hover:text-ink-primary disabled:opacity-40"
              :disabled="busyId === p.id"
              @click="setStatus(p, 'rejected')"
            >reject</button>
            <button
              type="button"
              class="text-xs text-danger hover:underline disabled:opacity-40"
              :disabled="busyId === p.id"
              @click="remove(p)"
            >delete</button>
          </div>
        </li>
      </ul>
    </Card>

    <p class="text-ink-muted/60 text-xs max-w-3xl">
      <strong class="text-ink-muted">How this works:</strong>
      The generator reads <code class="text-accent">docs/LINKEDIN_FEED.md</code>,
      sha256-hashes each bullet under <code class="text-accent">## Topics</code>,
      and picks the oldest one not already in this table. Already-drafted
      topics stay tracked by hash so re-generation skips them. To
      re-draft a topic, slightly rephrase its bullet so the hash changes.
    </p>
  </div>
</template>
