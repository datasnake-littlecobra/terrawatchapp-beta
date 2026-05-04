import { ref } from 'vue'

// Module-level singleton — one sidebar state for the whole app.
const isOpen = ref(false)

export function useSidebar() {
  function open()  { isOpen.value = true  }
  function close() { isOpen.value = false }
  function toggle() { isOpen.value = !isOpen.value }
  return { isOpen, open, close, toggle }
}
