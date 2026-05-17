<script setup lang="ts">
// TerraWatch — Phase 9.13: admin UI for issuing Insurance Risk API keys.
//
// Admin-gated by AdminLayout. Creates a new key (raw value shown ONCE
// and never recoverable), lists existing keys with prefix + usage,
// allows revocation.

import { onMounted, ref } from 'vue'
import Card from '@/ui/Card.vue'
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  type ApiKeyRow,
  type CreatedKey,
} from '@/services/apiKeys'
import MetricInfoPanel from '@/features/insurance/components/MetricInfoPanel.vue'

const keys = ref<ApiKeyRow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const showNewModal = ref(false)
const newCreated = ref<CreatedKey | null>(null)

const form = ref({
  tenant_name: '',
  plan:        'free' as 'free' | 'paid',
  daily_limit: 100,
  note:        '',
})

async function load() {
  loading.value = true
  try {
    keys.value = await listApiKeys()
    error.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Load failed.'
  } finally {
    loading.value = false
  }
}

async function submitCreate() {
  if (!form.value.tenant_name.trim()) {
    error.value = 'Tenant name is required.'
    return
  }
  try {
    const note = form.value.note.trim()
    newCreated.value = await createApiKey({
      tenant_name: form.value.tenant_name.trim(),
      plan:        form.value.plan,
      daily_limit: form.value.daily_limit,
      ...(note ? { note } : {}),
    })
    form.value = { tenant_name: '', plan: 'free', daily_limit: 100, note: '' }
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Create failed.'
  }
}

async function doRevoke(row: ApiKeyRow) {
  if (!confirm(`Revoke key ${row.key_prefix}… for ${row.tenant_name}? This cannot be undone.`)) return
  try {
    await revokeApiKey(row.id)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Revoke failed.'
  }
}

function copyKey(s: string) {
  void navigator.clipboard?.writeText(s)
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString()
}

