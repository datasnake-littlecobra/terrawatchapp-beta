<script setup lang="ts">
// TerraWatch — Phase 9.17.1: connect the DataSnake LinkedIn page.
//
// Shows current connection status. If not connected (or refresh
// expired), shows the "Connect" button that builds the LinkedIn
// authorize URL and navigates the browser to it. After LinkedIn
// redirects back to /admin/linkedin/oauth-callback, the callback
// view exchanges the code + returns here.

import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import Card from '@/ui/Card.vue'
import { fetchLinkedInStatus, buildAuthorizeUrl, type LinkedInStatus } from '@/services/linkedinOauth'

const status = ref<LinkedInStatus | null>(null)
const loading = ref(true)
const errorMsg = ref<string | null>(null)

const redirectUri = computed(() => `${window.location.origin}/admin/linkedin/oauth-callback`)
const clientId    = computed(() => import.meta.env.VITE_LINKEDIN_CLIENT_ID as string | undefined)

async function load() {
  loading.value = true
  try {
    status.value = await fetchLinkedInStatus()
    errorMsg.value = null
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Status load failed'
  } finally {
    loading.value = false
  }
}

function startConnect() {
  if (!clientId.value) {
    errorMsg.value = 'VITE_LINKEDIN_CLIENT_ID not set at build time. See DEPLOY.md.'
    return
  }
  // CSRF token round-tripped via the state parameter, stored in
  // sessionStorage and verified by the callback view.
  const state = crypto.randomUUID()
  sessionStorage.setItem('linkedin_oauth_state', state)
  const url = buildAuthorizeUrl(redirectUri.value, state)
  window.location.assign(url)
}

function fmtDate(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

function daysUntil(d: Date | null): string {
  if (!d) return '—'
  const days = Math.max(0, Math.round((d.getTime() - Date.now()) / 86400000))
  return `${days} days`
}

onMounted(load)
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
    <header>
      <p class="text-ink-muted text-xs tracking-widest uppercase">Admin · LinkedIn · Connect</p>
      <h1 class="text-2xl sm:text-3xl font-semibold mt-1">Connect DataSnake LinkedIn page</h1>
      <RouterLink to="/admin/linkedin" class="text-xs text-accent hover:text-accent-deep mt-2 inline-block">← Back to drafts</RouterLink>
    </header>

    <p v-if="loading" class="text-ink-muted text-sm">Loading status…</p>
    <p v-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>

    <template v-if="status">
      <!-- CONNECTED state -->
      <Card v-if="status.connected" padded class="border-safe/30">
        <div class="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p class="text-safe text-sm font-semibold">✓ Connected</p>
            <p class="text-ink-primary text-base font-semibold mt-1">{{ status.orgName ?? '(name not cached)' }}</p>
            <p class="text-ink-muted text-xs mt-0.5 font-mono">{{ status.orgUrn }}</p>
          </div>
          <button
            type="button"
            class="h-9 px-3 rounded-lg border border-white/10 text-ink-muted text-xs hover:text-ink-primary hover:bg-white/5 transition-colors"
            @click="startConnect"
          >Reconnect</button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5">
          <div>
            <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">Access token</p>
            <p class="text-ink-primary text-sm mt-1">
              <template v-if="status.needsRefresh">
                <span class="text-caution">expiring in {{ daysUntil(status.accessTokenExpiresAt) }}</span>
                <span class="text-ink-muted/60 text-xs ml-1">— will auto-refresh on next publish</span>
              </template>
              <template v-else>{{ daysUntil(status.accessTokenExpiresAt) }} remaining</template>
            </p>
            <p class="text-[10px] text-ink-muted/60 num mt-0.5">expires {{ fmtDate(status.accessTokenExpiresAt) }}</p>
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-widest text-ink-muted/60">Refresh token</p>
            <p class="text-ink-primary text-sm mt-1">
              <template v-if="status.needsReconnect">
                <span class="text-danger">expiring in {{ daysUntil(status.refreshTokenExpiresAt) }}</span>
                <span class="text-ink-muted/60 text-xs ml-1">— click Reconnect</span>
              </template>
              <template v-else>{{ daysUntil(status.refreshTokenExpiresAt) }} remaining</template>
            </p>
            <p class="text-[10px] text-ink-muted/60 num mt-0.5">expires {{ fmtDate(status.refreshTokenExpiresAt) }}</p>
          </div>
        </div>

        <div class="mt-4 pt-4 border-t border-white/5 text-xs text-ink-muted space-y-1">
          <p>Scope: <code class="text-accent">{{ status.scope ?? '—' }}</code></p>
          <p>Connected: <span class="text-ink-primary num">{{ fmtDate(status.connectedAt) }}</span> by <span class="text-ink-primary">{{ status.connectedByEmail ?? '—' }}</span></p>
        </div>
      </Card>

      <!-- NOT CONNECTED state -->
      <Card v-else padded>
        <p class="text-ink-primary text-sm">
          Click below to connect the DataSnake LinkedIn page. You'll be
          redirected to LinkedIn to grant the
          <code class="text-accent">w_organization_social</code> +
          <code class="text-accent">r_organization_admin</code> scopes.
          After consent LinkedIn sends you back here and the access +
          refresh tokens are stored server-side.
        </p>

        <button
          type="button"
          class="mt-4 inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-accent text-surface-0 font-medium hover:bg-accent-deep hover:text-ink-primary transition-colors"
          @click="startConnect"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.42v1.56h.05a3.75 3.75 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0z"/></svg>
          Connect DataSnake LinkedIn
        </button>

        <p class="text-ink-muted/60 text-xs mt-3">
          Redirect URI: <code class="text-accent">{{ redirectUri }}</code>
        </p>
        <p v-if="!clientId" class="text-danger text-xs mt-1">
          ⚠ <code>VITE_LINKEDIN_CLIENT_ID</code> not set at build time. See <code>DEPLOY.md</code> → "LinkedIn auto-poster setup".
        </p>
      </Card>

      <!-- Always-present runbook -->
      <Card padded>
        <p class="text-[10px] uppercase tracking-widest text-ink-muted/60 mb-2">One-time LinkedIn app config</p>
        <ol class="text-xs text-ink-primary leading-relaxed list-decimal list-inside space-y-1">
          <li>LinkedIn Developer Console → Apps → DataSnake app → <strong>Auth</strong> tab → add this exact redirect URL to "Authorized redirect URLs for your app": <code class="text-accent break-all">{{ redirectUri }}</code></li>
          <li><strong>Products</strong> tab → request "Community Management API" (instant approval).</li>
          <li><strong>Auth</strong> tab → copy Client ID + Client Secret.</li>
          <li>Set in Supabase: <code class="text-accent">supabase secrets set LINKEDIN_CLIENT_ID=…</code> and <code class="text-accent">supabase secrets set LINKEDIN_CLIENT_SECRET=…</code></li>
          <li>Set in the Vue build env: <code class="text-accent">VITE_LINKEDIN_CLIENT_ID</code> in your hosting provider's env vars + rebuild.</li>
        </ol>
      </Card>
    </template>
  </div>
</template>
