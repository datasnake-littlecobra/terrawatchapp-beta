<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import Stat from '@/ui/Stat.vue'
import AlertPill from '@/ui/AlertPill.vue'
import AskTerraPanel from './AskTerraPanel.vue'
import SaveLocationButton from '@/features/bookmarks/SaveLocationButton.vue'
import { useTravelStore } from '@/stores/travel'
import { en } from '@/i18n/en'
import { useShare } from '@/composables/useShare'
import { getNearestShelters, type Shelter } from '@/services/fema'

const router = useRouter()
const travel = useTravelStore()
const { verdict } = storeToRefs(travel)
const { share } = useShare()

const shelter = ref<Shelter | null>(null)

const verdictCopy = computed(() => {
  if (!verdict.value) return ''
  return en.travel.verdict[verdict.value.verdict]
})

async function doShare() {
  if (!verdict.value) return
  const text = en.travel.shareText(
    verdict.value.request.destination.name,
    verdictCopy.value,
    verdict.value.score.score,
  )
  await share({
    title: 'TerraWatch advisory',
    text,
    dialogTitle: en.travel.share,
    url: 'https://terrawatchapp.com',
  })
}

async function loadShelter() {
  shelter.value = null
  if (!verdict.value || verdict.value.verdict === 'go') return
  try {
    const list = await getNearestShelters(
      {
        lat: verdict.value.request.destination.lat,
        lon: verdict.value.request.destination.lon,
      },
      1,
      250,
    )
    shelter.value = list[0] ?? null
  } catch {
    shelter.value = null
  }
}

function shelterDirectionsUrl(s: Shelter): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`
}

function back() {
  travel.reset()
  void router.push('/travel')
}

onMounted(loadShelter)
watch(verdict, loadShelter)
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
      <div class="mt-3">
        <SaveLocationButton
          :lat="verdict.request.destination.lat"
          :lon="verdict.request.destination.lon"
          :label="`${verdict.request.destination.name}, ${verdict.request.destination.country}`"
          kind="trip"
        />
      </div>
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

    <AskTerraPanel />

    <Card v-if="shelter" padded>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-ink-muted text-xs tracking-widest uppercase">Nearest shelter</p>
          <p class="font-medium mt-1 truncate">{{ shelter.name }}</p>
          <p class="text-ink-muted text-sm mt-0.5 truncate">{{ shelter.address }}</p>
          <p class="num text-ink-muted text-xs mt-1">
            {{ shelter.distanceKm.toFixed(1) }} {{ en.common.km }} from destination
          </p>
        </div>
        <a
          :href="shelterDirectionsUrl(shelter)"
          target="_blank"
          rel="noopener"
          class="text-accent text-xs font-medium shrink-0 self-start hover:underline"
        >
          {{ en.shelters.directions }} →
        </a>
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
      <Button variant="primary" size="lg" block @click="doShare">{{ en.travel.share }}</Button>
      <Button variant="ghost" size="lg" @click="back">New trip</Button>
    </div>
  </div>
</template>
