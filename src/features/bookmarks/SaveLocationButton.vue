<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from '@/ui/Button.vue'
import { useAuthStore } from '@/stores/auth'
import { useBookmarksStore, type BookmarkKind } from '@/stores/bookmarks'
import { en } from '@/i18n/en'

const props = defineProps<{
  lat: number
  lon: number
  label: string
  kind?: BookmarkKind
}>()

const auth = useAuthStore()
const bookmarks = useBookmarksStore()
const router = useRouter()

const saving = ref(false)
const savedMsg = ref<string | null>(null)
const errMsg = ref<string | null>(null)

const alreadySaved = computed(() =>
  bookmarks.items.some(
    (b) =>
      Math.abs(b.lat - props.lat) < 0.001 &&
      Math.abs(b.lon - props.lon) < 0.001,
  ),
)

async function save() {
  if (!auth.configured) {
    errMsg.value = en.auth.notConfigured
    return
  }
  if (!auth.isAuthed) {
    void router.push({ path: '/auth/sign-in', query: { next: router.currentRoute.value.fullPath } })
    return
  }
  saving.value = true
  errMsg.value = null
  try {
    await bookmarks.load()
    if (alreadySaved.value) {
      savedMsg.value = en.bookmarks.alreadySaved
      return
    }
    const input: { label: string; lat: number; lon: number; kind?: BookmarkKind } = {
      label: props.label,
      lat: props.lat,
      lon: props.lon,
    }
    if (props.kind) input.kind = props.kind
    await bookmarks.add(input)
    savedMsg.value = en.bookmarks.saved
  } catch (e) {
    errMsg.value = e instanceof Error ? e.message : en.common.error
  } finally {
    saving.value = false
    setTimeout(() => {
      savedMsg.value = null
    }, 2400)
  }
}
</script>

<template>
  <div class="inline-flex flex-col items-start gap-1">
    <Button
      variant="ghost"
      size="sm"
      :disabled="saving"
      @click="save"
    >
      <span aria-hidden="true" class="mr-1.5">☆</span>
      {{ alreadySaved ? en.bookmarks.saved : en.bookmarks.save }}
    </Button>
    <p v-if="savedMsg" class="text-safe text-xs">{{ savedMsg }}</p>
    <p v-if="errMsg" class="text-danger text-xs">{{ errMsg }}</p>
  </div>
</template>
