<script setup lang="ts">
// TerraWatch — Phase 9.14: /insurance/portfolio/upload.
//
// Authed-only. Two-step flow:
//   1. Pick (or create) a tenant.
//   2. Drag-and-drop a CSV. Parse client-side, show preview + errors,
//      submit to the policies-upload Edge Function.
//
// Self-documenting: the page carries a MetricInfoPanel covering the
// CSV schema and the RLS model, surfaced in /insurance/glossary.

import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import Card from '@/ui/Card.vue'
import InsuranceTabStrip from './components/InsuranceTabStrip.vue'
import MetricInfoPanel from './components/MetricInfoPanel.vue'
import { useMeta } from '@/composables/useMeta'
import { useAuthStore } from '@/stores/auth'
import { fetchMyTenants, createTenant, type Tenant } from '@/services/tenants'
import { parsePoliciesCsv, uploadPolicies, type PolicyUploadRow, type UploadResult } from '@/services/policies'

useMeta(() => ({
  title:       'Portfolio Upload — Insurance Intelligence',
  description: 'Upload your policy book as CSV. Runs the same exposure / fairness / EP / concentration analytics on your own data, RLS-gated per tenant.',
}))

const auth = useAuthStore()
const router = useRouter()

const tenants = ref<Tenant[]>([])
const selectedTenant = ref<string>('')
const loadingTenants = ref(true)

// New-tenant form
const showCreate = ref(false)
const createForm = ref({ name: '', slug: '', contactEmail: '' })

// CSV state
const fileName = ref('')
const parsedRows = ref<PolicyUploadRow[]>([])
const parseErrors = ref<Array<{ line: number; error: string }>>([])
const dragOver = ref(false)
const uploadInProgress = ref(false)
const uploadResult = ref<UploadResult | null>(null)
const errorMsg = ref<string | null>(null)

const selectedTenantObj = computed<Tenant | null>(
  () => tenants.value.find((t) => t.id === selectedTenant.value) ?? null
)

const canUpload = computed(() =>
  parsedRows.value.length > 0
  && selectedTenant.value
  && parseErrors.value.filter((e) => !e.error.includes('Unknown header')).length === 0
)

