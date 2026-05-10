<script setup lang="ts">
// TerraWatch — Phase 9.8: blog post editor (admin only).
//
// Plain textarea for the markdown body — live preview was deliberately
// scoped out for v1. The "Save draft" button persists without flipping
// the published flag; "Save & publish" flips it explicitly. Hidden by
// design: the destructive Delete action lives on AdminBlogListView, not
// here, so an in-progress edit can't accidentally delete the row.

import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import {
  getPostByIdAdmin,
  updatePostAdmin,
  type BlogPost,
} from '@/services/blogDb'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import CategoryIcon from '@/ui/CategoryIcon.vue'

const route = useRoute()
const router = useRouter()

const id = ref<string>(String(route.params.id ?? ''))
const original = ref<BlogPost | null>(null)
const loading = ref(true)
const saving = ref(false)
const errorMsg = ref<string | null>(null)
const successMsg = ref<string | null>(null)

const slug = ref('')
const title = ref('')
const excerpt = ref('')
const bodyMd = ref('')
const category = ref('general')
const tagsRaw = ref('')
const heroImage = ref('')

const CATEGORIES = ['vision', 'engineering', 'release-notes', 'event-alert', 'tech-blog', 'guide', 'product', 'general']

watch(
  () => route.params.id,
  (v) => { id.value = String(v ?? '') },
)

onMounted(async () => {
  if (!id.value) return
  try {
    const post = await getPostByIdAdmin(id.value)
    if (!post) {
      errorMsg.value = 'Post not found.'
      return
    }
    original.value = post
    slug.value = post.slug
    title.value = post.title
    excerpt.value = post.excerpt
    bodyMd.value = post.bodyMd
    category.value = post.category
    tagsRaw.value = post.tags.join(', ')
    heroImage.value = post.heroImage ?? ''
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to load.'
  } finally {
    loading.value = false
  }
})

async function save(publish: 'keep' | 'publish' | 'unpublish') {
  if (!id.value || saving.value) return
  saving.value = true
  errorMsg.value = null
  successMsg.value = null
  try {
    const tags = tagsRaw.value.split(',').map((t) => t.trim()).filter(Boolean)
    const patch: Parameters<typeof updatePostAdmin>[1] = {
      slug:    slug.value.trim(),
      title:   title.value.trim(),
      excerpt: excerpt.value.trim(),
      body_md: bodyMd.value,
      category: category.value,
      tags,
      hero_image: heroImage.value.trim() || null,
    }
    if (publish === 'publish') patch.published = true
    if (publish === 'unpublish') patch.published = false
    const updated = await updatePostAdmin(id.value, patch)
    original.value = updated
    successMsg.value = publish === 'publish'
      ? 'Saved and published.'
      : publish === 'unpublish'
        ? 'Saved and unpublished.'
        : 'Saved as draft.'
    setTimeout(() => { successMsg.value = null }, 2400)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Save failed.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-8">
    <RouterLink
      to="/admin/blog"
      class="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink-primary text-sm mb-4 transition-colors"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" class="w-4 h-4">
        <path d="m15 18-6-6 6-6"/>
      </svg>
      Back to dashboard
    </RouterLink>

    <p v-if="loading" class="text-ink-muted text-sm">Loading…</p>
    <p v-else-if="errorMsg && !original" class="text-danger text-sm">{{ errorMsg }}</p>

    <template v-else-if="original">
      <header class="mb-6 flex items-start gap-3">
        <CategoryIcon :category="category" :size="22" class="mt-1 shrink-0" />
        <div class="flex-1">
          <p class="text-ink-muted text-xs tracking-widest uppercase">Editing</p>
          <h1 class="text-xl sm:text-2xl font-semibold mt-0.5 text-ink-primary truncate">
            {{ title || original.title }}
          </h1>
          <p class="text-[10px] uppercase tracking-wider mt-1"
             :class="original.published ? 'text-safe' : 'text-ink-muted'">
            {{ original.published ? 'Published' : 'Draft' }}
          </p>
        </div>
      </header>

      <Card padded>
        <form class="space-y-4" @submit.prevent="save('keep')">
          <label class="block">
            <span class="text-ink-muted text-xs tracking-widest uppercase">Slug</span>
            <input
              v-model="slug"
              type="text"
              required
              class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-11 px-3 text-sm font-mono"
            />
          </label>

          <label class="block">
            <span class="text-ink-muted text-xs tracking-widest uppercase">Title</span>
            <input
              v-model="title"
              type="text"
              required
              class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-11 px-3 text-base"
            />
          </label>

          <label class="block">
            <span class="text-ink-muted text-xs tracking-widest uppercase">Excerpt</span>
            <textarea
              v-model="excerpt"
              rows="2"
              class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl px-3 py-2 text-sm"
            ></textarea>
          </label>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="block">
              <span class="text-ink-muted text-xs tracking-widest uppercase">Category</span>
              <select
                v-model="category"
                class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-11 px-3 text-sm"
              >
                <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
              </select>
            </label>

            <label class="block">
              <span class="text-ink-muted text-xs tracking-widest uppercase">Tags (comma-separated)</span>
              <input
                v-model="tagsRaw"
                type="text"
                placeholder="vision, supabase, release"
                class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-11 px-3 text-sm"
              />
            </label>
          </div>

          <label class="block">
            <span class="text-ink-muted text-xs tracking-widest uppercase">Hero image URL (optional)</span>
            <input
              v-model="heroImage"
              type="url"
              placeholder="https://… or /images/blog/…"
              class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl h-11 px-3 text-sm"
            />
            <span class="text-[10px] text-ink-muted/60 mt-1 block">
              Used as the OG preview image when sharing the post URL on social.
            </span>
          </label>

          <label class="block">
            <span class="text-ink-muted text-xs tracking-widest uppercase">Body (markdown)</span>
            <textarea
              v-model="bodyMd"
              rows="20"
              class="mt-1 w-full bg-surface-0 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono leading-relaxed"
            ></textarea>
          </label>

          <div class="flex flex-wrap gap-2 pt-2 border-t border-white/5">
            <Button type="submit" variant="ghost" size="md" :disabled="saving">
              {{ saving ? 'Saving…' : 'Save draft' }}
            </Button>
            <Button
              v-if="!original.published"
              type="button"
              variant="primary"
              size="md"
              :disabled="saving"
              @click="save('publish')"
            >
              Save &amp; publish
            </Button>
            <Button
              v-else
              type="button"
              variant="ghost"
              size="md"
              :disabled="saving"
              @click="save('unpublish')"
            >
              Save &amp; unpublish
            </Button>
            <RouterLink
              :to="`/blog/${slug}`"
              class="inline-flex h-11 px-4 items-center text-sm text-ink-muted hover:text-ink-primary transition-colors"
              target="_blank"
              rel="noopener"
            >Preview live →</RouterLink>
          </div>

          <p v-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>
          <p v-if="successMsg" class="text-safe text-sm">{{ successMsg }}</p>
        </form>
      </Card>
    </template>
  </div>
</template>
