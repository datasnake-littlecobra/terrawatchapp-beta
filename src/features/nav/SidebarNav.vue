<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useSidebar } from '@/composables/useSidebar'
import { useAuthStore } from '@/stores/auth'

const route   = useRoute()
const sidebar = useSidebar()
const auth    = useAuthStore()

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}

interface NavItem {
  to:    string
  icon:  string
  label: string
  soon?: boolean
}
interface NavSection {
  label: string
  items: NavItem[]
}

// Phase 9.8: Admin section appears in the sidebar only when the signed-in
// user has role='admin' (driven by auth.isAdmin which reads from
// public.user_profiles via the auth store).
const sections = computed<NavSection[]>(() => {
  const base: NavSection[] = [
    {
      label: 'Monitoring',
      items: [
        { to: '/alerts',     icon: 'bell',     label: 'Alerts' },
        { to: '/events',     icon: 'globe',    label: 'Global Events' },
        { to: '/events/map', icon: 'map-pin',  label: 'Events Map' },
        { to: '/ocean',      icon: 'waves',    label: 'Ocean Monitoring' },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { to: '/submarines', icon: 'anchor', label: 'Submarines',   soon: true },
        { to: '/ufo',        icon: 'eye',    label: 'UFO Sightings', soon: true },
      ],
    },
    {
      label: 'Research',
      items: [
        { to: '/research/atmosphere',     icon: 'sparkle', label: 'Atmosphere' },
        { to: '/research/ocean',          icon: 'waves',   label: 'Ocean' },
        { to: '/research/seismic-hazard', icon: 'pen',     label: 'Seismic hazard' },
      ],
    },
    {
      label: 'Verticals',
      items: [
        { to: '/insurance', icon: 'shield', label: 'Insurance' },
      ],
    },
    {
      label: 'Tools',
      items: [
        { to: '/ask',       icon: 'message',        label: 'Ask Terra' },
        { to: '/travel',    icon: 'navigation',     label: 'Travel Advisory' },
        { to: '/bookmarks', icon: 'bookmark',       label: 'Bookmarks' },
        { to: '/discover',  icon: 'compass',        label: 'Discover', soon: true },
        { to: '/blog',      icon: 'pen',            label: 'Blog' },
        { to: '/about',     icon: 'heart',          label: 'Support DataSnake' },
        { to: '/settings',  icon: 'settings',       label: 'Settings' },
      ],
    },
  ]
  if (auth.isAdmin) {
    base.push({
      label: 'Admin',
      items: [
        { to: '/admin/blog',     icon: 'pen',      label: 'Blog dashboard' },
        { to: '/admin/blog/new', icon: 'sparkle',  label: 'Generate post' },
        { to: '/admin/health',   icon: 'bell',     label: 'Ingest health' },
      ],
    })
  }
  return base
})
</script>

<template>
  <nav class="flex flex-col h-full select-none" aria-label="Sidebar navigation">
    <!-- Logo / close row -->
    <div class="flex items-center justify-between px-5 pt-5 pb-4">
      <RouterLink to="/" class="flex items-center gap-2" @click="sidebar.close()">
        <span class="text-accent text-xs tracking-widest uppercase font-semibold">TerraWatch</span>
      </RouterLink>
      <!-- close button: only on mobile -->
      <button
        class="lg:hidden p-1.5 rounded text-ink-muted hover:text-ink-primary transition-colors"
        aria-label="Close menu"
        @click="sidebar.close()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" class="w-5 h-5">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Home shortcut -->
    <RouterLink
      to="/"
      class="mx-3 mb-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
      :class="route.path === '/'
        ? 'bg-accent/15 text-accent font-medium'
        : 'text-ink-muted hover:bg-white/5 hover:text-ink-primary'"
      @click="sidebar.close()"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 shrink-0">
        <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v12h14V9" />
      </svg>
      Home
    </RouterLink>

    <!-- Sections -->
    <div class="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
      <div v-for="section in sections" :key="section.label">
        <p class="px-3 mb-1 text-[10px] font-semibold tracking-widest uppercase text-ink-muted/60">
          {{ section.label }}
        </p>
        <ul class="space-y-0.5">
          <li v-for="item in section.items" :key="item.to">
            <RouterLink
              :to="item.to"
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
              :class="isActive(item.to)
                ? 'bg-accent/15 text-accent font-medium'
                : 'text-ink-muted hover:bg-white/5 hover:text-ink-primary'"
              @click="sidebar.close()"
            >
              <!-- Icons as inline SVG -->
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 shrink-0">
                <template v-if="item.icon === 'globe'">
                  <circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>
                </template>
                <template v-else-if="item.icon === 'bell'">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                </template>
                <template v-else-if="item.icon === 'map-pin'">
                  <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>
                </template>
                <template v-else-if="item.icon === 'waves'">
                  <path d="M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>
                </template>
                <template v-else-if="item.icon === 'anchor'">
                  <circle cx="12" cy="6" r="2"/><path d="M12 8v13M5 12H2a10 10 0 0 0 20 0h-3"/>
                </template>
                <template v-else-if="item.icon === 'eye'">
                  <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="2.5"/>
                </template>
                <template v-else-if="item.icon === 'navigation'">
                  <polygon points="3,11 22,2 13,21 11,13 3,11"/>
                </template>
                <template v-else-if="item.icon === 'bookmark'">
                  <path d="M6 3h12v18l-6-4-6 4V3Z"/>
                </template>
                <template v-else-if="item.icon === 'compass'">
                  <circle cx="12" cy="12" r="9"/><path d="m15 9-4 2-2 4 4-2 2-4Z"/>
                </template>
                <template v-else-if="item.icon === 'pen'">
                  <path d="M12 19h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z"/>
                </template>
                <template v-else-if="item.icon === 'sparkle'">
                  <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
                </template>
                <template v-else-if="item.icon === 'message'">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </template>
                <template v-else-if="item.icon === 'shield'">
                  <path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6Z"/>
                  <path d="M9.5 11h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>
                </template>
                <template v-else-if="item.icon === 'heart'">
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>
                </template>
                <template v-else-if="item.icon === 'settings'">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
                </template>
              </svg>
              <span class="flex-1">{{ item.label }}</span>
              <span
                v-if="item.soon"
                class="text-[9px] uppercase tracking-wider text-ink-muted/50 font-medium border border-white/10 rounded px-1 py-px"
              >soon</span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>

    <!-- Auth footer -->
    <div class="px-4 pb-5 border-t border-white/5 pt-4">
      <template v-if="auth.user">
        <p class="text-ink-muted text-xs truncate mb-2">{{ auth.user.email }}</p>
        <button
          class="w-full text-left text-sm text-ink-muted hover:text-ink-primary transition-colors"
          @click="auth.signOut(); sidebar.close()"
        >Sign out</button>
      </template>
      <RouterLink
        v-else
        to="/auth/sign-in"
        class="flex items-center gap-2 text-sm text-accent"
        @click="sidebar.close()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" class="w-4 h-4"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
        Sign in
      </RouterLink>
    </div>
  </nav>
</template>
