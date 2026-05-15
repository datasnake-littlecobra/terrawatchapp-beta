# TerraWatch URL Inventory

**Last updated:** Phase 9.14.0 (commit will be tagged on push).
**Source of truth:** `src/app/router.ts` (UI routes), `supabase/functions/` (HTTP endpoints), `.github/workflows/deploy-edge-functions.yml` (which functions deploy).

This is the operational reference for "what URLs exist, who can reach them, and where they live in the code." Use it instead of grepping the router every time you forget. Re-generate by hand whenever you add a route — there is no automated check.

---

## Public — anonymous browsing

Everything below is reachable without a sign-in. Linkable from marketing.

### Core consumer surfaces

| Route | View | Purpose |
| --- | --- | --- |
| `/` | `HomeView.vue` | Landing page + "Am I safe here right now?" hero. |
| `/explore` | `ExploreView.vue` | Map-first exploration. |
| `/events` | `GlobalEventsView.vue` | Global feed of recent events. |
| `/events/map` | `EventsMapView.vue` | Map view of the same feed. |
| `/travel` | `TravelView.vue` | Travel advisory input. |
| `/travel/verdict` | `VerdictView.vue` | Travel go/no-go. |
| `/alerts` | `AlertsView.vue` | Subscribed-area alerts list. |
| `/shelters` | `SheltersView.vue` | Nearby shelters. |
| `/bookmarks` | `BookmarksView.vue` | User-saved markers. |
| `/ocean` and `/monitoring/ocean` | `OceanDashboardView.vue` | Live buoy time-series. |
| `/about` | `AboutView.vue` | DataSnake fundraiser + about. |
| `/ask` | `AskTerraView.vue` | "Ask Terra" chat. |
| `/blog` | `BlogIndexView.vue` | Public blog index. |
| `/blog/:slug` | `BlogPostView.vue` | Post detail. |
| `/settings` | `SettingsView.vue` | Preferences (some require auth). |

### Coming-soon stubs

| Route | View | Phase |
| --- | --- | --- |
| `/submarines` | `ComingSoonView.vue` | 9.12 |
| `/ufo` | `ComingSoonView.vue` | 9.12 |
| `/discover` | `ComingSoonView.vue` | 9.12 |

### Research dashboards — Phase 9.11

| Route | View |
| --- | --- |
| `/research` | redirect → `/research/atmosphere` |
| `/research/atmosphere` | `AtmosphereDashboardView.vue` |
| `/research/ocean` | `OceanResearchDashboardView.vue` |
| `/research/seismic-hazard` | `SeismicHazardDashboardView.vue` |

### Insurance Intelligence section — Phase 9.12 / 9.13 / 9.13.2

| Route | View | Phase | Notes |
| --- | --- | --- | --- |
| `/insurance` | `InsuranceDashboardView.vue` | 9.12 | Live FEMA NRI + events overlay. |
| `/insurance/verdict` | `RiskVerdictView.vue` | 9.12.1 | Address-level verdict (UI). |
| `/insurance/map` | `CommandCenterView.vue` | 9.12.1 | Risk-cell map. |
| `/insurance/ep-curves` | `EpCurveView.vue` | 9.12.1 | EP curves. |
| `/insurance/parametric` | `ParametricView.vue` | 9.12.1 | Parametric monitor (display only — 9.15 wires execution). |
| `/insurance/portfolio` | `PortfolioView.vue` | 9.12.1 | Portfolio analytics. |
| `/insurance/claims` | `ClaimsView.vue` | 9.12.1 | Claims event view. |
| `/insurance/glossary` | `GlossaryView.vue` | 9.12.2 | Every per-card explainer fully-expanded. |
| `/insurance/api` | `ApiDocsView.vue` | 9.13 | Public Risk API docs (curl/node/python tabs). |
| `/insurance/pipeline` | `PipelineShowcaseView.vue` | 9.13.2 | Raw sensor → transform → business narrative. |

---

## Auth-only — signed-in user required, but NOT admin

| Route | View | Phase | What gates it |
| --- | --- | --- | --- |
| `/insurance/portfolio/upload` | `PortfolioUploadView.vue` | 9.14 | View shows a sign-in CTA if anon; uploads require tenant membership (`tenant_members` row with role `owner` or `member`). |
| `/auth/sign-in` | `SignInView.vue` | 9.7 | Standard Supabase auth. |
| `/auth/callback` | `AuthCallbackView.vue` | 9.7 | OAuth callback. |
| `/auth/reset` | `ResetPasswordView.vue` | 9.7 | Password reset. |

---

## Admin bootstrap — open with a code

This is the one exception to "admin-gated" because a non-admin must be able to reach it to become admin.

| Route | View | Phase | Gate |
| --- | --- | --- | --- |
| `/admin/sign-up` | `AdminSignUpView.vue` | 9.8 | Anyone with the admin signup code (stored in Supabase Vault as `admin_signup_code`). The Edge Function `signup-admin` calls `redeem_admin_code(code)` RPC. |

---

## Admin-gated — `user_profiles.role = 'admin'`

All children of `/admin` mount inside `AdminLayout.vue` which enforces both auth and `isAdmin` via `auth.loadAdminFlag()`. Server-side, every admin RPC + Edge Function ALSO checks `is_admin()` independently — defense in depth.

