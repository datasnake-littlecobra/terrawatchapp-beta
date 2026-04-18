<script setup lang="ts">
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import { RouterLink } from 'vue-router'
import { en } from '@/i18n/en'
</script>

<template>
  <Card padded>
    <div class="flex items-start gap-4">
      <div
        class="shrink-0 w-10 h-10 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v20M2 12h20" />
        </svg>
      </div>
      <div class="flex-1">
        <h3 class="font-medium">{{ en.fundraiser.title }}</h3>
        <p class="text-ink-muted text-sm mt-1 leading-relaxed">{{ en.fundraiser.body }}</p>
        <RouterLink to="/about" class="inline-block mt-3">
          <Button variant="ghost" size="sm">{{ en.fundraiser.cta }} →</Button>
        </RouterLink>
      </div>
    </div>
  </Card>
</template>
