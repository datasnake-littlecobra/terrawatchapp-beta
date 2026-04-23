<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import { useAuthStore } from '@/stores/auth'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useLocationStore } from '@/stores/location'
import { en } from '@/i18n/en'

const auth = useAuthStore()
const bookmarks = useBookmarksStore()
const location = useLocationStore()

onMounted(() => {
  if (auth.isAuthed) void bookmarks.load()
})

watch(
  () => auth.isAuthed,
  (authed) => {
    if (authed) void bookmarks.load()
    else bookmarks.reset()
  },
)

function use(b: { lat: number; lon: number; label: string }) {
  location.setManual({ lat: b.lat, lon: b.lon }, b.label)
}

async function remove(id: string) {
  try {
    await bookmarks.remove(id)
  } catch {
    // error already captured in store
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-xl px-5 pt-8 pb-24 space-y-6">
    <header>
      <p class="text-ink-muted text-xs tracking-widest uppercase">{{ en.bookmarks.header }}</p>
      <h1 class="text-2xl font-semibold mt-1">{{ en.bookmarks.title }}</h1>
    </header>

    <Card v-if="!auth.configured" padded>
      <p class="text-ink-muted text-sm">{{ en.auth.notConfigured }}</p>
    </Card>

    <Card v-else-if="!auth.isAuthed" padded>
      <p class="text-ink-muted text-sm">{{ en.bookmarks.signInPrompt }}</p>
      <RouterLink to="/auth/sign-in" class="block mt-4">
        <Button variant="primary" block>{{ en.auth.signIn }}</Button>
      </RouterLink>
    </Card>

    <template v-else>
      <Card v-if="bookmarks.loading" padded>
        <p class="text-ink-muted text-sm">{{ en.common.loading }}</p>
      </Card>

      <Card v-else-if="bookmarks.error" padded>
        <p class="text-danger text-sm">{{ bookmarks.error }}</p>
      </Card>

      <Card v-else-if="!bookmarks.items.length" padded>
        <p class="text-ink-muted text-sm">{{ en.bookmarks.empty }}</p>
      </Card>

      <ul v-else class="space-y-3">
        <li v-for="b in bookmarks.items" :key="b.id">
          <Card padded>
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="font-medium truncate">{{ b.label }}</p>
                <p class="num text-ink-muted text-xs mt-0.5">
                  {{ b.lat.toFixed(3) }}, {{ b.lon.toFixed(3) }} · {{ b.kind }}
                </p>
              </div>
              <div class="flex gap-2 shrink-0">
                <Button size="sm" variant="ghost" @click="use(b)">
                  {{ en.bookmarks.useHere }}
                </Button>
                <Button size="sm" variant="ghost" @click="remove(b.id)">
                  {{ en.bookmarks.remove }}
                </Button>
              </div>
            </div>
          </Card>
        </li>
      </ul>
    </template>
  </div>
</template>
