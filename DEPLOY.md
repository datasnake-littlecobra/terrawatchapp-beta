# Deploying TerraWatch to Hostinger

This project auto-deploys on every push to `main` or `claude/terrawatch-redesign-dMM0l` via **GitHub Actions → FTP → Hostinger**. The workflow is defined in `.github/workflows/deploy.yml`.

## Identifying your Hostinger plan

1. Open `https://hpanel.hostinger.com`.
2. In the top-left card, look at the plan label: **Single**, **Premium**, **Business**, **Cloud Startup/Pro**, or **VPS (KVM 1/2/4/8)**.
3. Cross-check at **Billing → Subscriptions** for the exact line item.

### Which path do you use?

| Plan | Recommended deploy | Why |
| --- | --- | --- |
| Single, Premium | **GitHub Actions → FTP** (this workflow) | FTP is the only server access these plans give. |
| Business, Cloud Startup/Pro | Either GitHub Actions → FTP **or** hPanel's native Git deploy | Business+ plans have GitHub auto-deploy built into hPanel — zero workflow file needed. |
| VPS (KVM) | GitHub Actions → SSH/rsync | Fastest, and the same server can host the Supabase Edge Functions / Stripe webhooks once Ask Terra Pro ships. |

If you're on Business/Cloud and want to swap to hPanel's native Git integration instead of this FTP workflow, tell me and I'll strip the Action. If you move to VPS later (e.g., to host the Ask Terra backend), I'll switch the workflow to SSH/rsync.

## One-time setup (FTP path — this workflow)

### 1. Create an FTP account in hPanel

1. hPanel → **Files → FTP Accounts**.
2. Note the **FTP hostname** (typically `ftp.<yourdomain>` or `files.<cluster>.main-hosting.eu`).
3. Create a new account or use the auto-created one. Set its home directory to `/public_html` (or to a subdomain's root if you're deploying to `app.yourdomain.com`).
4. Save the **username** and **password**.

### 2. Add the secrets to GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
| --- | --- |
| `HOSTINGER_FTP_HOST` | e.g. `ftp.terrawatchapp.com` |
| `HOSTINGER_FTP_USER` | FTP username from step 1 |
| `HOSTINGER_FTP_PASSWORD` | FTP password from step 1 |

### 3. (Optional) Add non-secret variables

Repo → **Settings → Secrets and variables → Actions → Variables** tab:

| Variable | Default | When to override |
| --- | --- | --- |
| `HOSTINGER_FTP_PATH` | `/public_html/` | Set to `/public_html/app/` if you want the SPA at a sub-path, or `/domains/app.terrawatchapp.com/public_html/` for a subdomain. |
| `HOSTINGER_FTP_PROTOCOL` | `ftps` | Keep `ftps` unless Hostinger explicitly requires plain `ftp`. Never use plain FTP on shared networks. |
| `HOSTINGER_FTP_PORT` | `21` | Change only if Hostinger tells you to. |

### 4. Point DNS at Hostinger

If your domain isn't already on Hostinger:

- **Domain on Hostinger, hosting on Hostinger**: nothing to do. DNS is automatic.
- **Domain elsewhere**: add these records at your registrar, per hPanel → **Hosting → Details**:
  - `A` record `@` → Hostinger's shared IP shown in hPanel.
  - `CNAME` record `www` → your root domain.

Wait up to 24 h for propagation (usually ~15 min).

### 5. Trigger the first deploy

- Push anything to `main` (or the active feature branch), **or**
- GitHub → Actions → **Deploy to Hostinger** → **Run workflow**.

The job runs typecheck + tests + build, then uploads `dist/` via FTPS.

## What the workflow does

