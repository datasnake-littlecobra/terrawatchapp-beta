<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import { computed, onMounted, watch } from 'vue'
import BottomNav from '@/ui/BottomNav.vue'
import UserChip from '@/features/auth/UserChip.vue'
import SidebarNav from '@/features/nav/SidebarNav.vue'
import { useLocationStore } from '@/stores/location'
import { useSidebar } from '@/composables/useSidebar'

const location = useLocationStore()
const route    = useRoute()
const sidebar  = useSidebar()

// Close mobile drawer on navigation
watch(() => route.path, () => sidebar.close())

// Routes that are fullscreen (no bottom padding, no top header)
const fullscreen = computed(() => route.path === '/events/map')

// Routes where we suppress the sticky top header (they manage their own)
const hideTopHeader = computed(
  () => route.path.startsWith('/explore') || fullscreen.value
)

onMounted(() => {
  void location.init()
})
</script>

<template>
  <div class="min-h-full flex">

    <!-- Mobile drawer backdrop -->
    <Transition name="tw-fade">
      <div
        v-if="sidebar.isOpen.value"
        class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
        @click="sidebar.close()"
      />
    </Transition>

    <!-- Mobile sidebar drawer -->
    <Transition name="tw-slide">
      <aside
        v-if="sidebar.isOpen.value"
        class="fixed inset-y-0 left-0 z-50 w-64 bg-surface-1 border-r border-white/5 lg:hidden"
      >
        <SidebarNav />
      </aside>
    </Transition>

    <!-- Desktop persistent sidebar -->
    <aside class="hidden lg:flex lg:w-64 lg:shrink-0 bg-surface-1 border-r border-white/5 fixed inset-y-0 left-0 z-30 flex-col">
      <SidebarNav />
    </aside>

    <!-- Main column -->
    <div class="flex flex-col flex-1 min-w-0 lg:pl-64">

      <!-- Mobile top bar -->
      <header
        v-if="!hideTopHeader"
        class="lg:hidden sticky top-0 z-20 px-4 py-3 flex items-center gap-3
               bg-surface-0/90 backdrop-blur border-b border-white/5"
      >
        <button
          class="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-white/5 transition-colors"
          aria-label="Open menu"
          @click="sidebar.toggle()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" class="w-5 h-5">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <RouterLink to="/" class="flex-1 text-accent text-xs tracking-widest uppercase font-semibold">Hyperwatch</RouterLink>
        <UserChip />
      </header>

      <!-- Desktop top bar -->
      <header v-if="!hideTopHeader" class="hidden lg:flex items-center justify-end px-6 pt-4 pb-1">
        <UserChip />
      </header>

      <main class="flex-1" :class="fullscreen ? '' : 'pb-20 lg:pb-6'">
        <RouterView v-slot="{ Component }">
          <component :is="Component" />
        </RouterView>
      </main>

      <BottomNav class="lg:hidden" />
    </div>
  </div>
</template>

<style scoped>
.tw-fade-enter-active, .tw-fade-leave-active { transition: opacity 0.2s ease; }
.tw-fade-enter-from,  .tw-fade-leave-to      { opacity: 0; }

.tw-slide-enter-active, .tw-slide-leave-active { transition: transform 0.25s ease; }
.tw-slide-enter-from,   .tw-slide-leave-to     { transform: translateX(-100%); }
</style>
