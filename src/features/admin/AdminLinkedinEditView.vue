<script setup lang="ts">
// TerraWatch — Phase 9.17: edit a single LinkedIn draft.
//
// Edit content + hashtags + scheduled time, change status, copy to
// clipboard for manual posting. Mirrors AdminBlogEditView shape.

import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  getLinkedInPost,
  updateLinkedInPost,
  setLinkedInPostStatus,
  deleteLinkedInPost,
  type LinkedInPost,
  type LinkedInPostStatus,
} from '@/services/linkedinPosts'
import Card from '@/ui/Card.vue'

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id ?? ''))

const post = ref<LinkedInPost | null>(null)
const loading = ref(true)
const saving = ref(false)
const errorMsg = ref<string | null>(null)
const justCopied = ref(false)

// Local editable fields
const contentDraft = ref('')
const hashtagsDraft = ref('')           // comma or space-separated
const scheduledDraft = ref('')          // ISO datetime-local

async function load() {
  loading.value = true
  try {
    post.value = await getLinkedInPost(id.value)
    if (post.value) {
      contentDraft.value = post.value.content
      hashtagsDraft.value = post.value.hashtags.join(' ')
      scheduledDraft.value = post.value.scheduledFor
        ? toLocalInput(post.value.scheduledFor)
        : ''
    }
    errorMsg.value = null
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Load failed'
  } finally {
    loading.value = false
  }
}

