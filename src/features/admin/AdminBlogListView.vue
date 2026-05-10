<script setup lang="ts">
// TerraWatch — Phase 9.8: admin blog dashboard.
// Lists every post (drafts included), exposes publish/hide toggle, edit
// link, delete, and entry point to the AI generator.

import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  listAllPostsAdmin,
  setPublishedAdmin,
  deletePostAdmin,
  type BlogPost,
} from '@/services/blogDb'
import Card from '@/ui/Card.vue'
import CategoryIcon from '@/ui/CategoryIcon.vue'

const posts = ref<BlogPost[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const busyId = ref<string | null>(null)

async function refresh() {
  loading.value = true
  try {
    posts.value = await listAllPostsAdmin()
    loadError.value = null
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load posts.'
  } finally {
    loading.value = false
  }
}

onMounted(refresh)

async function togglePublished(p: BlogPost) {
  if (busyId.value) return
  busyId.value = p.id
  try {
    await setPublishedAdmin(p.id, !p.published)
    await refresh()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Toggle failed.'
  } finally {
    busyId.value = null
  }
}

async function remove(p: BlogPost) {
  if (busyId.value) return
  if (!confirm(`Delete "${p.title}"? This can't be undone.`)) return
  busyId.value = p.id
  try {
    await deletePostAdmin(p.id)
    await refresh()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Delete failed.'
  } finally {
    busyId.value = null
  }
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8">
    <header class="flex items-start justify-between gap-3 mb-6">
      <div>
        <p class="text-ink-muted text-xs tracking-widest uppercase">Admin</p>
        <h1 class="text-2xl sm:text-3xl font-semibold mt-1">Blog dashboard</h1>
        <p class="text-ink-muted text-sm mt-1">
          Publish, hide, and edit posts. Drafts are visible only to admins.
        </p>
      </div>
      <RouterLink
        to="/admin/blog/new"
        class="inline-flex h-10 px-4 items-center justify-center rounded-xl bg-accent text-surface-0 text-sm font-medium hover:bg-accent-deep hover:text-ink-primary transition-colors"
      >
        + Generate post
      </RouterLink>
    </header>

    <Card padded>
      <p v-if="loading" class="text-ink-muted text-sm">Loading…</p>
      <p v-else-if="loadError" class="text-danger text-sm">{{ loadError }}</p>
      <p v-else-if="!posts.length" class="text-ink-muted text-sm">
        No posts yet. Use "Generate post" to create your first draft.
      </p>

      <ul v-else class="divide-y divide-white/5">
        <li v-for="p in posts" :key="p.id" class="py-4 flex items-start gap-4">
          <CategoryIcon :category="p.category" :size="18" class="mt-1 shrink-0" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span
                class="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border"
                :class="p.published
                  ? 'border-safe/40 text-safe bg-safe/5'
                  : 'border-white/10 text-ink-muted'"
              >{{ p.published ? 'Published' : 'Draft' }}</span>
              <span class="text-[10px] uppercase tracking-wider text-ink-muted/70">
                {{ p.category }}
              </span>
              <span class="text-[10px] num text-ink-muted/70">·</span>
              <span class="text-[10px] num text-ink-muted/70">
                {{ fmtDate(p.publishedAt ?? p.date) }}
              </span>
            </div>
            <RouterLink
              :to="`/admin/blog/${p.id}`"
              class="block mt-1 text-base font-medium text-ink-primary hover:text-accent transition-colors truncate"
            >{{ p.title }}</RouterLink>
            <p class="text-ink-muted text-xs mt-1 line-clamp-2">{{ p.excerpt }}</p>
          </div>
          <div class="flex flex-col sm:flex-row gap-2 shrink-0">
            <button
              type="button"
              class="h-8 px-3 rounded-lg text-xs font-medium border transition-colors"
              :class="p.published
                ? 'border-white/10 text-ink-muted hover:text-ink-primary hover:bg-white/5'
                : 'border-accent/40 text-accent bg-accent/10 hover:bg-accent/20'"
              :disabled="busyId === p.id"
              @click="togglePublished(p)"
            >
              {{ p.published ? 'Hide' : 'Publish' }}
            </button>
            <button
              type="button"
              class="h-8 px-3 rounded-lg text-xs font-medium border border-danger/30 text-danger hover:bg-danger/10 transition-colors"
              :disabled="busyId === p.id"
              @click="remove(p)"
            >
              Delete
            </button>
          </div>
        </li>
      </ul>
    </Card>

    <p class="text-ink-muted/60 text-xs mt-6 leading-relaxed">
      Hidden drafts are still in the database — only public visibility flips. Edits update
      <code>updated_at</code>; the published date doesn't change after the first publish.
    </p>
  </div>
</template>
