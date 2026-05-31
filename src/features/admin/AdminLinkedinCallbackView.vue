<script setup lang="ts">
// TerraWatch — Phase 9.17.1: LinkedIn OAuth redirect handler.
//
// LinkedIn redirects here after consent: ?code=...&state=... OR
// ?error=...&error_description=...&state=.... We verify state
// against the value we stashed in sessionStorage, exchange the code
// via the linkedin-oauth-callback Edge Function, then route back
// to /admin/linkedin/connect.

import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Card from '@/ui/Card.vue'
import { exchangeOauthCode } from '@/services/linkedinOauth'

const route = useRoute()
const router = useRouter()

type Phase = 'verifying' | 'exchanging' | 'success' | 'error'
const phase = ref<Phase>('verifying')
const errorMsg = ref<string | null>(null)
const orgName = ref<string | null>(null)

async function run() {
  const code  = String(route.query.code  ?? '')
  const state = String(route.query.state ?? '')
  const oauthErr  = String(route.query.error ?? '')
  const oauthDesc = String(route.query.error_description ?? '')

  if (oauthErr) {
    phase.value = 'error'
    errorMsg.value = `LinkedIn returned an error: ${oauthErr}${oauthDesc ? ' — ' + oauthDesc : ''}`
    return
  }
  if (!code) {
    phase.value = 'error'
    errorMsg.value = 'Missing code parameter in callback URL.'
    return
  }

  // Verify state against what we stashed before redirect.
  const expected = sessionStorage.getItem('linkedin_oauth_state')
  if (!expected || expected !== state) {
    phase.value = 'error'
    errorMsg.value = 'State mismatch. Possible CSRF attempt or stale tab — please retry the Connect flow.'
    return
  }
  sessionStorage.removeItem('linkedin_oauth_state')

  phase.value = 'exchanging'
  const redirectUri = `${window.location.origin}/admin/linkedin/oauth-callback`
  try {
    const r = await exchangeOauthCode(code, redirectUri, state)
    if (!r.ok) {
      phase.value = 'error'
      errorMsg.value = r.error ?? 'Exchange failed'
      return
    }
    orgName.value = r.org_name ?? r.org_vanity_name ?? r.org_urn ?? 'company page'
    phase.value = 'success'
    // Auto-redirect to the status page after 1.5 s
    setTimeout(() => { void router.replace('/admin/linkedin/connect') }, 1500)
  } catch (e) {
    phase.value = 'error'
    errorMsg.value = e instanceof Error ? e.message : 'Exchange failed'
  }
}

onMounted(run)
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 sm:px-6 py-12">
    <Card padded elevated>
      <template v-if="phase === 'verifying' || phase === 'exchanging'">
        <p class="text-ink-muted text-xs tracking-widest uppercase">LinkedIn OAuth</p>
        <h1 class="text-xl font-semibold mt-1">
          <template v-if="phase === 'verifying'">Verifying callback…</template>
          <template v-else>Exchanging code for tokens…</template>
        </h1>
        <p class="text-ink-muted text-sm mt-2">One moment.</p>
      </template>

      <template v-else-if="phase === 'success'">
        <p class="text-safe text-sm font-semibold">✓ Connected</p>
        <h1 class="text-xl font-semibold mt-1">Linked {{ orgName }}</h1>
        <p class="text-ink-muted text-sm mt-2">Redirecting to status…</p>
      </template>

      <template v-else>
        <p class="text-danger text-sm font-semibold">⚠ Connection failed</p>
        <h1 class="text-xl font-semibold mt-1">OAuth handshake aborted</h1>
        <p class="text-ink-primary text-sm mt-2 leading-relaxed">{{ errorMsg }}</p>
        <RouterLink
          to="/admin/linkedin/connect"
          class="inline-flex h-10 px-4 mt-4 items-center rounded-xl bg-accent text-surface-0 text-sm font-medium hover:bg-accent-deep hover:text-ink-primary transition-colors"
        >Try again</RouterLink>
      </template>
    </Card>
  </div>
</template>
