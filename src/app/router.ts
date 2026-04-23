import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/features/home/HomeView.vue') },
  { path: '/explore', name: 'explore', component: () => import('@/features/explore/ExploreView.vue') },
  { path: '/travel', name: 'travel', component: () => import('@/features/travel/TravelView.vue') },
  { path: '/travel/verdict', name: 'travel-verdict', component: () => import('@/features/travel/VerdictView.vue') },
  { path: '/alerts', name: 'alerts', component: () => import('@/features/guidance/AlertsView.vue') },
  { path: '/shelters', name: 'shelters', component: () => import('@/features/guidance/SheltersView.vue') },
  { path: '/bookmarks', name: 'bookmarks', component: () => import('@/features/bookmarks/BookmarksView.vue') },
  { path: '/auth/sign-in', name: 'sign-in', component: () => import('@/features/auth/SignInView.vue') },
  { path: '/auth/callback', name: 'auth-callback', component: () => import('@/features/auth/AuthCallbackView.vue') },
  { path: '/about', name: 'about', component: () => import('@/features/fundraiser/AboutView.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/features/guidance/SettingsView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
