<script setup lang="ts">
import SafetyHero from '@/features/safety/SafetyHero.vue'
import ExplorePreview from '@/features/explore/ExplorePreview.vue'
import GuidanceGrid from '@/features/guidance/GuidanceGrid.vue'
import FundraiserCard from '@/features/fundraiser/FundraiserCard.vue'
</script>

<template>
  <div class="mx-auto w-full max-w-xl px-5">
    <header class="pt-6 pb-2 flex items-center justify-between">
      <div>
        <p class="text-ink-muted text-xs tracking-widest uppercase">TerraWatch</p>
        <h1 class="text-ink-primary font-semibold">Know the ground you're on.</h1>
      </div>
    </header>

    <section class="mt-2 min-h-[78vh] flex flex-col justify-center">
      <SafetyHero />
    </section>

    <section class="mt-12">
      <h2 class="text-ink-muted text-xs tracking-widest uppercase mb-3">Nearby activity</h2>
      <ExplorePreview />
    </section>

    <section class="mt-12">
      <h2 class="text-ink-muted text-xs tracking-widest uppercase mb-3">What to do</h2>
      <GuidanceGrid />
    </section>

    <section class="mt-12 mb-10">
      <FundraiserCard />
    </section>
  </div>
</template>
