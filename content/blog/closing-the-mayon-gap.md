---
title: "Closing the Mayon gap: how we went from one source to ten"
slug: closing-the-mayon-gap
date: 2026-05-04
excerpt: "When Mayon Volcano erupted in the Philippines, our app showed nothing. Here's the technical postmortem and the architecture that fixed it in five days."
author: "DataSnake"
category: "engineering"
tags: [ingest, architecture, supabase, postgres]
---

In late April, Mayon Volcano in the Philippines went into eruption. Our app showed nothing.

The cause was simple: our volcano data came from USGS HANS, which is a US-only feed. Mayon is in the Philippines. Our pipeline was structurally blind to it. Every other Philippines volcano. Every Indonesian volcano. Every typhoon that didn't reach the US. The architecture was honest data — just not enough data.

This post is the postmortem and the fix. It's also a study in how a small team can move from "we have a data gap" to "we have ten ingest sources" in a week without breaking anything in production.

## The diagnosis

We have one Postgres table — `public.events` — that every ingest source writes into. Categorisation comes from a single string column. The UI dropdown shows 16 categories. Of those, our four sources were emitting four leaf categories: `earthquake`, `volcano` (US only), `wildfire`, `geomagnetic_storm`. NWS alerts fanned out into another 12 categories *only when something was active in the United States*.

So during a quiet US weather day, the dropdown showed 16 options and 4 of them had data. From a user's perspective, that's broken.

The diagnostic SQL was direct:

```sql
select source, count(*), max(occurred_at) as latest
from public.events
group by source
order by 2 desc;
```

We had `usgs.quakes` (~300 rows), `nasa.eonet` wildfires (~50 rows), `nws.alerts` (~120 rows), `noaa.swpc.kp` (~24 rows), `usgs.volcanoes` (~5 rows). Five sources, each scoped to one piece of the world.

## The fix: integration order matters more than coverage

We had two choices. We could pick one giant source with broad coverage (say, NOAA's GDACS feed, which aggregates global hazards) and call it done. Or we could add several focused sources, each authoritative within its domain.

We did both. **Highest-leverage source first** — GDACS is a single XML/JSON feed published by the EU's Joint Research Centre and the UN's OCHA. It carries earthquakes ≥M5.5, tropical cyclones, floods, tsunamis, volcanic activity, and humanitarian-impact alerts in one schema, with a Green/Orange/Red severity band. One integration filled five category gaps simultaneously.

Then we layered in domain-specific sources for the long tail GDACS misses:

- **Smithsonian Global Volcanism Program** — catches advisory-level volcanic unrest below GDACS's Orange threshold. RSS feed, weekly cadence. Built a 75-volcano coordinate lookup so most entries pin on the map.
- **NOAA NHC** — authoritative active-storm tracker for Atlantic + East Pacific basins. JSON, no auth, updates every 6 hours during events.
- **OpenAQ** — global air-quality readings. We threshold to PM2.5 ≥55 µg/m³ (US EPA "Unhealthy") so the events feed only surfaces readings that genuinely warrant attention.

Each ingester is its own Supabase Edge Function with its own memory budget — we'd previously had a monolithic ingester that was bumping into Supabase's per-invocation memory cap. Splitting was both a feature win and a stability win.

## The architectural payoff

All five new sources plug into the same `events` table. The same UI. The same severity model. The same retention tiers. Each was 50–200 lines of TypeScript. The longest single review was for GDACS at ~120 lines.

The Postgres + pg_cron architecture from earlier phases meant we didn't need a separate scheduler. Each new ingester gets a new `cron.schedule(...)` row staggered by two minutes (`*/00`, `*/02`, `*/04`, …) to keep DB load even. No CI job. No external scheduler. No paid tier.

## Lessons

**Diagnose before you build.** Two queries (`group by source` and `events_category_counts`) told us exactly what we had and what we didn't. The instinct was to "add more sources"; the diagnosis revealed which sources mattered most.

**Per-source isolation pays for itself.** The first time NWS returned a 503, NWS was the only category that went stale — every other source kept flowing. Per-function deploys mean we can fix one parser without re-running every other one.

**Honest UX beats hiding the schema.** We added a per-category row-count badge to the filter dropdown. Empty categories render greyed-out with their (0) count visible. Users see *what we cover* and *what's flowing right now* as separate facts. Way less confusing than a dropdown of 16 options of which 4 work.

## What's next on the data side

Land + air time-series monitoring (USGS streamflow, OpenAQ extended params, soil-moisture satellites). And eventually — the proprietary tier from DataSnake's underwater sensor fleet. The architecture is ready. We're just waiting on the hardware.

If you've ever wanted to know what's happening at 12,000 feet under the Pacific, that's why we're building this.
