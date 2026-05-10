---
title: "Why we built TerraWatch the way we did"
slug: why-we-built-terrawatch
date: 2026-05-05
excerpt: "TerraWatch began as a question — not a feature list. The question was: when something hazardous happens in the world, what does a non-expert actually need to know in the next sixty seconds?"
author: "DataSnake"
category: "vision"
tags: [vision, product, datasnake]
---

TerraWatch began as a question — not a feature list. The question was: **when something hazardous happens in the world, what does a non-expert actually need to know in the next sixty seconds?**

We looked at what existed. The data was there — USGS earthquakes, NOAA weather alerts, NASA wildfire detections, GDACS humanitarian-impact bulletins, Smithsonian volcanic-activity reports. All free, all public, all sitting behind separate websites, separate authentication, separate units of measurement, separate layers of jargon. A scientist could navigate it. A traveler trying to decide whether to fly tomorrow could not.

So that's what we set out to build. Not another data portal. A *single answer* to the question above, drawn from the same sources scientists trust, but framed for someone who doesn't have a meteorology degree.

## Three product principles that shaped every decision

**One primary answer per viewport.** The home screen's first fold is a single number — the safety score for where you are right now — and the one-line headline explaining it. No grid of widgets, no carousel. If we couldn't fit the whole answer above the fold, we trimmed the answer.

**Honest about what we don't know.** Most environmental data is incomplete most of the time. We display 0-row categories as greyed-out rather than hidden, so users see *what's possible* alongside *what's available right now*. When a source fails, we say so. When a forecast has uncertainty bands, we show them.

**Composable architecture, not vertical features.** Every data source plugs in through the same `DataSource<Req, Res>` interface. When DataSnake's underwater sensor fleet comes online, it's a configuration change — not a rewrite. The same goes for the proprietary tier we'll layer in for the science community.

## What's in the app today

- **Safety score** — composite of seismic, weather, space-weather, and tide signals for your current location.
- **Travel advisory** — go/no-go verdict for any destination + date window, with reasons.
- **Global events feed** — 10 ingest sources covering earthquakes, hurricanes, volcanoes, wildfires, severe weather, geomagnetic storms, air quality, and global humanitarian alerts.
- **Alerts page** — curated severe-events feed; the post-style version of Reddit's r/NaturalDisasters, scoped to verified data.
- **Ocean monitoring** — live time-series dashboards from NOAA buoys; the architecture hook for DataSnake's submarine telemetry.
- **Ask Terra** — Claude-powered conversational explainer for trip verdicts.

## What's coming

Land + air monitoring dashboards next. Then push notifications for the severe-events tier. Then the Reddit/LinkedIn auto-broadcaster, so when a Mayon-class eruption happens, our community sees it before the news cycle does.

The bigger vision is DataSnake — a fleet of sensors operating in places public APIs don't reach. TerraWatch is the lens that makes that fleet legible to people who aren't scientists. That work is just starting.

If any of this resonates, we'd love to hear from you.
