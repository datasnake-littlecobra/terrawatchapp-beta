<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import ChatMessage from './ChatMessage.vue'
import ChatInput from './ChatInput.vue'
import { useAuthStore } from '@/stores/auth'
import { useTerraChatStore } from '@/stores/terraChat'
import { useLocationStore } from '@/stores/location'
import { storeToRefs } from 'pinia'

// Phase 9.3 — Global Terra Chat. Free-form conversational surface,
// auth-gated, with RAG over recent events injected server-side.
//
// URL contract: /ask                 → fresh conversation
//               /ask?c=<uuid>        → load an existing conversation

const auth = useAuthStore()
const chat = useTerraChatStore()
const location = useLocationStore()
const route = useRoute()
const { coords, label: locationLabel } = storeToRefs(location)

const scrollEl = ref<HTMLDivElement | null>(null)

// Suggested prompts shown on the empty-state hero. Pick the ones most
// likely to surface real RAG hits — fixed strings, no internationalisation
// surface for now (the chat itself responds in the user's natural language).
const suggestions = [
  'What major hazards happened in the last week?',
  'Are there any active hurricanes or typhoons right now?',
  'How has air quality been globally over the past few days?',
  'Any volcanic activity to know about today?',
]

async function send(message: string) {
  let loc: { lat: number; lon: number; label?: string } | undefined
  if (coords.value) {
    loc = { lat: coords.value.lat, lon: coords.value.lon }
    if (locationLabel.value) loc.label = locationLabel.value
  }
  await chat.send(message, loc)
  await nextTick()
  scrollToBottom()
}

function newConversation() {
  chat.reset()
  window.history.replaceState({}, '', '/ask')
}

function scrollToBottom() {
  const el = scrollEl.value
  if (el) el.scrollTop = el.scrollHeight
}

// Persist the conversationId in the URL so a refresh keeps the thread.
const currentConversationId = computed(() => chat.conversationId)
watch(currentConversationId, (id) => {
  if (id && route.query.c !== id) {
    void window.history.replaceState({}, '', `/ask?c=${id}`)
  }
})

onMounted(async () => {
  await auth.init()
  const c = route.query.c
  if (typeof c === 'string' && c.length > 8) {
    await chat.openConversation(c)
    await nextTick()
    scrollToBottom()
  }
})
</script>

<template>
  <div class="flex flex-col min-h-[calc(100dvh-4rem)] lg:min-h-dvh">
    <!-- Header -->
    <header class="shrink-0 px-4 sm:px-6 pt-6 pb-3 border-b border-white/5">
      <div class="max-w-3xl mx-auto flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl sm:text-2xl font-semibold text-ink-primary">Ask Terra</h1>
          <p class="text-ink-muted text-sm mt-0.5">
            Conversational explorer for recent environmental events. Grounded in live data.
          </p>
        </div>
        <button
          v-if="!chat.isEmpty"
          class="text-xs text-ink-muted hover:text-ink-primary transition-colors"
          @click="newConversation"
        >New conversation</button>
      </div>
    </header>

    <!-- Auth gate -->
    <div v-if="!auth.configured || (auth.initialized && !auth.isAuthed)"
         class="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
      <Card padded elevated class="max-w-md w-full text-center">
        <h2 class="text-lg font-semibold">Sign in to chat with Terra</h2>
        <p class="text-ink-muted text-sm mt-2 leading-relaxed">
          Conversations are saved to your account. Free tier: 10 messages per day.
        </p>
        <RouterLink to="/auth/sign-in?next=/ask" class="inline-block mt-4">
          <Button variant="primary" size="md">Sign in</Button>
        </RouterLink>
      </Card>
    </div>

    <!-- Chat surface -->
    <template v-else>
      <!-- Messages scroll area -->
      <div ref="scrollEl" class="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div class="max-w-3xl mx-auto space-y-4">
          <!-- Empty state -->
          <div v-if="chat.isEmpty && chat.status !== 'loading'" class="py-8 sm:py-12">
            <div class="text-center mb-8">
              <div class="w-12 h-12 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto mb-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                     stroke-linecap="round" class="w-6 h-6 text-accent">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <p class="text-ink-primary font-medium">Hi, I'm Terra.</p>
              <p class="text-ink-muted text-sm mt-1 leading-relaxed max-w-sm mx-auto">
                Ask me anything about recent earthquakes, storms, wildfires, air quality, or
                space weather. I ground my answers in TerraWatch's live data.
              </p>
            </div>

            <!-- Suggested prompts -->
            <div class="grid sm:grid-cols-2 gap-2">
              <button
                v-for="s in suggestions"
                :key="s"
                class="text-left text-sm bg-surface-1 hover:bg-surface-2 border border-white/5 hover:border-white/10
                       rounded-xl px-4 py-3 text-ink-primary transition-colors"
                @click="send(s)"
              >{{ s }}</button>
            </div>
          </div>

          <!-- Loading existing conversation -->
          <p v-if="chat.status === 'loading'" class="text-ink-muted text-sm text-center py-12">
            Loading conversation…
          </p>

          <!-- Messages -->
          <ChatMessage
            v-for="t in chat.turns"
            :key="t.id"
            :turn="t"
          />

          <!-- Pending indicator while assistant replies -->
          <div v-if="chat.isSending" class="flex justify-start">
            <div class="bg-surface-1 border border-white/5 rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-ink-muted animate-pulse"></span>
              <span class="w-1.5 h-1.5 rounded-full bg-ink-muted animate-pulse" style="animation-delay: 200ms"></span>
              <span class="w-1.5 h-1.5 rounded-full bg-ink-muted animate-pulse" style="animation-delay: 400ms"></span>
            </div>
          </div>

          <!-- Error / quota messages inline -->
          <p v-if="chat.error" class="text-danger text-sm">{{ chat.error }}</p>
          <p v-if="chat.quotaError" class="text-caution text-sm">{{ chat.quotaError }}</p>
        </div>
      </div>

      <!-- Input -->
      <div class="shrink-0 px-4 sm:px-6 py-4 border-t border-white/5 bg-surface-0/95 backdrop-blur">
        <div class="max-w-3xl mx-auto">
          <ChatInput
            :disabled="chat.isSending || !!chat.quotaError"
            :remaining="chat.remaining"
            @send="send"
          />
        </div>
      </div>
    </template>
  </div>
</template>
