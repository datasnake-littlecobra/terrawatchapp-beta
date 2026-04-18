# TerraWatch

Environmental intelligence for where you are and where you're going — the consumer-facing app for [DataSnake](https://datasnake.io).

TerraWatch answers three questions:

1. **Am I safe here right now?** — a personalized safety score combining seismic, weather, and space-weather data.
2. **What's happening near me?** — an explore map of recent quakes and current conditions.
3. **What should I do?** — actionable guidance and a travel advisory that gives a go / caution / reconsider verdict for a destination and date.

## Stack

- Vue 3 + Vite + TypeScript + Pinia + Vue Router
- Tailwind CSS with dark-first design tokens
- MapLibre GL for maps
- Capacitor for Android + iOS wrappers
- PWA via `vite-plugin-pwa`
- Vitest for unit tests

## Data sources

- [USGS Earthquake API](https://earthquake.usgs.gov/fdsnws/event/1/) — seismic activity
- [Open-Meteo](https://open-meteo.com) — weather forecast + geocoding
- [NOAA SWPC](https://www.swpc.noaa.gov) — planetary K-index (space weather)
- [NOAA Tides and Currents](https://tidesandcurrents.noaa.gov) — coastal tide predictions

## Getting started

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run typecheck   # vue-tsc
npm run test        # vitest
npm run lint        # eslint
npm run build       # production build
npx cap sync        # sync native Android/iOS projects
```

## Project layout

```
src/
  app/          router, root layout, global styles
  features/
    home/       three-tier home screen
    safety/     safety score hero (tier 1)
    explore/    map preview + full explore map (tier 2)
    guidance/   guidance cards, alerts, settings (tier 3)
    travel/     travel advisory form + verdict
    fundraiser/ DataSnake support card and about page
  services/     typed API clients + fetchWithCache helper
  stores/       Pinia stores (location, preferences, safety, travel)
  ui/           Button, Card, AlertPill, Gauge, Stat, BottomNav
  lib/          scoring engine, geo math, date helpers
  i18n/         en.ts — all user-visible copy
tests/          Vitest specs
```

## Design tokens

Palette and typography live in `tailwind.config.ts`. The app is dark-first — deep navy surfaces, a single sky-blue accent, and a reserved traffic-light semantic system (`safe` / `caution` / `danger`) used sparingly.