onMounted(load)
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
    <header class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <p class="text-ink-muted text-xs tracking-widest uppercase">Admin · API Keys</p>
        <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
          Insurance Risk API keys
        </h1>
        <p class="text-ink-muted text-sm mt-2 max-w-2xl">
          Issue, list, and revoke API keys used to authenticate against
          the <code class="text-accent">POST /insurance-risk-verdict</code>
          endpoint. Raw key values are shown once at creation and never
          retrievable from the database.
        </p>
      </div>
      <button
        type="button"
        class="h-10 px-4 rounded-xl bg-accent text-surface-0 text-sm font-medium hover:bg-accent-deep hover:text-ink-primary transition-colors"
        @click="showNewModal = true"
      >+ Issue new key</button>
    </header>

    <p v-if="error" class="text-danger text-sm">{{ error }}</p>

    <!-- Create form -->
    <Card v-if="showNewModal" padded elevated>
      <div class="flex items-baseline justify-between mb-3">
        <h2 class="text-base font-semibold text-ink-primary">Issue new API key</h2>
        <button type="button" class="text-xs text-ink-muted hover:text-ink-primary" @click="showNewModal = false; newCreated = null">close</button>
      </div>

      <div v-if="!newCreated" class="space-y-3">
        <div>
          <label class="text-[10px] uppercase tracking-widest text-ink-muted/60 block mb-1">Tenant / company name</label>
          <input
            v-model="form.tenant_name"
            type="text"
            placeholder="Acme MGA"
            class="w-full rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-ink-primary"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] uppercase tracking-widest text-ink-muted/60 block mb-1">Plan</label>
            <select
              v-model="form.plan"
              class="w-full rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-ink-primary"
              @change="form.daily_limit = form.plan === 'paid' ? 10000 : 100"
            >
              <option value="free">Free (100/day)</option>
              <option value="paid">Paid (10k/day)</option>
            </select>
          </div>
          <div>
            <label class="text-[10px] uppercase tracking-widest text-ink-muted/60 block mb-1">Daily limit</label>
            <input
              v-model.number="form.daily_limit"
              type="number"
              min="1"
              class="w-full rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-ink-primary num"
            />
          </div>
        </div>
        <div>
          <label class="text-[10px] uppercase tracking-widest text-ink-muted/60 block mb-1">Note (optional)</label>
          <input
            v-model="form.note"
            type="text"
            placeholder="What is this key for?"
            class="w-full rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-ink-primary"
          />
        </div>
        <button
          type="button"
          class="h-10 px-4 rounded-xl bg-accent text-surface-0 text-sm font-medium hover:bg-accent-deep hover:text-ink-primary transition-colors"
          @click="submitCreate"
        >Generate key</button>
      </div>

      <div v-else class="space-y-3">
        <div class="rounded-lg border border-caution/40 bg-caution/[0.08] px-3 py-2.5">
          <p class="text-caution text-sm font-semibold">⚠ Copy this key now — it cannot be retrieved later.</p>
        </div>
        <div class="rounded-lg border border-white/10 bg-surface-0/60 px-3 py-3 flex items-center gap-2">
          <code class="text-accent text-sm font-mono break-all flex-1">{{ newCreated.rawKey }}</code>
          <button
            type="button"
            class="text-xs text-ink-muted hover:text-accent transition-colors"
            @click="copyKey(newCreated.rawKey)"
          >copy</button>
        </div>
        <p class="text-ink-muted text-xs">
          Tenant: <span class="text-ink-primary">{{ newCreated.row.tenant_name }}</span>
          · Plan: <span class="text-ink-primary">{{ newCreated.row.plan }}</span>
          · Daily limit: <span class="text-ink-primary num">{{ newCreated.row.daily_limit }}</span>
        </p>
        <button
          type="button"
          class="text-xs text-accent hover:text-accent-deep"
          @click="newCreated = null; showNewModal = false"
        >Done</button>
      </div>
    </Card>

    <!-- Existing keys -->
    <Card padded>
      <h2 class="text-base font-semibold text-ink-primary mb-3">Existing keys</h2>
      <p v-if="loading" class="text-ink-muted text-sm">Loading…</p>
      <p v-else-if="!keys.length" class="text-ink-muted text-sm">No keys issued yet.</p>
      <div v-else class="overflow-x-auto -mx-3">
        <table class="w-full text-sm border-collapse min-w-[760px]">
          <thead>
            <tr class="text-[10px] uppercase tracking-widest text-ink-muted/60 border-b border-white/5">
              <th class="text-left py-2 px-3">Prefix</th>
              <th class="text-left py-2 px-3">Tenant</th>
              <th class="text-left py-2 px-3">Plan</th>
              <th class="text-right py-2 px-3">Limit</th>
              <th class="text-right py-2 px-3">Used today</th>
              <th class="text-left py-2 px-3">Created</th>
              <th class="text-left py-2 px-3">Last used</th>
              <th class="text-left py-2 px-3">Status</th>
              <th class="text-right py-2 px-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            <tr v-for="k in keys" :key="k.id" class="text-ink-primary">
              <td class="py-2 px-3"><code class="font-mono text-xs">{{ k.key_prefix }}…</code></td>
              <td class="py-2 px-3">{{ k.tenant_name }}</td>
              <td class="py-2 px-3">{{ k.plan }}</td>
              <td class="py-2 px-3 num text-right">{{ k.daily_limit.toLocaleString() }}</td>
              <td class="py-2 px-3 num text-right">{{ (k.usage_today ?? 0).toLocaleString() }}</td>
              <td class="py-2 px-3 text-xs text-ink-muted">{{ fmtDateTime(k.created_at) }}</td>
              <td class="py-2 px-3 text-xs text-ink-muted">{{ fmtDateTime(k.last_used_at) }}</td>
              <td class="py-2 px-3">
                <span
                  v-if="k.revoked_at"
                  class="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-danger/40 text-danger bg-danger/10"
                >revoked</span>
                <span
                  v-else
                  class="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-safe/40 text-safe bg-safe/10"
                >active</span>
              </td>
              <td class="py-2 px-3 text-right">
                <button
                  v-if="!k.revoked_at"
                  type="button"
                  class="text-xs text-danger hover:underline"
                  @click="doRevoke(k)"
                >revoke</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <MetricInfoPanel id="admin.api-keys" />
    </Card>
  </div>
</template>
