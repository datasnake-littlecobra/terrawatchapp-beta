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
3. **Phase 10 — enable email + password auth**: Same screen, ensure **Email and password** is also on. Default password rules are fine; the SignInView enforces 8+ chars client-side too.
4. **Phase 10 — enable Google OAuth** (instructions below in the "Google OAuth" subsection).
5. **Add the app's URLs** under Authentication → **URL Configuration**:
   - **Site URL**: `https://hyperlocalwatch.com` (or your primary domain)
   - **Redirect URLs** (one per line):
     - `https://hyperlocalwatch.com/auth/callback`
     - `https://hyperlocalwatch.com/auth/reset`
     - `https://terrawatchapp.com/auth/callback` (preemptive for cutover)
     - `https://terrawatchapp.com/auth/reset`
     - `https://terrawatchapp-beta.<account>.workers.dev/auth/callback`
     - `http://localhost:5173/auth/callback`
     - `http://localhost:5173/auth/reset`

### Google OAuth (Phase 10)

Supabase needs an OAuth client from Google Cloud to authenticate users via Google. One-time setup:

1. **Google Cloud → APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**
   - Authorized JavaScript origins: `https://hyperlocalwatch.com`, `https://<your-supabase-ref>.supabase.co`
   - Authorized redirect URIs: `https://<your-supabase-ref>.supabase.co/auth/v1/callback` (this is Supabase's GoTrue endpoint, not the app's `/auth/callback` — Supabase handles the hop and bounces back to the app's redirect)
2. Copy the **Client ID** and **Client secret**.
3. Supabase → **Authentication → Providers → Google** → enable, paste both values, save.
4. Optionally configure the OAuth consent screen branding (logo, support email, privacy URL) in Google Cloud — what users see when granting access.

Verify: visit `/auth/sign-in`, click "Continue with Google" → consent screen shows TerraWatch's name → first time creates the account, subsequent times reuses it. Identities link automatically to existing users by verified email, so an email-magic-link account merges with a Google sign-in for the same address.

### Email templates (Phase 10)

Supabase → **Authentication → Email Templates** — four templates customise sender branding:

- **Confirm signup** — sent after sign-up. Body's `{{ .ConfirmationURL }}` should point to `/auth/callback`.
- **Magic link** — same as today.
- **Reset password** — `{{ .ConfirmationURL }}` points to `/auth/reset`.
- **Change email** — `/auth/callback`.

Default templates work fine for beta; revisit with branded HTML when shipping public.

### Anthropic-backed edge functions

Four functions share the `ANTHROPIC_API_KEY` secret:

- `supabase/functions/ask-terra/` — trip-verdict explainer (Phase 7).
  Daily quota controlled by `ASK_TERRA_DAILY_LIMIT` (default 5).
- `supabase/functions/ask-terra-chat/` — Phase 9.3 free-form chat with
  multi-turn history + RAG over `events_recent`. Daily quota controlled
  by `TERRA_CHAT_DAILY_LIMIT` (default 10).
- `supabase/functions/generate-blog/` — Phase 9.9 admin-only blog
  generator. JWT-gated AND server-side `is_admin()` check. Returns
  four platform-tailored variants per call (App / LinkedIn / Reddit /
  Instagram). Daily quota per admin via `GENERATE_BLOG_DAILY_LIMIT`
  (default 5).
- `supabase/functions/generate-linkedin-post/` — Phase 9.17 LinkedIn
  auto-poster generator. Reads `docs/LINKEDIN_FEED.md` from GitHub
  raw, picks the oldest unprocessed topic by sha256, drafts a polished
  post via Claude, writes a row to `public.linkedin_posts`. Two call
  paths: admin JWT (from /admin/linkedin) and `x-ingest-secret` for
  cron. Daily quota per admin via `LINKEDIN_GEN_DAILY_LIMIT`
  (default 5; skipped on cron path).

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# Optional tuning:
supabase secrets set ASK_TERRA_DAILY_LIMIT=10
supabase secrets set TERRA_CHAT_DAILY_LIMIT=20
supabase secrets set GENERATE_BLOG_DAILY_LIMIT=10
supabase secrets set LINKEDIN_GEN_DAILY_LIMIT=10
# Optional override (defaults to main branch raw URL):
supabase secrets set LINKEDIN_FEED_URL=https://raw.githubusercontent.com/<org>/<repo>/main/docs/LINKEDIN_FEED.md
```

### LinkedIn auto-poster (Phase 9.17 — generate + review only)

The /admin/linkedin dashboard surfaces every generated draft. Topics
are maintained in `docs/LINKEDIN_FEED.md` — a markdown doc with one
bullet per topic under a `## Topics` heading. The generator picks the
oldest topic whose sha256 hash isn't in `public.linkedin_posts` yet.

**To trigger a draft manually:** visit `/admin/linkedin` → click
"+ Generate from next topic". The draft appears in the list with
status `draft`. Click the row → edit content + hashtags → click
Approve → click "Copy to clipboard" → paste into LinkedIn manually.

### LinkedIn auto-publish (Phase 9.17.1 — OAuth + cron)

When this runs, approved drafts get posted to the DataSnake company
page automatically on the Mon/Wed/Fri 14:00 UTC cron, OR immediately
via the "Publish now" button next to each approved draft.

**One-time LinkedIn Developer Console setup**:

1. Open https://www.linkedin.com/developers/apps → DataSnake app.
2. **Auth** tab → "Authorized redirect URLs for your app" → add:
   `https://hyperlocalwatch.com/admin/linkedin/oauth-callback`
3. **Products** tab → request **Community Management API**
   (self-serve, instant approval). This unlocks
   `w_organization_social` + `r_organization_admin` scopes.
4. **Auth** tab → copy Client ID + Client Secret.

**Set the secrets** (server-side — never in the repo):

```bash
# Supabase Edge Function secrets — used by linkedin-oauth-callback
# + publish-linkedin-post.
supabase secrets set LINKEDIN_CLIENT_ID=<your-app-id>
supabase secrets set LINKEDIN_CLIENT_SECRET=<your-app-secret>
```

**Set the build-time client ID** so the Vue app can construct the
authorize URL:

```bash
# In your hosting provider's env vars (Cloudflare Pages / Vercel),
# add this and rebuild:
VITE_LINKEDIN_CLIENT_ID=<your-app-id>
```

The client ID is meant to be public (OAuth convention — redirect-URI
whitelist on the LinkedIn side is the security boundary). The
secret stays server-side only.

**Set the function URLs in Vault** (so pg_cron can POST to them):

```sql
-- Run once in Supabase SQL Editor, replacing <ref> with your project ref.
select vault.create_secret(
  'https://<ref>.supabase.co/functions/v1/generate-linkedin-post',
  'generate_linkedin_post_url'
);
select vault.create_secret(
  'https://<ref>.supabase.co/functions/v1/publish-linkedin-post',
  'publish_linkedin_post_url'
);
```

**Connect the page**:

1. Visit `/admin/linkedin/connect`.
2. Click "Connect DataSnake LinkedIn" → LinkedIn consent screen.
3. After consent you're redirected back, tokens are exchanged
   server-side and stored in `public.linkedin_oauth`.
4. The status page should now show "✓ Connected — DataSnake".

**Verify**:

- Approve a draft in `/admin/linkedin`.
- Click "publish now" next to it → check the LinkedIn page for the post.
- Confirm the row in `public.linkedin_posts` now has `status='published'`
  + `linkedin_urn` populated.

**Cron schedules** (migration 0038):

- `linkedin-generate-mwf` — Mon/Wed/Fri 09:00 UTC — drafts next topic.
- `linkedin-publish-mwf`  — Mon/Wed/Fri 14:00 UTC — publishes oldest approved.

5-hour gap is the human review window. Adjust cron expressions in
`0038_linkedin_cron.sql` if you want different cadences.

Migration `0036_linkedin_posts.sql` adds `linkedin_posts` +
`linkedin_generator_usage` tables. Both admin-only RLS.

The chat function relies on migration `0017_terra_chat.sql` for the
`terra_conversations` / `terra_messages` / `terra_chat_usage` tables.
The blog generator relies on migrations `0018_user_profiles_admin.sql`
+ `0020_blog_generator_usage.sql`. Both apply automatically on push.

### Admin role + blog admin UI (Phase 9.8)

Migrations `0018` and `0019` add:
- `public.user_profiles` table with a `role` column (`user` | `admin`),
  auto-populated for every signup via a trigger on `auth.users`.
- `public.is_admin()` helper RPC used by RLS policies and the
  generate-blog edge function.
- `public.redeem_admin_code(submitted_code)` RPC that promotes the
  caller to admin if the submitted code matches the Vault-stored
  `admin_signup_code` secret.
- `public.blog_posts` table (DB-backed; replaces the Phase 9.7
  MD-files-in-repo design). Public read via RLS for `published=true`;
  admin reads/writes everything. The two existing posts are seeded.

**One-time Vault setup** (once per environment) — Supabase Dashboard →
SQL Editor:

```sql
select vault.create_secret('<your-shared-admin-signup-code>', 'admin_signup_code');
```

Pick a long, random code (32+ chars). To rotate later:

```sql
update vault.secrets
   set secret = '<new-code>'
 where name = 'admin_signup_code';
```

**Bootstrapping the first admin** (after Phase 9.8 follow-up — single-call flow):

1. Set the Vault secret as above.
2. Visit `https://hyperlocalwatch.com/admin/sign-up`.
3. Enter email + password + the Vault secret you just set.
4. The page calls the `signup-admin` edge function which creates your
   account with `email_confirm=true` (no inbox needed) AND sets
   `user_profiles.role='admin'` atomically. You're signed in and routed
   to `/admin/blog` automatically.
5. Subsequently, log in via the regular `/auth/sign-in` — same
   credentials work for both surfaces.

### Tenant (non-admin) signup — Phase 9.16.0

Regular signups via `/auth/sign-in` → "Sign up" tab also bypass
email confirmation. The flow calls the `signup-tenant` Edge
Function which creates the user with `email_confirm=true`
(mirroring the admin path) so free-tier Supabase email throttling
never blocks new tenants.

**Optional gating** — to require a code before anyone can sign up
(useful during private beta), set a Vault secret:

```sql
-- Open mode is the default: anyone can sign up, no code needed.
-- Set this secret only when you want to gate signups.
select vault.create_secret('<your-shared-beta-code>', 'tenant_signup_code');
```

When the secret is **absent** (default), the signup flow runs
open. When it's **set**, the signup form's "Beta access code"
field becomes mandatory and must match. Rotate by updating the
Vault row; remove by deleting the secret.

**Long-term fix** — configure a real SMTP provider in Supabase
Dashboard → Project Settings → Auth → SMTP Settings (Resend
has a 3,000-emails/month free tier; Postmark, SES, SendGrid all
work). Once custom SMTP is configured you can revert the signup
flow to `supabase.auth.signUp()` if you want the traditional
confirmation-email flow back.

**If you signed up earlier and got stuck** (signed up but never received
the confirmation email and now hit "invalid credentials" on sign-in),
you have two recovery paths:

```sql
-- Option A: Just confirm + promote your existing account.
-- Run in Supabase SQL Editor.
update auth.users
   set email_confirmed_at = now(),
       confirmed_at       = now()
 where email = 'YOUR_EMAIL_HERE'
   and email_confirmed_at is null;

update public.user_profiles
   set role = 'admin'
 where user_id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
```

```sql
-- Option B: Wipe the stuck account and re-signup via /admin/sign-up
-- with the new single-call flow.
delete from auth.users where email = 'YOUR_EMAIL_HERE';
-- Then visit /admin/sign-up again.
```

To list current admins:

```sql
select up.user_id, u.email, up.role
  from public.user_profiles up
  join auth.users u on u.id = up.user_id
 where up.role = 'admin';
```

To demote an admin:

```sql
update public.user_profiles set role = 'user' where user_id = '<uuid>';
```

### Email delivery (Supabase free-tier email is unreliable)

Supabase's built-in email is rate-limited and frequently delays
delivery. The admin-signup flow above sidesteps this by creating users
with `email_confirm=true`, but **password resets** and **regular user
signups** still depend on email working. Two paths:

1. **Quickest** — Supabase Dashboard → Authentication → Providers →
   Email → toggle **"Confirm email" OFF**. Now regular signups don't
   need email confirmation either. Reduces friction; loses the
   email-ownership check.

2. **Production-grade** — Configure custom SMTP using a real provider
   (Resend, Postmark, SendGrid). Free tiers exist:
   - **Resend** (recommended) — 3,000 emails/month free, simplest setup.
     Add domain `terrawatchapp.com` → verify the SPF/DKIM records they
     give you in Cloudflare DNS → grab API key.
   - Supabase Dashboard → **Authentication → Emails → SMTP Settings**:
     - Host: `smtp.resend.com`, Port: `465`, Username: `resend`,
       Password: `<resend-api-key>`,
     - Sender email: `info@terrawatchapp.com` (or `hello@`, `support@`,
       `noreply@`),
     - Sender name: `TerraWatch`.
   - Save → send a test email to confirm.

Once SMTP is configured, the regular sign-in flow's magic links and
password resets will deliver reliably from your domain.

To receive replies on those addresses, add Cloudflare Email Routing
(free): CF Dashboard → terrawatchapp.com → Email → Email Routing → add
forwarding rules `info@terrawatchapp.com → your-personal-gmail@…` etc.

### Per-post OG meta for social previews (Phase 9.8.1)

A small Cloudflare Worker at `worker/index.js` intercepts `/blog/:slug`
requests, fetches the post from Supabase via PostgREST (anon key, RLS
scoped to `published=true`), and rewrites the SPA shell's `<title>`,
`og:*`, `twitter:*`, and `article:*` meta tags before responding. This
makes per-post link previews work on **non-JS crawlers** (LinkedIn,
Reddit, Facebook, WhatsApp) as well as the JS-aware ones already
covered by the client-side `useMeta` composable.

**One-time Worker env-var setup** (Cloudflare dashboard → Worker
`terrawatchapp-beta` → **Settings → Variables and Secrets**, both as
plaintext — they're public-by-design):

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` (e.g. `https://xxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | Same as `VITE_SUPABASE_ANON_KEY` |

After adding the vars, push any commit (or click "Retry deployment")
to rebuild the Worker against the new env. Verify with:

```bash
curl -s https://hyperlocalwatch.com/blog/why-we-built-terrawatch | grep -E 'og:title|og:image|twitter:title'
```

…you should see per-post `og:title`, `og:description`, `og:url`, and
(if the post has a `hero_image`) `og:image` tags — not the index.html
defaults.

**Validating in the platforms themselves**:
- **LinkedIn** — paste the URL into <https://www.linkedin.com/post-inspector/>
  and click "Inspect". They cache aggressively; re-inspect after edits.
- **Twitter / X** — <https://cards-dev.twitter.com/validator>.
- **Facebook / WhatsApp** — <https://developers.facebook.com/tools/debug/>;
  WhatsApp uses Facebook's scraper.
- **Discord / Slack** — paste the URL into a channel; they re-fetch
  every ~30 minutes.

The Worker has a 5-minute CDN cache. Edits to a published post
propagate within that window; the social platforms have their own
caches on top (LinkedIn especially — use post-inspector to refresh).

**For posts to actually show an image** in previews, set the post's
**Hero image URL** field in `/admin/blog/:id`. Use either an absolute
HTTPS URL (e.g. CDN-hosted) or a path served from `/public/` (e.g.
`/images/blog/<slug>.jpg`). LinkedIn requires the image be at least
1200×627 for the wide-card variant.

### Auto-deploying migrations + edge functions

`.github/workflows/deploy-edge-functions.yml` runs on every push that touches `supabase/migrations/**` or `supabase/functions/**`. It:

1. `supabase link --project-ref $SUPABASE_PROJECT_REF`
2. `supabase db push --password $SUPABASE_DB_PASSWORD` — applies any new migrations.
3. `supabase functions deploy ask-terra` — with JWT verification **on**.
4. `supabase functions deploy ingest-{seismic,weather,space,wildfires,volcanoes}` — five per-source functions, each with JWT verification **off** (authenticated by the shared `x-ingest-secret` header instead). The split exists because the old monolithic `ingest-events` function kept hitting Supabase's per-invocation memory cap (~256 MB) — see the Events ingest section below.

GitHub Secrets (Repo → **Settings → Secrets and variables → Actions → Secrets**):

| Secret | How to get it |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase → **Account → Access Tokens → Generate new token** |
| `SUPABASE_PROJECT_REF` | The 20-character project ref in your project URL (`https://<ref>.supabase.co`) |
| `SUPABASE_DB_PASSWORD` | Supabase → **Project Settings → Database → Connection string → Password** (the one you set at project creation; reset it there if you don't remember) |
| `INGEST_SECRET` | Any long random string — paste the same value into `supabase secrets set INGEST_SECRET=...` (see Events ingest section below). |
| `SUPABASE_URL_PUBLIC` (optional) | Same value as `VITE_SUPABASE_URL`. Powers the nightly health-check workflow's PostgREST queries. Without it the workflow runs only the page-reachability + OG-injector checks. |
| `SUPABASE_ANON_KEY_PUBLIC` (optional) | Same value as `VITE_SUPABASE_ANON_KEY`. Pairs with the secret above. |

Once set, every push to `main` or `claude/terrawatch-redesign-dMM0l` that touches those paths auto-applies the migration **and** redeploys both functions.

### Nightly health-check workflow (Phase 9.10 Tier B)

`.github/workflows/nightly-health-check.yml` runs at 07:00 UTC daily and can be triggered manually from the Actions tab. It:

1. Pings `/`, `/events`, `/alerts`, `/blog`, `/monitoring/ocean`, and the three `/research/*` views; flags any non-200.
2. Verifies the OG worker injected per-post `og:title` for `/blog/why-we-built-terrawatch`.
3. Calls the public `research_counters` RPC and `events_recent` RPC to confirm Supabase + ingesters are alive.
4. Posts a Markdown report into the workflow run's **Step Summary** so you can read the result without leaving GitHub.

To enable the optional Supabase data-freshness checks, add `SUPABASE_URL_PUBLIC` + `SUPABASE_ANON_KEY_PUBLIC` to GitHub Secrets (same values as the `VITE_*` env vars — both are public-by-design). Without them the workflow still does the curl checks; it just skips the data-freshness lines.

## Events ingest pipeline (Phase 8)

The `events` table is a unified feed that backs the Home "Recent events" strip and the Explore list. Rows come from USGS earthquakes (incl. tsunamis), NOAA NWS alerts (US), NOAA SWPC Kp, NASA EONET wildfires, and USGS HANS volcanoes. Writing happens exclusively via the per-source `ingest-{seismic,weather,space,wildfires,volcanoes}` edge functions using the service-role key; anonymous clients have SELECT-only RLS so the feed renders without sign-in.

> **Why per-source functions?** Phase 9.0 ran a single monolithic `ingest-events` worker. Even after sequential pipelining, chunked upserts, smaller upstream feeds, and a 500-row cap, the combined parsed payloads (NWS alerts with full descriptions and polygon geometries are the worst offender) kept tripping Supabase's per-invocation memory cap with `WORKER_RESOURCE_LIMIT`. Phase 9.0.1 split into five independent workers — each gets the full ~256 MB budget, failures stay scoped per source, and pg_cron staggers them by minute so DB load is even.

### One-time setup

1. **Apply migration 0002** — happens automatically via the workflow above on the first push that includes `supabase/migrations/0002_events_ingest.sql`. It enables PostGIS and creates the `events` table + `events_near()` + `events_prune()` functions.
2. **Set the shared secret** on the Supabase project:

   ```bash
   openssl rand -hex 32    # generate a value
   supabase secrets set INGEST_SECRET=<paste>
   ```

   Save the same value as the `INGEST_SECRET` GitHub Secret so the cron workflow can send it in the `x-ingest-secret` header.

3. **Enable the scheduler** — see the pg_cron subsection below. The primary 10-minute schedule runs inside Postgres; GitHub Actions' `schedule` trigger proved too flaky (delayed activation, throttling under load) to back a user-visible feed.

### pg_cron scheduler (primary)

Migration `0007_split_ingest_cron.sql` enables `pg_cron` + `pg_net` and schedules five staggered hourly jobs — one per source — that POST to their respective edge functions. Before the schedules can actually call the functions, **the shared secret + five function URLs need to live in Supabase Vault**. This is the one manual step, done once per project:

```sql
-- In Supabase Dashboard → SQL Editor, run:

-- The shared ingest secret (only needed once; reused by all functions).
select vault.create_secret(
  '<the-same-hex-string-you-set-as-INGEST_SECRET>',
  'ingest_secret'
);

-- One URL per function. Replace <ref> with your Supabase project ref.
select vault.create_secret('https://<ref>.supabase.co/functions/v1/ingest-seismic',   'ingest_seismic_url');
select vault.create_secret('https://<ref>.supabase.co/functions/v1/ingest-weather',   'ingest_weather_url');
select vault.create_secret('https://<ref>.supabase.co/functions/v1/ingest-space',     'ingest_space_url');
select vault.create_secret('https://<ref>.supabase.co/functions/v1/ingest-wildfires', 'ingest_wildfires_url');
select vault.create_secret('https://<ref>.supabase.co/functions/v1/ingest-volcanoes', 'ingest_volcanoes_url');
-- Phase 9.2.1 — global multi-hazard (volcanoes/cyclones/floods/tsunamis/wildfires).
select vault.create_secret('https://<ref>.supabase.co/functions/v1/ingest-gdacs',       'ingest_gdacs_url');
-- Phase 9.2.2 — Smithsonian Global Volcanism Program weekly report.
select vault.create_secret('https://<ref>.supabase.co/functions/v1/ingest-smithsonian', 'ingest_smithsonian_url');
-- Phase 9.2.3a — NOAA National Hurricane Center (Atlantic + E. Pacific).
select vault.create_secret('https://<ref>.supabase.co/functions/v1/ingest-nhc',         'ingest_nhc_url');
-- Phase 9.2.4 — OpenAQ global air quality (PM2.5 readings ≥55 µg/m³).
select vault.create_secret('https://<ref>.supabase.co/functions/v1/ingest-openaq',      'ingest_openaq_url');
-- Phase 9.6 — NOAA NDBC ocean buoys (time-series → measurements table).
select vault.create_secret('https://<ref>.supabase.co/functions/v1/ingest-ndbc',        'ingest_ndbc_url');
```

**OpenAQ v3 requires an API key** — recent breaking change in Q1 2026; the
ingester returns 401 silently without one, leaving `air_quality` empty in
the events feed. Register free at https://explore.openaq.org/register and
set as an edge-function secret (not Vault):

```bash
supabase secrets set OPENAQ_API_KEY=<your-key>
```

After rotating, redeploy the function so it picks up the new env:

```bash
supabase functions deploy ingest-openaq --no-verify-jwt=true
```

### Diagnosing missing data

If a source isn't producing rows, run these in order — one of them always
points at the actual problem:

```sql
-- A. Did all Vault URL secrets get inserted?
select name from vault.decrypted_secrets
where name like 'ingest_%_url'
order by name;
-- Expect rows for every ingester you've shipped. Missing = run vault.create_secret(...).

-- B. Are crons firing successfully?
select jobname, status, return_message, start_time
from cron.job_run_details
order by start_time desc limit 30;
-- 'failed' rows tell you what's wrong (missing vault secret, function error, etc).

-- C. Per-source row counts (last 24h)
select source, count(*), max(occurred_at) as latest
from public.events
where occurred_at >= now() - interval '24 hours'
group by source order by 2 desc;

-- D. Per-category row counts (drives the dropdown's auto-grey UX from 9.5)
select * from public.events_category_counts(30);
-- Categories with 0 rows render greyed in the UI.
```

For source-specific failures, also check Edge Function logs:
**Supabase Dashboard → Edge Functions → <name> → Logs**. Look for
`HTTP 401` (auth), `HTTP 5xx` (upstream down), or `[ingest:<name>]`
prefixed warnings (parser issues).

**Air-quality (`openaq.pm25`) showing zero rows? Most-likely causes:**

```sql
-- 1. Is the URL secret present?
select name from vault.decrypted_secrets where name = 'ingest_openaq_url';
-- If empty: select vault.create_secret('https://<ref>.supabase.co/functions/v1/ingest-openaq', 'ingest_openaq_url');

-- 2. Did the cron actually run, and what did it return?
select status, return_message, start_time
from cron.job_run_details
where jobname = 'ingest-openaq-hourly'
order by start_time desc limit 5;
-- 'HTTP 401' from openaq → API key required. See below.
-- 'HTTP 5xx' → OpenAQ API is having issues; retry later.

-- 3. Did rows land but get filtered out?
-- The ingester only stores readings ≥55 µg/m³ PM2.5 (US EPA 'Unhealthy').
-- Most regions are below that on a clean-air day. Confirm by relaxing
-- the filter temporarily in supabase/functions/ingest-openaq/index.ts.
```

**OpenAQ API key requirement (likely root cause):** OpenAQ's v3 API
now requires a free API key for the `/parameters/2/latest` endpoint
the ingester uses. Get one at <https://api.openaq.org/register>, then:

```bash
supabase secrets set OPENAQ_API_KEY=<your-key>
```

Then re-deploy the ingester (push any commit that touches
`supabase/functions/ingest-openaq/**`) and watch the next cron run
succeed.

**"Why is tornado / hurricane / heat / flood / thunderstorm empty?"**

These categories *are* supported via existing ingesters — they just
fire only during real activity:

| Category | Source | When it fires |
| --- | --- | --- |
| `tornado` | NWS alerts | Active US tornado warnings |
| `hurricane` | NHC + GDACS + NWS | Active Atlantic / E. Pacific cyclones |
| `heat` | NWS alerts | US heat advisories (June–Sept usually) |
| `flood` | NWS alerts + GDACS | Active flood/flash-flood warnings |
| `storm` | NWS alerts (incl. severe thunderstorm warnings) | US severe convective storms |
| `winter_storm` | NWS alerts | US winter storm warnings (Nov–Mar) |
| `wildfire` | NASA EONET | Active fires globally |
| `earthquake` | USGS + GDACS | Always (ambient seismicity) |
| `volcano` | USGS HANS + Smithsonian GVP + GDACS | Always (continuous unrest reports) |
| `geomagnetic_storm` | NOAA SWPC | Always (Kp index sample every hour) |
| `air_quality` | OpenAQ | Stations with PM2.5 ≥55 µg/m³ |

Run query D above (`events_category_counts(30)`) to see which
categories have rows in the last 30 days. Empty buckets in season
suggest a quiet period; empty buckets across multiple seasons suggest
the upstream source is failing — check the cron run history.

`vault.create_secret` is idempotent on name conflict (it errors); re-running is safe — just skip rows you already have. The legacy `ingest_events_url` row from the monolith era can be deleted at your leisure (harmless if left).

Verify the schedules are active:

```sql
select jobname, schedule, active from cron.job order by jobname;
-- expected: 12 active rows (10 ingesters + 2 monitoring jobs)
--   ingest-seismic-hourly       '0 * * * *'
--   ingest-weather-hourly       '2 * * * *'
--   ingest-space-hourly         '4 * * * *'
--   ingest-wildfires-hourly     '6 * * * *'
--   ingest-volcanoes-hourly     '8 * * * *'
--   ingest-gdacs-hourly         '10 * * * *'
--   ingest-smithsonian-hourly   '12 * * * *'
--   ingest-nhc-hourly           '14 * * * *'
--   ingest-openaq-hourly        '16 * * * *'
--   ingest-ndbc-hourly          '18 * * * *'
--   measurements-hourly-refresh '*/30 * * * *'   (Phase 9.6)
--   measurements-prune-nightly  '17 3 * * *'     (Phase 9.6)
```

Inspect recent runs (per source):

```sql
select jobname, status, return_message, start_time, end_time
from cron.job_run_details
order by start_time desc
limit 25;
```

Pause / resume one source:

```sql
select cron.unschedule('ingest-weather-hourly');   -- pause just NWS
-- to resume, re-apply migration 0007 (idempotent) or re-run the relevant cron.schedule(...) statement
```

If the secrets aren't set, the trigger functions return `null` and log a notice — schedules will continue firing but do nothing, so set the Vault secrets first.

### Manual ingest

For on-demand refresh (debugging or forcing a backfill), call any single source directly:

```bash
# Substitute one of: ingest-seismic, ingest-weather, ingest-space, ingest-wildfires, ingest-volcanoes
curl -sS -X POST \
  "https://<project-ref>.supabase.co/functions/v1/ingest-seismic" \
  -H "x-ingest-secret: $INGEST_SECRET" \
  -H "content-type: application/json" \
  --data '{}' | jq
```

Or trigger from inside Postgres (uses the Vault secrets, same path the cron takes):

```sql
select public.trigger_ingest_seismic();   -- returns a pg_net request id
-- then poll: select * from net._http_response order by created desc limit 1;
```

Expected response per function: `{ ok: true, source: 'seismic', durationMs: ..., result: { attempted, upserted, skipped, error: null } }`. `ok: false` means that source errored — check Supabase → Edge Functions → that function's Logs for the full stack trace. One source failing no longer blocks the others.

### Client behavior

`src/composables/useEvents.ts` reads via the `events_near` RPC when `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set, and transparently falls back to the legacy live-API path (USGS / Open-Meteo / SWPC direct) if the RPC errors or Supabase is unconfigured. The UI never goes blank mid-ingest.

## Insurance MVP — FEMA NRI seeding (Phase 9.12)

The `/insurance` dashboard reads from `public.fema_nri`, a static county-level table seeded from the FEMA National Risk Index. Migrations `0025_fema_nri.sql` and `0026_insurance_rpcs.sql` create the table + five public RPCs. The seed itself is a one-time manual step per FEMA release — re-run yearly when FEMA publishes a new version (typically Q4).

### One-time CSV preparation per release

FEMA distributes the National Risk Index as a ZIP wrapping a CSV. The Deno standard library doesn't ship a ZIP reader, so the `seed-fema-nri` edge function takes a **plain CSV URL**, not the FEMA `.zip`. Operator workflow:

1. Visit https://hazards.fema.gov/nri/data-resources and download the **Counties — CSV** archive (`NRI_Table_Counties.zip`, ~30MB).
2. Unzip locally — you'll get `NRI_Table_Counties.csv` (~80MB).
3. Upload the CSV to a publicly-readable URL. Easiest path:
   - Supabase dashboard → **Storage** → create a bucket called `fema` if it doesn't exist (Public bucket: yes).
   - Upload `NRI_Table_Counties.csv` to the bucket.
   - Copy the public URL (right-click the row → **Get URL**).

### Run the seed

Two interchangeable paths:

**a) GitHub Actions (recommended)** — Actions tab → **Seed FEMA NRI** → Run workflow → paste the CSV URL → Run. The workflow POSTs to the edge function with `INGEST_SECRET` and prints the result.

**b) Direct curl** — for ad-hoc reseeding from your machine:

```bash
curl -sS -X POST \
  "https://<project-ref>.supabase.co/functions/v1/seed-fema-nri" \
  -H "x-ingest-secret: $INGEST_SECRET" \
  -H "content-type: application/json" \
  --max-time 600 \
  --data '{ "csv_url": "<public CSV URL>", "dry_run": false }' | jq
```

Set `dry_run: true` first to validate the CSV parses correctly (returns row counts + a sample row without inserting). Then re-run with `dry_run: false`.

Expected response on success: `{ ok: true, fetched: ~3200, parsed: ~3200, upserted: ~3200, sample: { ... }, error: null }`. The function upserts on `county_fips` so re-running is idempotent.

### Verification

```sql
-- Should be ~3,200
select count(*) from public.fema_nri;

-- Sample row
select * from public.fema_nri where county_fips = '06037';  -- LA County

-- Sanity-check the RPCs that drive the dashboard
select * from public.insurance_counters();
select * from public.insurance_top_counties_by_hazard('flood', 10);
select * from public.insurance_top_counties_by_hazard('wildfire', 10);
select * from public.insurance_top_counties_by_hazard('hurricane', 10);
select * from public.insurance_state_eal(20);
select count(*) from public.insurance_active_threats_in_high_risk(80, 50);
```

After the seed lands, visit `https://hyperlocalwatch.com/insurance` — hero counters should show ~3,200 counties indexed and a multi-trillion-dollar total EAL. The state EAL bar chart populates immediately; the County Detail panel auto-loads the highest-EAL county.

### Troubleshooting

- **`csv_url not provided`** — pass it in the request body or set the `FEMA_NRI_CSV_URL` env var on the function (`supabase secrets set FEMA_NRI_CSV_URL=...`).
- **`CSV parsed to 0 valid rows — column-name mismatch?`** — FEMA changed their column headers between releases. The function maps `STCOFIPS` / `COUNTYFIPS` / `GEOID` for the FIPS column, `STATE`, `COUNTY`, plus `<HAZ>_EALT` per hazard. If FEMA renames anything, update `rowFromCsv()` in `supabase/functions/seed-fema-nri/index.ts`.
- **`502` with timeout error** — the CSV is too large or the upstream URL is slow. Try a smaller test CSV first (`dry_run: true` to confirm parsing) or move the CSV closer (Supabase Storage in the same region).
- **Hero counters all show 0** — the seed inserted into `fema_nri` but the RPCs aren't returning. Check `select count(*) from public.fema_nri;` directly. If non-zero but the RPCs return empty, the migration didn't grant `execute` to anon — re-apply `0026_insurance_rpcs.sql`.
- **Active-threat counter stays at 0** — expected if the events table doesn't have any caution/danger severity events from the last 24h that match a high-risk state. Trigger a fresh ingest run or wait for the next hourly cron tick.

## Troubleshooting

- **`Missing entry-point to Worker script or to assets directory`** — `wrangler.jsonc` missing or malformed. Make sure the file exists at repo root and contains the `assets.directory` field.
- **Deep link returns 404 on hard refresh** — `not_found_handling: "single-page-application"` missing from `wrangler.jsonc`.
- **Build succeeds but sign-in silently fails** — `VITE_SUPABASE_*` env vars weren't set before the build. `VITE_*` vars are baked in at build time; set them in Worker settings and **Retry deployment**.
- **Custom domain shows "SSL pending"** — normal for the first ~5 minutes after attaching. If it's still pending after an hour, confirm the zone status is **Active** and the nameserver change actually propagated (`dig NS terrawatchapp.com`).
- **Service worker caches old build** — `vite-plugin-pwa` is set to `autoUpdate`; a hard reload clears it. If stale builds become a pattern we can add a "new version available" toast.
- **Events feed is empty on the deployed app** — the pg_cron schedules aren't running or Vault secrets aren't set. Check `select * from cron.job_run_details order by start_time desc limit 10;` — `status='failed'` with a message like "missing vault secrets" means you haven't inserted all six `vault.create_secret(...)` rows (one shared secret + five URLs). If scheduling works but a source still fails, open **Supabase → Edge Functions → that function → Logs** for the per-source error. The client falls back to live APIs in the meantime so the UI still renders.
- **One source missing while others populate** — the per-source split means `nws.alerts` failing doesn't stop `usgs.quakes` from writing. Find the failing function in `cron.job_run_details` (it'll be the only `failed` row) and read its dedicated log stream.
- **`WORKER_RESOURCE_LIMIT` after we already split** — should be very rare now, but if it returns, the offending source's payload has grown beyond a single function's budget. Either lower `MAX_ROWS_PER_SOURCE` in `_shared/ingest-common.ts`, narrow the upstream feed (e.g. tighter NWS limit), or split that source further (e.g. split NWS into `ingest-weather-watches` vs `ingest-weather-warnings`).
- **`supabase db push` fails in the deploy workflow** — `SUPABASE_DB_PASSWORD` is wrong or missing. Reset it in Supabase → Project Settings → Database and update the GitHub Secret.

## Migrating away from the old Hostinger FTP workflow

The repo still contains `.github/workflows/deploy.yml` (Hostinger FTP deploy) from Phase 7. Once the Cloudflare deploy is confirmed green on a production push:

1. Delete `.github/workflows/deploy.yml`.
2. Delete the `HOSTINGER_FTP_*` GitHub secrets (Repo → **Settings → Secrets and variables → Actions**) — harmless if left but confusing.
3. The `VITE_SUPABASE_*` GitHub Actions **Variables** (not secrets) can also be removed, since Cloudflare reads its own copies from Worker settings.

Leave `.github/workflows/deploy-edge-functions.yml` in place — that one handles Supabase Edge Functions and is orthogonal to where the frontend is hosted.
