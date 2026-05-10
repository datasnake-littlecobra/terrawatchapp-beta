<script setup lang="ts">
// TerraWatch — Phase 9.8: share affordance for a blog post.
// Wraps the existing useShare() composable. Native share sheet on
// Capacitor / mobile, falls back to clipboard with a confirmation.

import { ref } from 'vue'
import { useShare } from '@/composables/useShare'

const props = defineProps<{
  title:    string
  excerpt:  string
  slug:     string
}>()

const { share } = useShare()
const copied = ref(false)
const error = ref(false)

async function onClick() {
  copied.value = false
  error.value = false
  const url = `${window.location.origin}/blog/${props.slug}`
  const ok = await share({
    title: props.title,
    text:  props.excerpt || props.title,
    url,
    dialogTitle: 'Share this post',
  })
  if (ok) {
    copied.value = true
    setTimeout(() => { copied.value = false }, 1800)
  } else {
    error.value = true
  }
}
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-white/10
           text-xs font-medium text-ink-muted hover:text-ink-primary hover:bg-white/5 transition-colors"
    @click="onClick"
    aria-label="Share this post"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5" aria-hidden="true">
      <circle cx="18" cy="5"  r="3"/>
      <circle cx="6"  cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.6"  y1="13.5" x2="15.4" y2="17.5"/>
      <line x1="15.4" y1="6.5"  x2="8.6"  y2="10.5"/>
    </svg>
    <span v-if="copied">Copied</span>
    <span v-else-if="error">Try again</span>
    <span v-else>Share</span>
  </button>
</template>
