<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'

const props = defineProps<{
  disabled?: boolean
  placeholder?: string
  remaining?: number | null
}>()

const emit = defineEmits<{ send: [message: string] }>()

const text = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const MAX = 800
const remainingChars = computed(() => MAX - text.value.length)
const overLimit = computed(() => remainingChars.value < 0)

function autoresize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`
}

async function handleInput() {
  await nextTick()
  autoresize()
}

function handleKeydown(e: KeyboardEvent) {
  // Cmd/Ctrl+Enter sends; plain Enter inserts newline (more chat-app-like
  // than press-Enter-to-send for multi-paragraph questions).
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    submit()
  }
}

function submit() {
  if (props.disabled || overLimit.value) return
  const trimmed = text.value.trim()
  if (!trimmed) return
  emit('send', trimmed)
  text.value = ''
  void handleInput()
}
</script>

<template>
  <div class="bg-surface-1 border border-white/10 rounded-2xl p-3 focus-within:border-accent/40 transition-colors">
    <textarea
      ref="textareaRef"
      v-model="text"
      rows="1"
      :placeholder="placeholder ?? 'Ask Terra anything about recent events…'"
      :disabled="disabled"
      class="w-full bg-transparent text-ink-primary placeholder:text-ink-muted text-sm sm:text-base
             resize-none focus:outline-none min-h-[2.5rem] max-h-[200px] leading-relaxed"
      @input="handleInput"
      @keydown="handleKeydown"
    />
    <div class="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
      <p class="text-[10px] text-ink-muted/60">
        <span v-if="remaining !== null && remaining !== undefined" class="num">
          {{ remaining }} questions left today ·
        </span>
        Press <kbd class="px-1 rounded bg-surface-2 text-ink-muted text-[10px]">⌘ Enter</kbd> to send
      </p>
      <div class="flex items-center gap-2">
        <span
          v-if="text.length > MAX * 0.75"
          class="num text-[10px]"
          :class="overLimit ? 'text-danger' : 'text-ink-muted/70'"
        >{{ remainingChars }}</span>
        <button
          class="h-8 px-3.5 rounded-lg text-xs font-semibold transition-colors"
          :class="text.trim() && !disabled && !overLimit
            ? 'bg-accent text-surface-0 hover:bg-accent-deep'
            : 'bg-white/5 text-ink-muted cursor-not-allowed'"
          :disabled="!text.trim() || disabled || overLimit"
          @click="submit"
        >
          Send
        </button>
      </div>
    </div>
  </div>
</template>
