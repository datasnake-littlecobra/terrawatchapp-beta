<script setup lang="ts">
import Card from '@/ui/Card.vue'
import AlertPill from '@/ui/AlertPill.vue'
import { en } from '@/i18n/en'
import type { FeedEvent } from '@/types/dataSource'

const props = defineProps<{ event: FeedEvent }>()

function kindLabel(k: FeedEvent['kind']): string {
  return en.events.kind[k]
}

function timeLabel(t: Date): string {
  const diffMs = Date.now() - t.getTime()
  const abs = Math.abs(diffMs)
  const hours = abs / 3_600_000
  const days = hours / 24
  const prefix = diffMs >= 0 ? '' : 'in '
  const suffix = diffMs >= 0 ? ' ago' : ''
  if (hours < 1) return diffMs >= 0 ? 'just now' : 'soon'
  if (hours < 48) return `${prefix}${hours.toFixed(0)}h${suffix}`
  return `${prefix}${days.toFixed(0)}d${suffix}`
}
</script>

<template>
  <Card padded>
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <AlertPill :tone="props.event.severity" :label="kindLabel(props.event.kind)" />
          <span class="num text-ink-muted text-xs">{{ timeLabel(props.event.timestamp) }}</span>
        </div>
        <p class="font-medium mt-2 text-ink-primary">{{ props.event.title }}</p>
        <p class="text-ink-muted text-sm mt-1 leading-snug">{{ props.event.summary }}</p>
      </div>
      <span
        v-if="props.event.distanceKm !== undefined"
        class="num text-ink-muted text-xs shrink-0"
      >
        {{ props.event.distanceKm.toFixed(0) }} {{ en.common.km }}
      </span>
    </div>
  </Card>
</template>
