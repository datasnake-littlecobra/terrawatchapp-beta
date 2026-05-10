<script setup lang="ts">
import type { ChatTurn } from '@/services/askTerraChat'

defineProps<{ turn: ChatTurn }>()
</script>

<template>
  <div
    class="flex"
    :class="turn.role === 'user' ? 'justify-end' : 'justify-start'"
  >
    <div
      class="max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 leading-relaxed"
      :class="turn.role === 'user'
        ? 'bg-accent/15 border border-accent/20 text-ink-primary rounded-tr-md'
        : 'bg-surface-1 border border-white/5 text-ink-primary rounded-tl-md'"
    >
      <p
        v-if="turn.role === 'assistant'"
        class="text-[10px] tracking-widest uppercase text-ink-muted/70 mb-1.5"
      >Terra</p>
      <p class="whitespace-pre-line text-sm sm:text-base">{{ turn.content }}</p>
    </div>
  </div>
</template>
