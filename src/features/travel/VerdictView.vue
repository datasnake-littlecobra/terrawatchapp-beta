<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import Stat from '@/ui/Stat.vue'
import AlertPill from '@/ui/AlertPill.vue'
import { useTravelStore } from '@/stores/travel'
import { en } from '@/i18n/en'
import { Share } from '@capacitor/share'

const router = useRouter()
const travel = useTravelStore()
const { verdict } = storeToRefs(travel)

const verdictCopy = computed(() => {
  if (!verdict.value) return ''
  return en.travel.verdict[
    verdict.value.verdict === 'go'
      ? 'go'
      : verdict.value.verdict === 'caution'
        ? 'caution'
        : 'reconsider'
  ]
})

const verdictTone = computed(() => {
  if (!verdict.value) return 'info' as const
  return verdict.value.verdict === 'go'
    ? 'safe'
    : verdict.value.verdict === 'caution'
      ? 'caution'
      : 'danger'
})

async function share() {
  if (!verdict.value) return
  const text = `TerraWatch advisory for ${verdict.value.request.destination.name}: ${verdictCopy.value} (${verdict.value.score.score}/100)`
  try {
    await Share.share({ title: 'TerraWatch advisory', text, dialogTitle: en.travel.share })
  } catch {
    if ('share' in navigator) {
      await navigator.share({ title: 'TerraWatch advisory', text }).catch(() => {})
    }
  }
}

function back() {
  travel.reset()
  void router.push('/travel')
}
</script>

<template>
  <div v-if="!verdict" class="mx-auto w-full max-w-xl px-5 pt-10 text-center">
    <p class="text-ink-muted">{{ en.travel.empty }}</p>
    <Button variant="ghost" size="md" class="mt-4" @click="back">Back</Button>
  </div>

  <div v-else class="mx-auto w-full max-w-xl px-5 pt-8 pb-12 space-y-6">
    <header>
      <p class="text-ink-muted text-xs tracking-widest uppercase">Advisory</p>
      <h1 class="text-2xl font-semibold mt-1">
        {{ verdict.request.destination.name }},
        <span class="text-ink-muted font-normal">{{ verdict.request.destination.country }}</span>
      </h1>
      <p class="text-ink-muted text-sm mt-1 num">
        {{ verdict.request.start.toDateString() }} → {{ verdict.request.end.toDateString() }}
      </p>
    </header>

    <Card elevated padded>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-ink-muted text-xs uppercase tracking-widest">Verdict</p>
          <h2
            class="text-3xl font-semibold mt-1"
            :class="{
              'text-safe': verdict.verdict === 'go',
              'text-caution': verdict.verdict === 'caution',
              'text-danger': verdict.verdict === 'reconsider',
            }"
          >
            {{ verdictCopy }}
          </h2>
        </div>
        <div class="text-right">
          <p class="num text-5xl"
             :class="{
               'text-safe': verdict.verdict === 'go',
               'text-caution': verdict.verdict === 'caution',
               'text-danger': verdict.verdict === 'reconsider',
             }">
            {{ verdict.score.score }}
          </p>
          <p class="text-ink-muted text-xs">/ 100</p>
        </div>
      </div>

      <div v-if="verdict.score.reasons.length" class="flex flex-wrap gap-2 mt-4">
        <AlertPill
          v-for="r in verdict.score.reasons"
          :key="r.headline"
          :tone="r.tone"
          :label="r.headline"
        />
      </div>
    </Card>

    <Card padded>
      <h3 class="font-medium mb-4">{{ en.travel.timeline }}</h3>
      <div class="flex gap-1.5">
        <div
          v-for="d in verdict.timeline"
          :key="d.date"
          class="flex-1 flex flex-col items-center gap-1"
        >
          <div
            class="w-full h-16 rounded-lg"
            :class="{
              'bg-safe/30 border border-safe/40': d.band === 'safe',
              'bg-caution/30 border border-caution/40': d.band === 'caution',
              'bg-danger/30 border border-danger/40': d.band === 'danger',
            }"
            :title="`Score ${d.score}/100`"
          />
          <span class="num text-[10px] text-ink-muted">{{ d.date.slice(5) }}</span>
        </div>
      </div>
    </Card>

    <Card padded>
      <h3 class="font-medium mb-3">{{ en.safety.reasonsHeader }}</h3>
      <ul class="space-y-3">
        <li v-for="r in verdict.score.reasons" :key="r.headline">
          <AlertPill :tone="r.tone" :label="r.source" />
          <p class="mt-1 font-medium text-ink-primary">{{ r.headline }}</p>
          <p v-if="r.detail" class="text-ink-muted text-sm">{{ r.detail }}</p>
        </li>
        <li v-if="!verdict.score.reasons.length" class="text-ink-muted text-sm">
          Nothing notable. Every subscore is within safe ranges for your window.
        </li>
      </ul>
    </Card>

    <Card padded>
      <h3 class="font-medium mb-3">Underlying data</h3>
      <div class="grid grid-cols-3 gap-4">
        <Stat
          label="Seismic"
          :value="`${verdict.score.subscores.seismic}`"
          :hint="`${verdict.recentQuakes.length} recent / ${verdict.historicalQuakeCount} historical`"
        />
        <Stat
          label="Weather"
          :value="`${verdict.score.subscores.weather}`"
          :hint="verdict.forecast ? `${verdict.forecast.daily.length}-day forecast` : 'n/a'"
        />
        <Stat
          label="Space"
          :value="`${verdict.score.subscores.space}`"
          :hint="`Peak Kp ${verdict.kpPeak.toFixed(1)}`"
        />
      </div>
      <div v-if="verdict.score.subscores.tide !== null" class="mt-4">
        <Stat
          label="Tide"
          :value="`${verdict.score.subscores.tide}`"
          :hint="verdict.station ? `${verdict.station.name} (${verdict.station.distanceKm.toFixed(0)} ${en.common.km})` : ''"
        />
      </div>
    </Card>

    <div class="flex gap-2">
      <Button variant="primary" size="lg" block @click="share">{{ en.travel.share }}</Button>
      <Button variant="ghost" size="lg" @click="back">New trip</Button>
    </div>
  </div>
</template>
