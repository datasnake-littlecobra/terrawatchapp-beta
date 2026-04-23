<script setup lang="ts">
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { computed, onMounted } from 'vue'
import BottomNav from '@/ui/BottomNav.vue'
import UserChip from '@/features/auth/UserChip.vue'
import { useLocationStore } from '@/stores/location'

const location = useLocationStore()
const route = useRoute()

const hideHeader = computed(() => route.path.startsWith('/explore'))

onMounted(() => {
  void location.init()
})
</script>

<template>
  <div class="min-h-full flex flex-col">
    <header
      v-if="!hideHeader"
      class="px-5 pt-4 flex items-center justify-between max-w-xl mx-auto w-full"
    >
      <RouterLink to="/" class="flex items-center gap-2" aria-label="TerraWatch home">
        <span class="text-accent text-sm tracking-widest uppercase font-semibold">TerraWatch</span>
      </RouterLink>
      <UserChip />
    </header>
    <main class="flex-1 pb-24">
      <RouterView v-slot="{ Component }">
        <component :is="Component" />
      </RouterView>
    </main>
    <BottomNav />
  </div>
</template>
