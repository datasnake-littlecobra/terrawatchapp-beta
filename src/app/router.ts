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
  { path: '/auth/reset',     name: 'auth-reset',     component: () => import('@/features/auth/ResetPasswordView.vue') },
  { path: '/about',          name: 'about',          component: () => import('@/features/fundraiser/AboutView.vue') },
  { path: '/ask',            name: 'ask',            component: () => import('@/features/ask/AskTerraView.vue') },
  { path: '/blog',           name: 'blog',           component: () => import('@/features/blog/BlogIndexView.vue') },
  { path: '/blog/:slug',     name: 'blog-post',      component: () => import('@/features/blog/BlogPostView.vue') },

  // Phase 9.11 — research / investor analytics dashboards. Public-readable
  // (RPCs are anon-grantable). The DataSnake gap callouts on each page
  // are the investor narrative anchor.
  { path: '/research/atmosphere',     name: 'research-atmosphere',     component: () => import('@/features/research/AtmosphereDashboardView.vue') },
  { path: '/research/ocean',          name: 'research-ocean',          component: () => import('@/features/research/OceanResearchDashboardView.vue') },
  { path: '/research/seismic-hazard', name: 'research-seismic-hazard', component: () => import('@/features/research/SeismicHazardDashboardView.vue') },
  { path: '/research',                redirect: '/research/atmosphere' },

  // Phase 9.12 — Insurance MVP. Public dashboard at /insurance — partner
  // demo + LinkedIn / X share asset. FEMA NRI county-level data plus
  // live cross-reference to the events pipeline.
  // Phase 9.12.1 — six DataSnake-fleet "preview" modules using mock data.
  { path: '/insurance',            name: 'insurance',            component: () => import('@/features/insurance/InsuranceDashboardView.vue') },
  { path: '/insurance/verdict',    name: 'insurance-verdict',    component: () => import('@/features/insurance/RiskVerdictView.vue') },
  { path: '/insurance/map',        name: 'insurance-map',        component: () => import('@/features/insurance/CommandCenterView.vue') },
  { path: '/insurance/ep-curves',  name: 'insurance-ep-curves',  component: () => import('@/features/insurance/EpCurveView.vue') },
  { path: '/insurance/parametric', name: 'insurance-parametric', component: () => import('@/features/insurance/ParametricView.vue') },
  { path: '/insurance/portfolio',  name: 'insurance-portfolio',  component: () => import('@/features/insurance/PortfolioView.vue') },
  { path: '/insurance/claims',     name: 'insurance-claims',     component: () => import('@/features/insurance/ClaimsView.vue') },
  // Phase 9.12.2 — Glossary: every per-card explainer rendered fully-expanded.
  { path: '/insurance/glossary',   name: 'insurance-glossary',   component: () => import('@/features/insurance/GlossaryView.vue') },
  // Phase 9.13 — Public docs for the Insurance Risk API (POST endpoint).
  { path: '/insurance/api',        name: 'insurance-api',        component: () => import('@/features/insurance/ApiDocsView.vue') },
  // Phase 9.13.2 — Live sensor data pipeline showcase: raw → transformed → business outputs.
  { path: '/insurance/pipeline',   name: 'insurance-pipeline',   component: () => import('@/features/insurance/PipelineShowcaseView.vue') },

  // Phase 9.8 — admin signup is OUTSIDE the gated /admin/* layout because
  // a non-admin user must be able to reach it (that's the whole point).
  { path: '/admin/sign-up',  name: 'admin-sign-up',  component: () => import('@/features/admin/AdminSignUpView.vue') },

  // Phase 9.8 / 9.9 / 9.10 — admin-gated routes. AdminLayout enforces auth +
  // is_admin role and conditionally renders the matched child view.
  {
    path: '/admin',
    component: () => import('@/features/admin/AdminLayout.vue'),
    meta: { requiresAdmin: true },
    children: [
      { path: '',          redirect: '/admin/blog' },
      { path: 'blog',      name: 'admin-blog',     component: () => import('@/features/admin/AdminBlogListView.vue') },
      { path: 'blog/new',  name: 'admin-blog-new', component: () => import('@/features/admin/AdminBlogGeneratorView.vue') },
      { path: 'blog/:id',  name: 'admin-blog-edit',component: () => import('@/features/admin/AdminBlogEditView.vue') },
      { path: 'health',    name: 'admin-health',   component: () => import('@/features/admin/AdminHealthView.vue') },
      // Phase 9.13 — Insurance Risk API key issuance + revocation.
      { path: 'api-keys',  name: 'admin-api-keys', component: () => import('@/features/admin/AdminApiKeysView.vue') },
    ],
  },

  { path: '/settings',       name: 'settings',       component: () => import('@/features/guidance/SettingsView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
