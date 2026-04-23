<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import { useAuthStore } from '@/stores/auth'
import { useTravelStore } from '@/stores/travel'
import {
  askTerra,
  AskTerraAuthRequiredError,
  AskTerraQuotaError,
  type AskTerraResponse,
} from '@/services/askTerra'
import { en } from '@/i18n/en'

const auth = useAuthStore()
const travel = useTravelStore()
const { request, verdict } = storeToRefs(travel)

const response = ref<AskTerraResponse | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const quotaMessage = ref<string | null>(null)

async function run() {
  if (!request.value || !verdict.value) return
  loading.value = true
  error.value = null
  quotaMessage.value = null
  try {
    response.value = await askTerra(request.value, verdict.value)
  } catch (e) {
    if (e instanceof AskTerraQuotaError) {
      quotaMessage.value = e.message || en.askTerra.quota
    } else if (e instanceof AskTerraAuthRequiredError) {
      error.value = en.askTerra.needSignIn
    } else {
      error.value = e instanceof Error ? e.message : en.common.error
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Card padded>
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-ink-muted text-xs tracking-widest uppercase">{{ en.askTerra.header }}</p>
        <h3 class="font-medium mt-1">{{ en.askTerra.title }}</h3>
        <p class="text-ink-muted text-sm mt-1 leading-snug">{{ en.askTerra.body }}</p>
      </div>
    </div>

    <div v-if="!auth.configured" class="mt-4 text-ink-muted text-sm">
      {{ en.auth.notConfigured }}
    </div>

    <template v-else-if="!auth.isAuthed">
      <p class="text-ink-muted text-sm mt-4">{{ en.askTerra.signInPrompt }}</p>
      <RouterLink to="/auth/sign-in" class="inline-block mt-3">
        <Button size="sm" variant="primary">{{ en.auth.signIn }}</Button>
      </RouterLink>
    </template>

    <template v-else>
      <div v-if="response" class="mt-4 space-y-3">
        <p class="text-ink-primary whitespace-pre-line">{{ response.narrative }}</p>
        <ul v-if="response.highlights.length" class="space-y-1.5 text-sm text-ink-muted">
          <li v-for="h in response.highlights" :key="h" class="flex gap-2">
            <span class="text-accent shrink-0" aria-hidden="true">◆</span>
            <span>{{ h }}</span>
          </li>
        </ul>
        <p class="text-ink-muted text-xs num">
          {{ en.askTerra.remaining(response.remaining) }}
        </p>
      </div>

      <div v-else class="mt-4">
        <Button
          variant="primary"
          size="md"
          :disabled="loading || !verdict"
          @click="run"
        >
          {{ loading ? en.askTerra.thinking : en.askTerra.cta }}
        </Button>
      </div>

      <p v-if="quotaMessage" class="text-caution text-sm mt-3">{{ quotaMessage }}</p>
      <p v-if="error" class="text-danger text-sm mt-3">{{ error }}</p>
    </template>
  </Card>
</template>
