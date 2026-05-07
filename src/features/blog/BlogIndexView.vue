<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { listPosts, type BlogPost } from '@/services/blog'
import CategoryIcon from '@/ui/CategoryIcon.vue'
import { useMeta } from '@/composables/useMeta'

// Phase 9.8: posts now come from Supabase (DB-backed), so the load is
// async. We keep the rest of the rendering shape identical.
const all = ref<BlogPost[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)

onMounted(async () => {
  try {
    all.value = await listPosts()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load posts.'
  } finally {
    loading.value = false
  }
})

useMeta(() => ({
  title: 'TerraWatch Blog — Engineering, vision, and field notes',
  description: 'Engineering posts, product updates, and DataSnake field notes. New writing roughly once a week.',
  type: 'website',
}))

// Optional category filter so the index can grow without becoming a wall.
const categories = computed(() => {
  const seen = new Set<string>()
  for (const p of all.value) seen.add(p.category)
  return ['all', ...Array.from(seen).sort()]
})

const active = ref<string>('all')
const filtered = computed(() =>
  active.value === 'all' ? all.value : all.value.filter((p) => p.category === active.value)
)

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <header class="mb-10">
      <h1 class="text-2xl sm:text-4xl font-semibold text-ink-primary">Blog</h1>
      <p class="text-ink-muted mt-2 leading-relaxed">
        Engineering posts, product updates, and DataSnake field notes. New writing roughly once a week.
      </p>
    </header>

    <!-- Loading state -->
    <p v-if="loading" class="text-ink-muted text-sm">Loading posts…</p>

    <!-- Error state -->
    <p v-else-if="loadError" class="text-danger text-sm">{{ loadError }}</p>

    <template v-else>
      <!-- Category filter -->
      <div v-if="categories.length > 2" class="flex flex-wrap gap-2 mb-8">
        <button
          v-for="c in categories"
          :key="c"
          class="h-7 px-3 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1.5"
          :class="active === c
            ? 'border-accent text-accent bg-accent/10'
            : 'border-white/10 text-ink-muted hover:text-ink-primary'"
          @click="active = c"
        >
          <CategoryIcon v-if="c !== 'all'" :category="c" :size="12" />
          {{ c }}
        </button>
      </div>

      <!-- Empty state -->
      <p v-if="!filtered.length" class="text-ink-muted text-sm">
        No posts in this category yet.
      </p>

      <!-- Post list -->
      <ol class="space-y-8">
        <li v-for="p in filtered" :key="p.slug">
          <RouterLink
            :to="`/blog/${p.slug}`"
            class="group block"
          >
            <div class="flex items-center gap-2 text-xs text-ink-muted mb-2">
              <span class="num">{{ fmtDate(p.date) }}</span>
              <span>·</span>
              <span class="inline-flex items-center gap-1">
                <CategoryIcon :category="p.category" :size="12" />
                <span class="uppercase tracking-wider text-[10px] font-semibold text-ink-muted/70">
                  {{ p.category }}
                </span>
              </span>
              <span>·</span>
              <span class="num">{{ p.readingMinutes }} min read</span>
            </div>
            <h2 class="text-lg sm:text-xl font-semibold text-ink-primary leading-snug group-hover:text-accent transition-colors">
              {{ p.title }}
            </h2>
            <p class="text-ink-muted text-sm sm:text-base leading-relaxed mt-2">
              {{ p.excerpt }}
            </p>
            <div v-if="p.tags.length" class="flex flex-wrap gap-1.5 mt-3">
              <span
                v-for="t in p.tags"
                :key="t"
                class="text-[10px] uppercase tracking-wider text-ink-muted/70 border border-white/10 rounded px-1.5 py-0.5"
              >{{ t }}</span>
            </div>
          </RouterLink>
        </li>
      </ol>
    </template>
  </div>
</template>