| Route | View | Phase | Purpose |
| --- | --- | --- | --- |
| `/admin` | redirect → `/admin/blog` | 9.8 | Default landing. |
| `/admin/blog` | `AdminBlogListView.vue` | 9.9 | List existing posts. |
| `/admin/blog/new` | `AdminBlogGeneratorView.vue` | 9.9 | AI blog generator (Claude Sonnet 4.6). 5/day quota per admin. |
| `/admin/blog/:id` | `AdminBlogEditView.vue` | 9.9 | Edit + publish. |
| `/admin/health` | `AdminHealthView.vue` | 9.10 | Ingest health: per-source status + 7-day trend strip. |
| `/admin/api-keys` | `AdminApiKeysView.vue` | 9.13 | Issue / revoke Insurance Risk API keys. Raw key shown once. |

---

## Edge Function endpoints — HTTP-only, not browser pages

All live at `https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/<name>`. Auth model is **per-function** and explicit in each function's header parsing.

Deployed by `.github/workflows/deploy-edge-functions.yml` on push to main or the feature branch when `supabase/functions/**` changes.

### User-JWT authed

| Function | Auth | What it does | Phase |
| --- | --- | --- | --- |
| `ask-terra` | Supabase user JWT | Q&A endpoint backing `/ask`. | 9.5 |
| `ask-terra-chat` | Supabase user JWT | Chat session backing `/ask`. | 9.5 |
| `generate-blog` | Supabase user JWT + server-side `is_admin()` check | Admin-only AI blog draft generation. 5/day quota. | 9.9 |
| `policies-upload` | Supabase user JWT + server-side `tenant_members` check | Bulk CSV ingest for the authed tenant. ≤50k rows/request, 500-row chunks. | 9.14 |

### Bearer API-key authed (NOT a Supabase JWT)

| Function | Auth | What it does | Phase |
| --- | --- | --- | --- |
| `insurance-risk-verdict` | `Authorization: Bearer tw_...` checked against `public.api_keys` hash. Atomic quota via `api_key_check_and_bump` RPC. | Address / county → JSON risk verdict. Returns rate-limit headers. | 9.13 |

### Cron-secret authed (no JWT)

All ten ingesters check the shared `x-ingest-secret` header against the `INGEST_SECRET` Vault value. Invoked by `pg_cron`, not by browsers.

| Function | Source | Cadence |
| --- | --- | --- |
| `ingest-seismic` | USGS earthquakes | 5 min |
| `ingest-weather` | Open-Meteo + NWS alerts | 15 min |
| `ingest-space` | NOAA SWPC KP / solar wind | 30 min |
| `ingest-wildfires` | NASA EONET wildfires | 30 min |
| `ingest-volcanoes` | NASA EONET volcanoes | 1 h |
| `ingest-gdacs` | GDACS multi-hazard | 30 min |
| `ingest-smithsonian` | Smithsonian volcano archive | 1 day |
| `ingest-nhc` | NOAA NHC tropical | 30 min |
| `ingest-openaq` | OpenAQ air-quality | 30 min |
| `ingest-ndbc` | NOAA NDBC buoy obs | 1 h (`:18`) |

### Anonymous

| Function | Auth | What it does | Phase |
| --- | --- | --- | --- |
| `signup-admin` | Anonymous; admin-signup-code is the gate | Single-call admin signup that skips Supabase's email-confirmation friction. | 9.8 |

### One-shot manual

| Function | Trigger | What it does | Phase |
| --- | --- | --- | --- |
| `seed-fema-nri` | `workflow_dispatch` via `.github/workflows/seed-fema-nri.yml` | Bulk-loads FEMA NRI v3 CSV into `public.fema_nri` (~3,200 county rows). Same `INGEST_SECRET` auth as the cron ingesters. | 9.12 |

---

## How to test the URLs end-to-end

Quick sanity checklist after each deploy:

1. **Anonymous browsing**: hit `/`, `/explore`, `/insurance`, `/insurance/glossary` — all 200.
2. **Auth flow**: sign in via `/auth/sign-in`. After signing in, `/insurance/portfolio/upload` should show the tenant picker (not the sign-in CTA).
3. **Admin gate**: in an incognito tab, hit `/admin/blog` → redirected to `/auth/sign-in?next=/admin/blog`. Sign in as a non-admin → "Admin access required" panel renders. Sign in as admin → blog list renders.
4. **Risk API**: `curl -X POST -H "Authorization: Bearer <test-key>" -d '{"address":"Miami Beach, FL"}' https://<ref>.supabase.co/functions/v1/insurance-risk-verdict` → JSON verdict in <800ms.
5. **Portfolio upload**: drag `docs/sample-policies.csv` onto `/insurance/portfolio/upload` after creating a tenant → 24 valid rows + 1 expected warning (row 25 negative premium) → submit → `total_after` is 24.

---

## When to update this doc

- New route added in `src/app/router.ts` → add a table row above.
- New Edge Function added in `supabase/functions/` → add a row AND update `.github/workflows/deploy-edge-functions.yml`.
- New gate model (e.g. tenant-admin-vs-owner) → add a new section.

This doc is mirror-able as is for partner / reviewer sharing.
