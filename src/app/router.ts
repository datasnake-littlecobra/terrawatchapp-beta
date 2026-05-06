import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/',               name: 'home',           component: () => import('@/features/home/HomeView.vue') },
  { path: '/explore',        name: 'explore',        component: () => import('@/features/explore/ExploreView.vue') },
  { path: '/events',         name: 'events',         component: () => import('@/features/events/GlobalEventsView.vue') },
  { path: '/events/map',     name: 'events-map',     component: () => import('@/features/events/EventsMapView.vue') },
  { path: '/travel',         name: 'travel',         component: () => import('@/features/travel/TravelView.vue') },
  { path: '/travel/verdict', name: 'travel-verdict', component: () => import('@/features/travel/VerdictView.vue') },
  { path: '/alerts',         name: 'alerts',         component: () => import('@/features/alerts/AlertsView.vue') },
  { path: '/shelters',       name: 'shelters',       component: () => import('@/features/guidance/SheltersView.vue') },
  { path: '/bookmarks',      name: 'bookmarks',      component: () => import('@/features/bookmarks/BookmarksView.vue') },
  {
    path: '/ocean', name: 'ocean',
    component: () => import('@/features/monitoring/OceanDashboardView.vue'),
  },
  {
    path: '/monitoring/ocean', name: 'monitoring-ocean',
    component: () => import('@/features/monitoring/OceanDashboardView.vue'),
  },
  {
    path: '/submarines', name: 'submarines',
    component: () => import('@/features/stubs/ComingSoonView.vue'),
    props: { title: 'Submarines', subtitle: 'Live telemetry and mission tracking from DataSnake submersible deployments — coming soon.', icon: 'anchor' },
  },
  {
    path: '/ufo', name: 'ufo',
    component: () => import('@/features/stubs/ComingSoonView.vue'),
    props: { title: 'UFO Sightings', subtitle: 'Correlated UAP reports from NUFORC, FAA, and community sources — coming soon.', icon: 'eye' },
  },
  {
    path: '/discover', name: 'discover',
    component: () => import('@/features/stubs/ComingSoonView.vue'),
    props: { title: 'Discover', subtitle: 'Curated environmental stories, field reports, and sensor spotlights from the DataSnake network — coming soon.', icon: 'compass' },
  },
  { path: '/auth/sign-in',   name: 'sign-in',        component: () => import('@/features/auth/SignInView.vue') },
  { path: '/auth/callback',  name: 'auth-callback',  component: () => import('@/features/auth/AuthCallbackView.vue') },
  { path: '/about',          name: 'about',          component: () => import('@/features/fundraiser/AboutView.vue') },
  { path: '/settings',       name: 'settings',       component: () => import('@/features/guidance/SettingsView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
