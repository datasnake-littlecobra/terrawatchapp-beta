<script setup lang="ts">
// TerraWatch — Phase 9.16: shell for the admin Operations Console.
//
// Mounts under /admin/console which itself is inside AdminLayout —
// auth + isAdmin gating is inherited; this view just renders the
// tab strip + RouterView slot for the active tab.

import { RouterView } from 'vue-router'
import OpsConsoleTabStrip from './OpsConsoleTabStrip.vue'
import { useMeta } from '@/composables/useMeta'

useMeta(() => ({
  title:       'Operations Console — DataSnake',
  description: 'Admin-only workspace for sensor fleet, ingest health, APIs, and the insurance impact bridge.',
}))
</script>

<template>
  <div class="min-h-screen">
    <OpsConsoleTabStrip />
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <RouterView />
    </div>
  </div>
</template>
