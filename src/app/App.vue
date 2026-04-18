<script setup lang="ts">
import { RouterView } from 'vue-router'
import BottomNav from '@/ui/BottomNav.vue'
import { onMounted } from 'vue'
import { useLocationStore } from '@/stores/location'

const location = useLocationStore()
onMounted(() => {
  void location.init()
})
</script>

<template>
  <div class="min-h-full flex flex-col">
    <main class="flex-1 pb-24">
      <RouterView v-slot="{ Component }">
        <component :is="Component" />
      </RouterView>
    </main>
    <BottomNav />
  </div>
</template>
