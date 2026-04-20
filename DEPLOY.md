# Deploying TerraWatch

**Stack at a glance**

- **Frontend**: Cloudflare Workers (Static Assets) — auto-builds on every push via the Cloudflare ↔ GitHub integration. Wrangler config lives at `wrangler.jsonc`.
- **Backend**: Supabase — Postgres + Auth + Edge Functions (`ask-terra`).
- **Domain**: `terrawatchapp.com` registered at Hostinger's domain registrar. DNS is delegated to Cloudflare so the custom domain can attach to the Worker.

There is **no Hostinger web-hosting plan** involved. The Hostinger account is used only for domain registration.

## Cloudflare Workers (frontend)

### One-time setup

1. **Install the Cloudflare GitHub App** — `github.com/settings/installations` → grant access to `datasnake-littlecobra/terrawatchapp-beta`.
2. **Create the Worker** — `dash.cloudflare.com` → **Workers & Pages** → **Create** → **Import a repository** → pick `terrawatchapp-beta`. When prompted:
   - **Project name**: `terrawatchapp-beta` (becomes the default URL, `terrawatchapp-beta.<account>.workers.dev`).
   - **Framework preset**: `Vue` (auto-detected).
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Deploy command**: `npx wrangler deploy` (auto-set; reads `wrangler.jsonc`).
   - **Production branch**: `main` (or `claude/terrawatch-redesign-dMM0l` until merged).
3. **Add env vars** — Worker → **Settings → Variables and Secrets → Add**:

   | Name | Value | Type | Notes |
   | --- | --- | --- | --- |
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | Plaintext | Baked into the bundle at build time. |
   | `VITE_SUPABASE_ANON_KEY` | anon key from Supabase → Settings → API | Plaintext | Public by design — RLS scopes access. |
   | `NODE_VERSION` | `22` | Plaintext | Pin the build Node. |

   `VITE_*` vars are read at build time, so after changing them trigger a redeploy: Worker → **Deployments** → **Retry deployment**.

4. **Trigger the first deploy** — push to the production branch, or hit **Deployments → Create deployment** in the dashboard. The build log should end with `wrangler versions upload` succeeding and a URL like `terrawatchapp-beta.<account>.workers.dev`.

### Wrangler config

`wrangler.jsonc` at repo root:

```jsonc
{
  "name": "terrawatchapp-beta",
  "compatibility_date": "2026-04-19",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

- `assets.directory: "./dist"` — serves the Vite build output.
- `not_found_handling: "single-page-application"` — any path that doesn't match a file returns `index.html` with a 200. This is what lets `/travel`, `/explore?view=list`, `/bookmarks`, etc. deep-link correctly. No `_redirects` or `.htaccess` file needed.

### Custom domain (`terrawatchapp.com`)

Attaching a custom domain to a Cloudflare Worker requires the zone (domain) to be on Cloudflare DNS. The domain stays registered at Hostinger — only the nameservers change.

1. **Add the zone in Cloudflare** — `dash.cloudflare.com` → **+ Add a Site** → enter `terrawatchapp.com` → pick the **Free** plan → Cloudflare auto-scans existing DNS records and returns two nameservers like `x.ns.cloudflare.com` and `y.ns.cloudflare.com`.
2. **Switch nameservers at Hostinger** — `hpanel.hostinger.com` → **Domain Portfolio** → `terrawatchapp.com` → **Nameservers** → **Change nameservers** → **Use custom** → paste Cloudflare's two. Propagation is usually ~15 min, up to 24h.
3. **Verify** — once `dash.cloudflare.com` marks the zone as **Active**, proceed.
4. **Attach to the Worker** — Worker → **Settings → Domains & Routes → Add Custom Domain**:
   - `terrawatchapp.com`
   - `www.terrawatchapp.com`

   Cloudflare auto-issues a Universal SSL cert (takes a few minutes).

### Preview deploys

Every push to a non-production branch gets a preview URL automatically (shown on the Worker's **Deployments** tab). Useful for review before merging into `main`.

## Supabase (auth + bookmarks + Ask Terra)

The app reads Supabase credentials from two build-time environment variables:

| Var | Visibility |
| --- | --- |
| `VITE_SUPABASE_URL` | Public (baked into the bundle) |
| `VITE_SUPABASE_ANON_KEY` | Public by design — RLS scopes it |

Get both from Supabase → **Project Settings → API**. Set them in **Cloudflare Worker → Settings → Variables and Secrets** (see table above). For local dev, copy `.env.example` to `.env.local` and fill them in.

### One-time Supabase setup

1. **Run the migration**: `supabase/migrations/0001_auth_bookmarks_asktq.sql` — creates the `bookmarks` and `ask_terra_usage` tables with RLS. Apply via `supabase db push` (CLI) or paste into Supabase → SQL Editor.
2. **Enable magic-link auth**: Supabase → **Authentication → Providers → Email** → ensure **Email link** is on. Optionally disable "Confirm email" for a one-tap flow.
3. **Add the app's URLs** under Authentication → **URL Configuration**:
   - Site URL: `https://terrawatchapp.com`
   - Redirect URLs: `https://terrawatchapp.com/auth/callback`, `https://terrawatchapp-beta.<account>.workers.dev/auth/callback`, `http://localhost:5173/auth/callback`

### Ask Terra edge function