1. Checks out the branch.
2. Installs dependencies (with npm cache).
3. Runs `npm run typecheck` and `npm run test`. A failure here aborts the deploy — broken code never reaches production.
4. Runs `npm run build`.
5. Writes an `.htaccess` into `dist/` so Apache rewrites all unknown paths to `/index.html` (required for Vue Router's HTML5 history mode). Also sets cache headers and gzip.
6. Uploads `dist/` to Hostinger over FTPS. `SamKirkland/FTP-Deploy-Action` only transfers changed files, so incremental deploys are fast.

## Alternative: Hostinger's native Git integration (Business / Cloud plans)

If you'd rather let Hostinger pull from GitHub directly:

1. hPanel → **Websites → <your site> → Advanced → GIT**.
2. Click **Create new repository**, paste your GitHub HTTPS URL, pick the branch.
3. Set **Install path** to `public_html`.
4. Hostinger doesn't run `npm run build` server-side on shared plans — so in this mode you need to commit the built `dist/` to a deploy branch, or keep the GitHub Action and treat Hostinger Git as a fallback.

For this reason, **the GitHub Actions → FTP workflow above is the recommended default**, even on Business/Cloud plans, unless you move to a VPS.

## Preview / staging

If you want a staging URL (e.g. `staging.terrawatchapp.com`):

1. Create a subdomain in hPanel → **Domains → Subdomains**.
2. Add a second FTP account scoped to that subdomain's directory, and a second set of GitHub secrets (`HOSTINGER_FTP_HOST_STAGING`, etc.).
3. Duplicate the workflow as `deploy-staging.yml` on push to a `staging` branch. I can wire this when you ask for it.

## Troubleshooting

- **FTP 530 Login incorrect** → username is usually `user@yourdomain.com`, not just `user`. Re-check hPanel → Files → FTP Accounts.
- **`ENOTFOUND` on the host** → host needs to be the FTP hostname (starts with `ftp.` or `files.`), not the web domain.
- **Page loads but sub-routes 404** → `.htaccess` didn't upload. Check FTP logs in the Action; confirm `public_html/.htaccess` exists.
- **Service worker caches old build** → `vite-plugin-pwa` is set to `autoUpdate`; a hard reload clears it. If users report stale content, we can ship a small "new version available" toast; tell me and I'll add it.

## Supabase (auth + bookmarks + Ask Terra)

The app reads Supabase credentials from two build-time environment variables:

| Var | Where it lives | Visibility |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | GitHub Actions → Variables | Public (baked into the bundle) |
| `VITE_SUPABASE_ANON_KEY` | GitHub Actions → Variables | Public by design (RLS scopes it) |

Get both from Supabase → Project Settings → API. Add them under **Settings → Secrets and variables → Actions → Variables** (not Secrets — these are safe to expose).

For local dev, copy `.env.example` to `.env.local` and fill them in.

### One-time Supabase setup

1. Run the migration: `supabase/migrations/0001_auth_bookmarks_asktq.sql` — creates the `bookmarks` and `ask_terra_usage` tables with RLS. You can apply it via `supabase db push` (CLI) or by pasting the SQL into the Supabase SQL editor.
2. Enable magic-link auth: Supabase → Authentication → Providers → Email → make sure "Email link" is on. Optionally disable "Confirm email" if you want a one-tap flow.
3. Add the app's URLs to Authentication → URL Configuration:
   - Site URL: `https://terrawatchapp.com` (or wherever it ships)
   - Redirect URLs: `https://terrawatchapp.com/auth/callback` + `http://localhost:5173/auth/callback`

### Ask Terra edge function

The `supabase/functions/ask-terra/` function proxies Anthropic Claude so the API key never touches the client. It requires two secrets set **in Supabase** (not in GitHub):

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# SUPABASE_SERVICE_ROLE_KEY is set automatically by the platform.
```

Optionally tune the daily per-user limit (default 5):

```bash
supabase secrets set ASK_TERRA_DAILY_LIMIT=10
```

### Auto-deploying the edge function

The workflow `.github/workflows/deploy-edge-functions.yml` redeploys `ask-terra` whenever files under `supabase/functions/**` change. It needs two GitHub Secrets:

| Secret | How to get it |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access Tokens → Generate new token |
| `SUPABASE_PROJECT_REF` | The 20-character project ref in your project URL (`https://<ref>.supabase.co`) |

Once both secrets are set, any edit to the function file triggers a redeploy with no manual step.
