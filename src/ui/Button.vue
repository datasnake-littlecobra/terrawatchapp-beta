<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  type?: 'button' | 'submit'
  disabled?: boolean
}
withDefaults(defineProps<Props>(), { variant: 'primary', size: 'md', type: 'button' })
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="inline-flex items-center justify-center font-medium transition-colors
           disabled:opacity-50 disabled:cursor-not-allowed rounded-xl"
    :class="[
      variant === 'primary' && 'bg-accent text-surface-0 hover:bg-accent-deep hover:text-ink-primary',
      variant === 'ghost' && 'bg-transparent border border-white/10 text-ink-primary hover:bg-white/5',
      variant === 'danger' && 'bg-danger text-surface-0 hover:opacity-90',
      size === 'sm' && 'h-9 px-3 text-sm',
      size === 'md' && 'h-11 px-4 text-sm',
      size === 'lg' && 'h-14 px-6 text-base',
      block && 'w-full',
    ]"
  >
    <slot />
  </button>
</template>
