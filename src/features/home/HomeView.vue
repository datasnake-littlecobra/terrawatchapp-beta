<script setup lang="ts">
import SafetyHero from '@/features/safety/SafetyHero.vue'
import ExplorePreview from '@/features/explore/ExplorePreview.vue'
import RecentEventsStrip from '@/features/events/RecentEventsStrip.vue'
import GuidanceGrid from '@/features/guidance/GuidanceGrid.vue'
import FundraiserCard from '@/features/fundraiser/FundraiserCard.vue'
</script>

<template>
  <div class="mx-auto w-full max-w-xl px-5">
    <section class="mt-2 min-h-[70vh] flex flex-col justify-center">
      <SafetyHero />
    </section>

    <section class="mt-10">
      <RecentEventsStrip />
    </section>

    <section class="mt-10">
      <h2 class="text-ink-muted text-xs tracking-widest uppercase mb-3">Nearby activity</h2>
      <ExplorePreview />
    </section>

    <section class="mt-10">
      <h2 class="text-ink-muted text-xs tracking-widest uppercase mb-3">What to do</h2>
      <GuidanceGrid />
    </section>

    <section class="mt-10 mb-10">
      <FundraiserCard />
    </section>
  </div>
</template>
