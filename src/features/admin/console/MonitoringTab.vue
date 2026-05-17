<script setup lang="ts">
// TerraWatch — Phase 9.16 Monitoring tab.
//
// Wraps the existing AdminHealthView content + adds a cron-job
// status table reading the new cron_job_status RPC (migration 0035).

import { computed, onMounted, ref } from 'vue'
import NarrativeCard from './components/NarrativeCard.vue'
import Card from '@/ui/Card.vue'
import AdminHealthView from '@/features/admin/AdminHealthView.vue'
import { fetchCronJobStatus, type CronJobRow } from '@/services/opsConsole'

const cron = ref<CronJobRow[]>([])
const loading = ref(true)
const errorMsg = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    cron.value = await fetchCronJobStatus()
    errorMsg.value = null
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Cron status failed'
  } finally {
    loading.value = false
  }
}
onMounted(load)

function fmtRel(d: Date | null): string {
  if (!d) return '—'
  const m = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function statusClass(s: string | null): string {
  if (s === 'succeeded') return 'border-safe/40    text-safe    bg-safe/[0.08]'
  if (s === 'failed')    return 'border-danger/40  text-danger  bg-danger/[0.08]'
  if (s === 'running')   return 'border-accent/40  text-accent  bg-accent/[0.08]'
  return 'border-white/10 text-ink-muted bg-white/[0.02]'
}

const failingJobs = computed(() => cron.value.filter((j) => j.lastStatus === 'failed').length)
</script>

<template>
  <div class="space-y-5">
    <NarrativeCard
      eyebrow="Ops Console · Monitoring"
      title="Ingest health + cron job status"
      body="The 'is our data live?' tab. Green = ingesters writing fresh data on schedule. Red rows = the place to dig in immediately. The cron table below shows every scheduled background job (rollup refreshes, prune jobs, ingester schedules) with its last run + 7-day success/failure tally."
    />

    <!-- Embedded health view (existing) -->
    <div class="rounded-2xl border border-white/5 bg-surface-1 p-1">
      <AdminHealthView />
    </div>

    <!-- Cron status -->
    <Card padded>
      <div class="flex items-baseline justify-between mb-3">
        <div>
          <h2 class="text-base font-semibold text-ink-primary">Background jobs (pg_cron)</h2>
          <p class="text-ink-muted text-xs mt-0.5">
            Every scheduled job: ingest cron, rollup refresh, prune,
            seed synthetic data. Failure tally is the last 7 days.
          </p>
        </div>
        <p class="text-xs">
          <span
            class="num font-semibold"
            :class="failingJobs > 0 ? 'text-danger' : 'text-safe'"
          >{{ failingJobs }}</span>
          <span class="text-ink-muted"> failing</span>
        </p>
      </div>

      <p v-if="loading" class="text-ink-muted text-sm">Loading…</p>
      <p v-else-if="errorMsg" class="text-danger text-sm">{{ errorMsg }}</p>
      <p v-else-if="!cron.length" class="text-ink-muted text-sm">No cron jobs scheduled.</p>
      <div v-else class="overflow-x-auto -mx-3">
        <table class="w-full text-sm border-collapse min-w-[760px]">
          <thead>
            <tr class="text-[10px] uppercase tracking-widest text-ink-muted/60 border-b border-white/5">
              <th class="text-left py-2 px-3">Job</th>
              <th class="text-left py-2 px-3">Schedule</th>
              <th class="text-left py-2 px-3">Active</th>
              <th class="text-left py-2 px-3">Last run</th>
              <th class="text-left py-2 px-3">Last status</th>
              <th class="text-right py-2 px-3">Success / Fail (7d)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            <tr v-for="j in cron" :key="j.jobname" class="text-ink-primary">
              <td class="py-2 px-3 font-mono text-xs">{{ j.jobname }}</td>
              <td class="py-2 px-3 font-mono text-xs text-ink-muted">{{ j.schedule }}</td>
              <td class="py-2 px-3 text-xs">
                <span v-if="j.active" class="text-safe">●</span>
                <span v-else class="text-ink-muted">○</span>
              </td>
              <td class="py-2 px-3 text-xs text-ink-muted">{{ fmtRel(j.lastRunAt) }}</td>
              <td class="py-2 px-3">
                <span v-if="j.lastStatus" class="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border" :class="statusClass(j.lastStatus)">{{ j.lastStatus }}</span>
                <span v-else class="text-xs text-ink-muted">—</span>
              </td>
              <td class="py-2 px-3 text-right num text-xs">
                <span class="text-safe">{{ j.successCount }}</span>
                <span class="text-ink-muted/60 mx-1">/</span>
                <span :class="j.failureCount > 0 ? 'text-danger' : 'text-ink-muted'">{{ j.failureCount }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  </div>
</template>
