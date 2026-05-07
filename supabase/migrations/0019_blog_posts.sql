-- TerraWatch — Phase 9.8: blog posts moved from MD-files-in-repo to DB.
--
-- The Phase 9.7 design parsed posts from /content/blog/*.md at build time.
-- That design doesn't support runtime publish/hide toggles or admin edits
-- without a redeploy. With admin auth landing in this phase, we migrate to
-- a DB-backed store. The two existing posts get seeded here as the
-- migration body so /blog stays populated immediately after deploy.
--
-- RLS:
--   - Public can read posts where published = true.
--   - Admins (per is_admin() from migration 0018) can read all posts and
--     do all writes (insert/update/delete).
--   - No anonymous writes, ever.

create table if not exists public.blog_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  excerpt       text,
  body_md       text not null,
  category      text not null default 'general',
  tags          text[] not null default '{}',
  hero_image    text,                                  -- URL or relative path; used for OG meta
  published     boolean not null default false,
  author        text not null default 'DataSnake',
  published_at  timestamptz,                           -- set the first time `published` flips true
  reading_minutes integer,                             -- precomputed at write time; null = compute client-side
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists blog_posts_published_idx
  on public.blog_posts (published, published_at desc nulls last)
  where published;

create index if not exists blog_posts_category_idx
  on public.blog_posts (category);

alter table public.blog_posts enable row level security;

-- Public read for published posts ------------------------------------------
create policy "read published posts"
  on public.blog_posts
  for select
  using (published);

-- Admin read for all posts (drafts included) -------------------------------
create policy "admin reads all posts"
  on public.blog_posts
  for select
  using (public.is_admin());

-- Admin write (any operation) ----------------------------------------------
create policy "admin writes posts"
  on public.blog_posts
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Auto-set published_at the first time published flips true. Idempotent —
-- if the post is unpublished and republished later, published_at stays at
-- the original date (matches editorial intent: don't reshuffle the feed
-- when fixing a typo).
create or replace function public.blog_posts_set_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.published and (old is null or not old.published) and new.published_at is null then
    new.published_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists blog_posts_published_at on public.blog_posts;
create trigger blog_posts_published_at
  before insert or update on public.blog_posts
  for each row execute function public.blog_posts_set_published_at();

-- Seed the two existing MD posts. Bodies are inlined verbatim from
-- /content/blog/*.md so /blog renders identically post-migration. Admins
-- can edit them in-app afterwards.
insert into public.blog_posts (slug, title, excerpt, body_md, category, tags, published, author, published_at, reading_minutes)
values
(
  'why-we-built-terrawatch',
  'Why we built TerraWatch the way we did',
  'TerraWatch began as a question — not a feature list. The question was: when something hazardous happens in the world, what does a non-expert actually need to know in the next sixty seconds?',
  'TerraWatch began as a question — not a feature list. The question was: **when something hazardous happens in the world, what does a non-expert actually need to know in the next sixty seconds?**

We looked at what existed. The data was there — USGS earthquakes, NOAA weather alerts, NASA wildfire detections, GDACS humanitarian-impact bulletins, Smithsonian volcanic-activity reports. All free, all public, all sitting behind separate websites, separate authentication, separate units of measurement, separate layers of jargon. A scientist could navigate it. A traveler trying to decide whether to fly tomorrow could not.

So that''s what we set out to build. Not another data portal. A *single answer* to the question above, drawn from the same sources scientists trust, but framed for someone who doesn''t have a meteorology degree.

## Three product principles that shaped every decision

**One primary answer per viewport.** The home screen''s first fold is a single number — the safety score for where you are right now — and the one-line headline explaining it. No grid of widgets, no carousel. If we couldn''t fit the whole answer above the fold, we trimmed the answer.

**Honest about what we don''t know.** Most environmental data is incomplete most of the time. We display 0-row categories as greyed-out rather than hidden, so users see *what''s possible* alongside *what''s available right now*. When a source fails, we say so. When a forecast has uncertainty bands, we show them.

**Composable architecture, not vertical features.** Every data source plugs in through the same `DataSource<Req, Res>` interface. When DataSnake''s underwater sensor fleet comes online, it''s a configuration change — not a rewrite. The same goes for the proprietary tier we''ll layer in for the science community.

## What''s in the app today

- **Safety score** — composite of seismic, weather, space-weather, and tide signals for your current location.
- **Travel advisory** — go/no-go verdict for any destination + date window, with reasons.
- **Global events feed** — 10 ingest sources covering earthquakes, hurricanes, volcanoes, wildfires, severe weather, geomagnetic storms, air quality, and global humanitarian alerts.
- **Alerts page** — curated severe-events feed; the post-style version of Reddit''s r/NaturalDisasters, scoped to verified data.
- **Ocean monitoring** — live time-series dashboards from NOAA buoys; the architecture hook for DataSnake''s submarine telemetry.
- **Ask Terra** — Claude-powered conversational explainer for trip verdicts.

## What''s coming

Land + air monitoring dashboards next. Then push notifications for the severe-events tier. Then the Reddit/LinkedIn auto-broadcaster, so when a Mayon-class eruption happens, our community sees it before the news cycle does.

The bigger vision is DataSnake — a fleet of sensors operating in places public APIs don''t reach. TerraWatch is the lens that makes that fleet legible to people who aren''t scientists. That work is just starting.

If any of this resonates, we''d love to hear from you.',
  'vision',
  array['vision','product','datasnake'],
  true,
  'DataSnake',
  '2026-05-05'::timestamptz,
  3
),
(
  'closing-the-mayon-gap',
  'Closing the Mayon gap: how we went from one source to ten',
  'When Mayon Volcano erupted in the Philippines, our app showed nothing. Here''s the technical postmortem and the architecture that fixed it in five days.',
  'In late April, Mayon Volcano in the Philippines went into eruption. Our app showed nothing.

The cause was simple: our volcano data came from USGS HANS, which is a US-only feed. Mayon is in the Philippines. Our pipeline was structurally blind to it. Every other Philippines volcano. Every Indonesian volcano. Every typhoon that didn''t reach the US. The architecture was honest data — just not enough data.

This post is the postmortem and the fix. It''s also a study in how a small team can move from "we have a data gap" to "we have ten ingest sources" in a week without breaking anything in production.

## The diagnosis

We have one Postgres table — `public.events` — that every ingest source writes into. Categorisation comes from a single string column. The UI dropdown shows 16 categories. Of those, our four sources were emitting four leaf categories: `earthquake`, `volcano` (US only), `wildfire`, `geomagnetic_storm`. NWS alerts fanned out into another 12 categories *only when something was active in the United States*.

So during a quiet US weather day, the dropdown showed 16 options and 4 of them had data. From a user''s perspective, that''s broken.

The diagnostic SQL was direct:

```sql
select source, count(*), max(occurred_at) as latest
from public.events
group by source
order by 2 desc;
```

We had `usgs.quakes` (~300 rows), `nasa.eonet` wildfires (~50 rows), `nws.alerts` (~120 rows), `noaa.swpc.kp` (~24 rows), `usgs.volcanoes` (~5 rows). Five sources, each scoped to one piece of the world.

## The fix: integration order matters more than coverage

We had two choices. We could pick one giant source with broad coverage (say, NOAA''s GDACS feed, which aggregates global hazards) and call it done. Or we could add several focused sources, each authoritative within its domain.

We did both. **Highest-leverage source first** — GDACS is a single XML/JSON feed published by the EU''s Joint Research Centre and the UN''s OCHA. It carries earthquakes ≥M5.5, tropical cyclones, floods, tsunamis, volcanic activity, and humanitarian-impact alerts in one schema, with a Green/Orange/Red severity band. One integration filled five category gaps simultaneously.

Then we layered in domain-specific sources for the long tail GDACS misses:

- **Smithsonian Global Volcanism Program** — catches advisory-level volcanic unrest below GDACS''s Orange threshold. RSS feed, weekly cadence. Built a 75-volcano coordinate lookup so most entries pin on the map.
- **NOAA NHC** — authoritative active-storm tracker for Atlantic + East Pacific basins. JSON, no auth, updates every 6 hours during events.
- **OpenAQ** — global air-quality readings. We threshold to PM2.5 ≥55 µg/m³ (US EPA "Unhealthy") so the events feed only surfaces readings that genuinely warrant attention.

Each ingester is its own Supabase Edge Function with its own memory budget — we''d previously had a monolithic ingester that was bumping into Supabase''s per-invocation memory cap. Splitting was both a feature win and a stability win.

## The architectural payoff

All five new sources plug into the same `events` table. The same UI. The same severity model. The same retention tiers. Each was 50–200 lines of TypeScript. The longest single review was for GDACS at ~120 lines.

The Postgres + pg_cron architecture from earlier phases meant we didn''t need a separate scheduler. Each new ingester gets a new `cron.schedule(...)` row staggered by two minutes (`*/00`, `*/02`, `*/04`, …) to keep DB load even. No CI job. No external scheduler. No paid tier.

## Lessons

**Diagnose before you build.** Two queries (`group by source` and `events_category_counts`) told us exactly what we had and what we didn''t. The instinct was to "add more sources"; the diagnosis revealed which sources mattered most.

**Per-source isolation pays for itself.** The first time NWS returned a 503, NWS was the only category that went stale — every other source kept flowing. Per-function deploys mean we can fix one parser without re-running every other one.

**Honest UX beats hiding the schema.** We added a per-category row-count badge to the filter dropdown. Empty categories render greyed-out with their (0) count visible. Users see *what we cover* and *what''s flowing right now* as separate facts. Way less confusing than a dropdown of 16 options of which 4 work.

## What''s next on the data side

Land + air time-series monitoring (USGS streamflow, OpenAQ extended params, soil-moisture satellites). And eventually — the proprietary tier from DataSnake''s underwater sensor fleet. The architecture is ready. We''re just waiting on the hardware.

If you''ve ever wanted to know what''s happening at 12,000 feet under the Pacific, that''s why we''re building this.',
  'engineering',
  array['ingest','architecture','supabase','postgres'],
  true,
  'DataSnake',
  '2026-05-04'::timestamptz,
  4
)
on conflict (slug) do nothing;
