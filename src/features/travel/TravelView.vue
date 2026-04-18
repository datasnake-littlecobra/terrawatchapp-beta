<script setup lang="ts">
import TravelForm from './TravelForm.vue'
</script>

<template>
  <div class="mx-auto w-full max-w-xl px-5 pt-8 pb-10">
    <header>
      <p class="text-ink-muted text-xs tracking-widest uppercase">Advisory</p>
      <h1 class="text-2xl font-semibold mt-1">Travel advisory</h1>
      <p class="text-ink-muted text-sm mt-2 leading-relaxed">
        Tell us where and when. We'll check seismic history, the weather forecast, the KP index,
        and (if you're near a coast) the tide chart — then give you a straight answer.
      </p>
    </header>
    <div class="mt-6">
      <TravelForm />
    </div>
  </div>
</template>
