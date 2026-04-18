<script setup lang="ts">
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
</script>

<template>
  <div class="mx-auto w-full max-w-xl px-5 pt-8 space-y-6">
    <header>
      <p class="text-ink-muted text-xs tracking-widest uppercase">About</p>
      <h1 class="text-2xl font-semibold mt-1">TerraWatch & DataSnake</h1>
    </header>

    <Card padded>
      <p class="text-ink-primary leading-relaxed">
        TerraWatch is the consumer-facing side of
        <a href="https://datasnake.io" target="_blank" rel="noopener" class="text-accent underline">DataSnake</a>,
        a prototype-stage company building proprietary ground and underwater sensor networks.
      </p>
      <p class="text-ink-muted leading-relaxed mt-3">
        Every time you open TerraWatch, you help us prove demand for ground-truth environmental
        data. The app is free. Our sensors are not.
      </p>
    </Card>

    <Card padded elevated>
      <h2 class="font-medium">Support the fleet</h2>
      <p class="text-ink-muted text-sm mt-1">
        We're raising money to field the next batch of nodes. Contributions go straight to
        hardware, deployment travel, and data infrastructure.
      </p>
      <Button variant="primary" size="lg" block class="mt-5" disabled>
        Donation link coming soon
      </Button>
      <p class="text-ink-dim text-xs mt-3">
        Payment provider is being finalized. Check back soon or email hello@datasnake.io.
      </p>
    </Card>
  </div>
</template>