`supabase/functions/ask-terra/` proxies Anthropic Claude so the API key never touches the client. It needs two secrets set **in Supabase** (not in Cloudflare):

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# SUPABASE_SERVICE_ROLE_KEY is set automatically by the platform.
```

Optionally tune the daily per-user quota (default 5):

```bash
supabase secrets set ASK_TERRA_DAILY_LIMIT=10
```

### Auto-deploying migrations + edge functions

`.github/workflows/deploy-edge-functions.yml` runs on every push that touches `supabase/migrations/**` or `supabase/functions/**`. It:

1. `supabase link --project-ref $SUPABASE_PROJECT_REF`
2. `supabase db push --password $SUPABASE_DB_PASSWORD` — applies any new migrations.
3. `supabase functions deploy ask-terra` — with JWT verification **on**.
4. `supabase functions deploy ingest-events` — with JWT verification **off** (it's authenticated by the `x-ingest-secret` shared secret instead, so the GitHub Actions cron can reach it without a user token).

GitHub Secrets (Repo → **Settings → Secrets and variables → Actions → Secrets**):

| Secret | How to get it |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase → **Account → Access Tokens → Generate new token** |
| `SUPABASE_PROJECT_REF` | The 20-character project ref in your project URL (`https://<ref>.supabase.co`) |
| `SUPABASE_DB_PASSWORD` | Supabase → **Project Settings → Database → Connection string → Password** (the one you set at project creation; reset it there if you don't remember) |
| `INGEST_SECRET` | Any long random string — paste the same value into `supabase secrets set INGEST_SECRET=...` (see Events ingest section below). |

Once set, every push to `main` or `claude/terrawatch-redesign-dMM0l` that touches those paths auto-applies the migration **and** redeploys both functions.

## Events ingest pipeline (Phase 8)

The `events` table is a unified feed that backs the Home "Recent events" strip and the Explore list. Rows come from USGS earthquakes, NOAA NWS alerts (US), and NOAA SWPC Kp. Writing happens exclusively via the `ingest-events` edge function using the service-role key; anonymous clients have SELECT-only RLS so the feed renders without sign-in.

### One-time setup

1. **Apply migration 0002** — happens automatically via the workflow above on the first push that includes `supabase/migrations/0002_events_ingest.sql`. It enables PostGIS and creates the `events` table + `events_near()` + `events_prune()` functions.
2. **Set the shared secret** on the Supabase project:

   ```bash
   openssl rand -hex 32    # generate a value
   supabase secrets set INGEST_SECRET=<paste>
   ```

   Save the same value as the `INGEST_SECRET` GitHub Secret so the cron workflow can send it in the `x-ingest-secret` header.

3. **Enable the cron** — the `.github/workflows/ingest-events-cron.yml` workflow runs every 10 minutes once the repo has the `SUPABASE_PROJECT_REF` and `INGEST_SECRET` secrets. First run: push the workflow file, then **Actions tab → Ingest events (cron) → Run workflow** to backfill immediately (scheduled runs take a few minutes to kick in on a new repo).

### Manual ingest

For local testing or to force a refresh:

```bash
curl -sS -X POST \
  "https://<project-ref>.supabase.co/functions/v1/ingest-events" \
  -H "x-ingest-secret: $INGEST_SECRET" \
  -H "content-type: application/json" \
  --data '{}' | jq
```

Expected response: `{ ok: true, durationMs: ..., results: { seismic: {...}, weather: {...}, space: {...} }, pruned: N }`.

### Client behavior

`src/composables/useEvents.ts` reads via the `events_near` RPC when `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set, and transparently falls back to the legacy live-API path (USGS / Open-Meteo / SWPC direct) if the RPC errors or Supabase is unconfigured. The UI never goes blank mid-ingest.

## Troubleshooting

- **`Missing entry-point to Worker script or to assets directory`** — `wrangler.jsonc` missing or malformed. Make sure the file exists at repo root and contains the `assets.directory` field.
- **Deep link returns 404 on hard refresh** — `not_found_handling: "single-page-application"` missing from `wrangler.jsonc`.
- **Build succeeds but sign-in silently fails** — `VITE_SUPABASE_*` env vars weren't set before the build. `VITE_*` vars are baked in at build time; set them in Worker settings and **Retry deployment**.
- **Custom domain shows "SSL pending"** — normal for the first ~5 minutes after attaching. If it's still pending after an hour, confirm the zone status is **Active** and the nameserver change actually propagated (`dig NS terrawatchapp.com`).
- **Service worker caches old build** — `vite-plugin-pwa` is set to `autoUpdate`; a hard reload clears it. If stale builds become a pattern we can add a "new version available" toast.
- **Events feed is empty on the deployed app** — the ingest cron hasn't run yet or `INGEST_SECRET` doesn't match between Supabase and GitHub. Check **Actions → Ingest events (cron) → latest run** — HTTP 403 = secret mismatch, HTTP 500 = service-role missing from Supabase. The client falls back to live APIs in the meantime so the UI still renders.
- **`supabase db push` fails in the deploy workflow** — `SUPABASE_DB_PASSWORD` is wrong or missing. Reset it in Supabase → Project Settings → Database and update the GitHub Secret.

## Migrating away from the old Hostinger FTP workflow

The repo still contains `.github/workflows/deploy.yml` (Hostinger FTP deploy) from Phase 7. Once the Cloudflare deploy is confirmed green on a production push:

1. Delete `.github/workflows/deploy.yml`.
2. Delete the `HOSTINGER_FTP_*` GitHub secrets (Repo → **Settings → Secrets and variables → Actions**) — harmless if left but confusing.
3. The `VITE_SUPABASE_*` GitHub Actions **Variables** (not secrets) can also be removed, since Cloudflare reads its own copies from Worker settings.

Leave `.github/workflows/deploy-edge-functions.yml` in place — that one handles Supabase Edge Functions and is orthogonal to where the frontend is hosted.
