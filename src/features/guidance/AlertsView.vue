<script setup lang="ts">
import Card from '@/ui/Card.vue'
import { usePreferencesStore } from '@/stores/preferences'

const prefs = usePreferencesStore()
</script>

<template>
  <div class="mx-auto w-full max-w-xl px-5 pt-8">
    <h1 class="text-xl font-semibold">Alerts</h1>
    <p class="text-ink-muted text-sm mt-1">Get a push when conditions change where you are.</p>
    <Card padded class="mt-6">
      <label class="flex items-center justify-between">
        <div>
          <p class="font-medium">Push notifications</p>
          <p class="text-ink-muted text-sm mt-0.5">
            Severe weather, M4+ quakes within 100 km, Kp ≥ 6.
          </p>
        </div>
        <input
          type="checkbox"
          :checked="prefs.pushEnabled"
          @change="(e) => prefs.patch({ pushEnabled: (e.target as HTMLInputElement).checked })"
          class="w-5 h-5 accent-accent"
        />
      </label>
    </Card>
    <p class="text-ink-dim text-xs mt-6">
      Push delivery is wired in a later phase. Your preference is saved locally.
    </p>
  </div>
</template>