async function loadTenants() {
  loadingTenants.value = true
  try {
    tenants.value = await fetchMyTenants()
    if (tenants.value.length && !selectedTenant.value) {
      selectedTenant.value = tenants.value[0]!.id
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'fetchMyTenants failed'
  } finally {
    loadingTenants.value = false
  }
}

async function submitCreate() {
  if (!createForm.value.name.trim() || !createForm.value.slug.trim() || !createForm.value.contactEmail.trim()) {
    errorMsg.value = 'Name, slug, and contact email required.'
    return
  }
  try {
    const id = await createTenant({
      name:         createForm.value.name.trim(),
      slug:         createForm.value.slug.trim(),
      contactEmail: createForm.value.contactEmail.trim(),
    })
    showCreate.value = false
    createForm.value = { name: '', slug: '', contactEmail: '' }
    await loadTenants()
    selectedTenant.value = id
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'createTenant failed'
  }
}

function handleFile(file: File) {
  fileName.value = file.name
  errorMsg.value = null
  uploadResult.value = null
  const reader = new FileReader()
  reader.onload = () => {
    const text = String(reader.result ?? '')
    const result = parsePoliciesCsv(text)
    parsedRows.value = result.rows
    parseErrors.value = result.errors
  }
  reader.onerror = () => { errorMsg.value = 'Could not read file.' }
  reader.readAsText(file)
}

function onDrop(ev: DragEvent) {
  ev.preventDefault()
  dragOver.value = false
  const file = ev.dataTransfer?.files?.[0]
  if (file) handleFile(file)
}

function onFileInput(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (file) handleFile(file)
}

async function submitUpload() {
  if (!selectedTenant.value || !parsedRows.value.length) return
  uploadInProgress.value = true
  errorMsg.value = null
  try {
    uploadResult.value = await uploadPolicies(selectedTenant.value, parsedRows.value)
    parsedRows.value = []
    parseErrors.value = []
    fileName.value = ''
    await loadTenants() // refresh policy_count
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Upload failed'
  } finally {
    uploadInProgress.value = false
  }
}

function goToPortfolio() {
  void router.push('/insurance/portfolio')
}

onMounted(async () => {
  if (!auth.initialized) await auth.init()
  if (!auth.isAuthed) return
  void loadTenants()
})
</script>

<template>
  <div>
    <InsuranceTabStrip />

    <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      <header>
        <p class="text-ink-muted text-xs tracking-widest uppercase">Insurance · Portfolio Upload</p>
        <h1 class="text-2xl sm:text-3xl font-semibold text-ink-primary mt-1">
          Upload your policy book
        </h1>
        <p class="text-ink-muted text-sm sm:text-base mt-2 max-w-2xl">
          CSV in, RLS-gated analytics out. The Portfolio dashboard
          shows YOUR exposure, YOUR fairness scatter, YOUR EP curves —
          backed by the same calibrations as the demo, but on your
          actual book.
        </p>
      </header>

      <!-- Auth gate -->
      <Card v-if="!auth.isAuthed" padded>
        <p class="text-ink-primary text-sm mb-2">Sign in to upload policies.</p>
        <RouterLink
          to="/auth/sign-in?next=/insurance/portfolio/upload"
          class="inline-flex h-9 px-4 rounded-xl bg-accent text-surface-0 text-sm font-medium"
        >Sign in</RouterLink>
      </Card>

      <template v-else>
        <p v-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>

        <!-- ---- Step 1: tenant picker ---- -->
        <Card padded>
          <div class="flex items-baseline justify-between gap-3 mb-3">
            <h2 class="text-base font-semibold text-ink-primary">1 · Choose tenant</h2>
            <button
              type="button"
              class="text-xs text-accent hover:text-accent-deep"
              @click="showCreate = !showCreate"
            >{{ showCreate ? 'cancel' : '+ new tenant' }}</button>
          </div>

          <p v-if="loadingTenants" class="text-ink-muted text-sm">Loading tenants…</p>

          <div v-else-if="showCreate" class="space-y-3">
            <div>
              <label class="text-[10px] uppercase tracking-widest text-ink-muted/60 block mb-1">Company name</label>
              <input v-model="createForm.name" type="text" placeholder="Acme MGA" class="w-full rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-ink-primary" />
            </div>
            <div>
              <label class="text-[10px] uppercase tracking-widest text-ink-muted/60 block mb-1">Slug (lowercase, dashes)</label>
              <input v-model="createForm.slug" type="text" placeholder="acme-mga" pattern="[a-z0-9-]+" class="w-full rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-ink-primary font-mono" />
            </div>
            <div>
              <label class="text-[10px] uppercase tracking-widest text-ink-muted/60 block mb-1">Contact email</label>
              <input v-model="createForm.contactEmail" type="email" placeholder="ops@acme-mga.com" class="w-full rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-ink-primary" />
            </div>
            <button type="button" class="h-10 px-4 rounded-xl bg-accent text-surface-0 text-sm font-medium hover:bg-accent-deep hover:text-ink-primary transition-colors" @click="submitCreate">
              Create tenant
            </button>
          </div>

          <div v-else-if="!tenants.length" class="text-ink-muted text-sm">
            No tenants yet — click "+ new tenant" to create one.
          </div>

          <div v-else class="space-y-2">
            <label class="text-[10px] uppercase tracking-widest text-ink-muted/60 block">Tenant</label>
            <select v-model="selectedTenant" class="w-full rounded-lg border border-white/10 bg-surface-1 px-3 py-2 text-ink-primary">
              <option v-for="t in tenants" :key="t.id" :value="t.id">
                {{ t.name }} — {{ t.plan }} ({{ t.policyCount.toLocaleString() }} / {{ t.policyLimit.toLocaleString() }} policies, role: {{ t.memberRole }})
              </option>
            </select>
            <p class="text-ink-muted text-xs">
              <template v-if="selectedTenantObj">
                {{ selectedTenantObj.policyLimit - selectedTenantObj.policyCount }} of {{ selectedTenantObj.policyLimit }} remaining capacity.
              </template>
            </p>
          </div>
        </Card>

        <!-- ---- Step 2: CSV ---- -->
        <Card padded>
          <h2 class="text-base font-semibold text-ink-primary mb-2">2 · Upload CSV</h2>
          <p class="text-ink-muted text-xs mb-3">
            Required columns: <code class="text-accent">policy_id_external, exposure_usd</code>.
            Optional: <code class="text-accent">address, state, county, county_fips, lat, lon, perils, premium_usd, policy_class</code>.
            Use <code class="text-accent">|</code> or <code class="text-accent">;</code> to separate multiple perils.
          </p>

          <label
            class="block rounded-xl border-2 border-dashed cursor-pointer p-6 text-center transition-colors"
            :class="dragOver
              ? 'border-accent bg-accent/[0.05]'
              : 'border-white/10 hover:border-white/20'"
            @dragenter.prevent="dragOver = true"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop="onDrop"
          >
            <input type="file" accept=".csv,text/csv" class="sr-only" @change="onFileInput" />
            <p class="text-ink-primary text-sm">Drag a CSV here, or <span class="text-accent underline">browse</span>.</p>
            <p class="text-ink-muted text-xs mt-1">
              <template v-if="fileName">Loaded: <code class="text-accent">{{ fileName }}</code> · {{ parsedRows.length }} rows parsed</template>
              <template v-else>Max 50,000 rows per request.</template>
            </p>
          </label>

          <div v-if="parseErrors.length" class="mt-3 rounded-lg border border-caution/30 bg-caution/[0.05] p-3">
            <p class="text-caution text-xs font-semibold mb-1.5">Parse warnings ({{ parseErrors.length }})</p>
            <ul class="text-xs text-ink-muted space-y-1 max-h-32 overflow-auto">
              <li v-for="(e, i) in parseErrors.slice(0, 20)" :key="i">
                Line {{ e.line }}: {{ e.error }}
              </li>
              <li v-if="parseErrors.length > 20">… and {{ parseErrors.length - 20 }} more</li>
            </ul>
          </div>

          <div v-if="parsedRows.length" class="mt-3 rounded-lg border border-white/5 bg-surface-0/40 p-3">
            <p class="text-[10px] uppercase tracking-widest text-ink-muted/60 mb-2">Preview (first 3 rows)</p>
            <pre class="text-xs font-mono text-ink-primary overflow-x-auto whitespace-pre">{{ JSON.stringify(parsedRows.slice(0, 3), null, 2) }}</pre>
          </div>

          <button
            type="button"
            class="mt-4 h-10 px-4 rounded-xl bg-accent text-surface-0 text-sm font-medium hover:bg-accent-deep hover:text-ink-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="!canUpload || uploadInProgress"
            @click="submitUpload"
          >
            <template v-if="uploadInProgress">Uploading…</template>
            <template v-else>Upload {{ parsedRows.length.toLocaleString() }} polic{{ parsedRows.length === 1 ? 'y' : 'ies' }}</template>
          </button>
        </Card>

        <!-- ---- Result ---- -->
        <Card v-if="uploadResult" padded class="border-safe/30 bg-safe/[0.04]">
          <p class="text-safe text-sm font-semibold">✓ Upload complete</p>
          <ul class="text-xs text-ink-primary mt-2 space-y-0.5">
            <li>Submitted: <span class="num">{{ uploadResult.submitted.toLocaleString() }}</span></li>
            <li>Inserted/updated: <span class="num">{{ uploadResult.inserted.toLocaleString() }}</span></li>
            <li v-if="uploadResult.failed > 0" class="text-danger">Failed: <span class="num">{{ uploadResult.failed.toLocaleString() }}</span></li>
            <li>Total policies in tenant after: <span class="num text-ink-primary font-semibold">{{ uploadResult.total_after.toLocaleString() }}</span></li>
          </ul>
          <button
            type="button"
            class="mt-3 text-xs text-accent hover:text-accent-deep"
            @click="goToPortfolio"
          >See your portfolio dashboard →</button>
        </Card>

        <!-- Self-documenting -->
        <Card padded>
          <MetricInfoPanel id="portfolio.upload" standalone />
        </Card>
      </template>
    </div>
  </div>
</template>