function toLocalInput(d: Date): string {
  // <input type="datetime-local"> wants YYYY-MM-DDTHH:mm in LOCAL time
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseHashtags(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
}

async function save() {
  if (!post.value || saving.value) return
  saving.value = true
  try {
    const patch: Parameters<typeof updateLinkedInPost>[1] = {
      content:  contentDraft.value.trim(),
      hashtags: parseHashtags(hashtagsDraft.value),
    }
    patch.scheduled_for = scheduledDraft.value
      ? new Date(scheduledDraft.value).toISOString()
      : null
    const updated = await updateLinkedInPost(post.value.id, patch)
    post.value = updated
    errorMsg.value = null
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Save failed'
  } finally {
    saving.value = false
  }
}

async function changeStatus(status: LinkedInPostStatus) {
  if (!post.value || saving.value) return
  saving.value = true
  try {
    // Save edits first
    await save()
    const updated = await setLinkedInPostStatus(post.value!.id, status)
    post.value = updated
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Status update failed'
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!post.value) return
  if (!confirm('Delete this LinkedIn draft? Cannot be undone.')) return
  try {
    await deleteLinkedInPost(post.value.id)
    void router.push('/admin/linkedin')
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Delete failed'
  }
}

function copyToClipboard() {
  if (!post.value) return
  const text = `${contentDraft.value.trim()}\n\n${parseHashtags(hashtagsDraft.value).join(' ')}`
  void navigator.clipboard?.writeText(text)
  justCopied.value = true
  setTimeout(() => { justCopied.value = false }, 2000)
}

const charCount = computed(() => contentDraft.value.length)

function statusClass(s: LinkedInPostStatus): string {
  if (s === 'draft')     return 'border-white/10 text-ink-muted bg-white/[0.04]'
  if (s === 'approved')  return 'border-accent/40 text-accent bg-accent/[0.08]'
  if (s === 'scheduled') return 'border-caution/40 text-caution bg-caution/[0.08]'
  if (s === 'published') return 'border-safe/40 text-safe bg-safe/[0.08]'
  if (s === 'failed')    return 'border-danger/40 text-danger bg-danger/[0.08]'
  if (s === 'rejected')  return 'border-white/10 text-ink-muted/60 bg-white/[0.02]'
  return 'border-white/10 text-ink-muted bg-white/[0.02]'
}

function fmtDateTime(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

onMounted(load)
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
    <header>
      <p class="text-ink-muted text-xs tracking-widest uppercase">Admin · LinkedIn</p>
      <h1 class="text-2xl sm:text-3xl font-semibold mt-1">Edit LinkedIn draft</h1>
      <RouterLink to="/admin/linkedin" class="text-xs text-accent hover:text-accent-deep mt-2 inline-block">← Back to list</RouterLink>
    </header>

    <p v-if="loading" class="text-ink-muted text-sm">Loading…</p>
    <p v-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>
    <p v-if="!loading && !post" class="text-ink-muted text-sm">Post not found.</p>

    <template v-if="post">
      <!-- Status + metadata -->
      <Card padded>
        <div class="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">Status</p>
            <span
              class="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border mt-1 inline-block"
              :class="statusClass(post.status)"
            >{{ post.status }}</span>
          </div>
          <div class="text-xs text-ink-muted">
            <p>Created: <span class="text-ink-primary num">{{ fmtDateTime(post.createdAt) }}</span></p>
            <p v-if="post.publishedAt">Published: <span class="text-safe num">{{ fmtDateTime(post.publishedAt) }}</span></p>
            <p v-if="post.linkedinUrn">URN: <code class="text-accent text-[10px]">{{ post.linkedinUrn }}</code></p>
          </div>
        </div>

        <div class="mt-4 pt-4 border-t border-white/5">
          <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">Source topic</p>
          <p class="text-ink-primary text-sm mt-1">{{ post.topicText }}</p>
          <p class="text-[10px] text-ink-muted/60 mt-1 font-mono">topic_hash: {{ post.topicHash.slice(0, 16) }}…</p>
        </div>
      </Card>

      <!-- Content editor -->
      <Card padded>
        <label class="block">
          <div class="flex items-baseline justify-between">
            <span class="text-ink-muted text-xs tracking-widest uppercase">Content</span>
            <span class="text-[10px] text-ink-muted/60 num">{{ charCount }} / 1300 char</span>
          </div>
          <textarea
            v-model="contentDraft"
            rows="14"
            class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl p-3 text-base text-ink-primary leading-relaxed"
          />
        </label>

        <label class="block mt-4">
          <span class="text-ink-muted text-xs tracking-widest uppercase">Hashtags</span>
          <input
            v-model="hashtagsDraft"
            type="text"
            placeholder="#insurtech #climatedata #parametric"
            class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-11 px-3 text-base font-mono text-accent"
          />
          <span class="text-[10px] text-ink-muted/60 mt-1 block">
            Comma or space separated. Leading # added automatically if you forget.
          </span>
        </label>

        <label class="block mt-4">
          <span class="text-ink-muted text-xs tracking-widest uppercase">Scheduled for (optional)</span>
          <input
            v-model="scheduledDraft"
            type="datetime-local"
            class="mt-1 w-full sm:w-auto bg-surface-0 border border-white/10 rounded-xl h-11 px-3 text-base text-ink-primary"
          />
          <span class="text-[10px] text-ink-muted/60 mt-1 block">
            When the Phase 9.17.1 publish-cron fires this approved post.
            Leave blank to publish at the next cron tick.
          </span>
        </label>
      </Card>

      <!-- Actions -->
      <Card padded>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="h-10 px-4 rounded-xl bg-accent text-surface-0 text-sm font-medium hover:bg-accent-deep hover:text-ink-primary transition-colors disabled:opacity-40"
            :disabled="saving"
            @click="save"
          >
            <span v-if="saving">Saving…</span>
            <span v-else>Save edits</span>
          </button>

          <button
            v-if="post.status === 'draft'"
            type="button"
            class="h-10 px-4 rounded-xl border border-safe/40 text-safe text-sm font-medium hover:bg-safe/[0.08] transition-colors disabled:opacity-40"
            :disabled="saving"
            @click="changeStatus('approved')"
          >Approve</button>

          <button
            v-if="post.status === 'approved' || post.status === 'draft'"
            type="button"
            class="h-10 px-4 rounded-xl border border-white/10 text-ink-muted text-sm font-medium hover:text-ink-primary transition-colors disabled:opacity-40"
            :disabled="saving"
            @click="changeStatus('rejected')"
          >Reject</button>

          <button
            type="button"
            class="h-10 px-4 rounded-xl border border-white/10 text-ink-primary text-sm font-medium hover:bg-white/5 transition-colors"
            @click="copyToClipboard"
          >
            <span v-if="justCopied">✓ Copied</span>
            <span v-else>Copy to clipboard</span>
          </button>

          <button
            type="button"
            class="h-10 px-4 rounded-xl text-danger text-sm font-medium hover:underline ml-auto"
            @click="remove"
          >Delete</button>
        </div>

        <p class="text-ink-muted/60 text-xs mt-3 leading-relaxed">
          <strong class="text-ink-muted">Phase 9.17:</strong>
          "Copy to clipboard" gives you the content + hashtags as one
          string. Paste into LinkedIn manually. Once Phase 9.17.1 ships,
          approved + scheduled posts will auto-publish on the Mon/Wed/Fri
          14:00 UTC cron.
        </p>
      </Card>
    </template>
  </div>
</template>
