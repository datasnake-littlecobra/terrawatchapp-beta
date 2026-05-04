# TerraWatch Data Sources Catalog

A working catalog of natural-hazard / environmental data feeds, organized by
the 16 categories that drive TerraWatch's UI dropdown. Built for hands-on API
exploration — every source has a copy-paste-ready URL for Postman or `curl`.

> **Status legend**
> - ✅ Live in production
> - 🟡 Recommended next (high priority — fills a known gap)
> - 🔵 Considered (niche / lower priority)
> - ⚫ Not recommended (paid, restricted, or poor signal-to-noise)

> **Coverage legend**: 🌍 Global · 🇺🇸 US-only · 🌐 Multi-region

---

## Currently live (5 ingesters)

| ID | Provider | Coverage | Auth | Categories filled |
|---|---|---|---|---|
| `usgs.quakes` | USGS Earthquake Hazards | 🌍 | None | earthquake, tsunami (flag) |
| `nws.alerts` | NOAA / NWS | 🇺🇸 | User-Agent | tornado, flood, storm, winter_storm, heat, wildfire, fire_weather, marine, wind, avalanche, air_quality, weather_alert |
| `noaa.swpc.kp` | NOAA Space Weather | 🌍 | None | geomagnetic_storm |
| `usgs.volcanoes` | USGS HANS | 🇺🇸 | None | volcano |
| `nasa.eonet` | NASA EONET | 🌍 | None | wildfire |

**Gaps this leaves**: global volcanoes (Mayon-class events outside US), global
hurricanes/cyclones (W. Pacific, Indian Ocean), global floods, global
earthquakes M<2.5, dedicated air-quality, and any non-US severe weather.

---

## Global multi-hazard aggregators (one feed → many categories)

These are the highest-leverage additions because a single integration fills
multiple category gaps at once.

### 🟡 GDACS — Global Disaster Alert and Coordination System

UN/EU-backed, free, no key. Single feed for global earthquakes M5.5+,
tropical cyclones, floods, droughts, and volcanoes with severity scores
(Green / Orange / Red).

- **Endpoint (RSS)**: `https://www.gdacs.org/xml/rss.xml`
- **Endpoint (JSON)**: `https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?fromDate=2026-04-01&alertlevel=Orange;Red`
- **Auth**: None
- **Format**: RSS / GeoJSON / JSON
- **Update**: ~15 min during active events
- **Maps to**: earthquake (M5.5+), volcano (global), tsunami, hurricane, flood
- **Severity mapping**: Red → `danger`, Orange → `caution`, Green → `safe`
- **Postman**: GET request, no headers needed

### 🔵 ReliefWeb — UN OCHA disasters API

Curated humanitarian disaster reports. Heavier delay (hours, not minutes)
but excellent for written context.

- **Endpoint**: `https://api.reliefweb.int/v1/disasters?appname=terrawatch&limit=20&filter[field]=status&filter[value]=current`
- **Auth**: None (the `appname` param is courtesy attribution, not auth)
- **Format**: JSON
- **Update**: hourly
- **Maps to**: All hazard categories with human-impact narrative
- **Best use**: enrichment / Ask Terra context, not primary feed

### 🔵 Copernicus EMS — European emergency mapping

EU-funded, free. Heavier processing (post-event maps), useful for floods +
wildfires + earthquakes once damage assessment is published.

- **Endpoint**: `https://emergency.copernicus.eu/mapping/list-of-activations-rapid` (HTML — no clean JSON API; would need scraping)
- **Auth**: None
- **Format**: HTML / KML
- **Note**: ⚫ Avoid unless we want HTML scraping; their public API is limited.

---

## Earthquakes

### ✅ USGS Earthquake Hazards Program (live)

- **Endpoint**: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson`
- **Other windows**: `all_hour`, `1.0_day`, `2.5_day`, `4.5_day`, `significant_week`, `4.5_month`, `all_month`
- **Auth**: None
- **Update**: ~1 min latency
- **Coverage**: 🌍 Global

### 🟡 EMSC — European-Mediterranean Seismological Centre

Faster than USGS for Eurasian events (often beats USGS by 60–90 seconds).
Worth adding as a complement, not a replacement.

- **Endpoint**: `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=100&minmagnitude=4.0`
- **Auth**: None
- **Format**: GeoJSON
- **Coverage**: 🌍 Global, with strongest coverage 🌐 EU/Mediterranean
- **Pros**: faster Eurasia, real-time WebSocket option
- **Cons**: duplicates USGS for Americas — needs dedup logic

### 🔵 IRIS — Incorporated Research Institutions for Seismology

Research-grade. More than we need; mention only for completeness.

- **Endpoint**: `https://service.iris.edu/fdsnws/event/1/query?format=text&minmag=4&limit=50`
- **Coverage**: 🌍

---

## Volcanoes

### ✅ USGS HANS (live, US-only)

- **Endpoint**: `https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes`
- **Auth**: None
- **Coverage**: 🇺🇸 (Hawaii, Alaska, Cascades, Yellowstone)

### 🟡 Smithsonian GVP — Global Volcanism Program (FILLS THE MAYON GAP)

Authoritative global volcano database. Weekly Volcanic Activity Report
covers all currently erupting / unrest volcanoes worldwide.

- **Endpoint (KML)**: `https://volcano.si.edu/news/WeeklyVolcanoRSS.xml`
- **Endpoint (full DB)**: `https://volcano.si.edu/database/search_volcano.cfm` (HTML; better to use the `volcano.si.edu/search_volcano_results.cfm?Country=...` JSON variants)
- **Real-time JSON**: `https://volcano.si.edu/database/list_volcano_eruptions.cfm` (HTML); their official API is `https://volcano.si.edu/api/v1/volcanoes/lookup` (undocumented but works)
- **Auth**: None
- **Format**: KML / RSS / JSON
- **Coverage**: 🌍
- **This is the source for events like Mayon, Mount Etna, Sakurajima, Krakatau**

### 🔵 VAAC — Volcanic Ash Advisory Centers (9 regional, aviation-focused)

Specifically for ash plume advisories that affect airspace (which is exactly
what the Mayon Reddit post referenced).

- **Tokyo VAAC**: `https://ds.data.jma.go.jp/svd/vaac/data/`
- **Washington VAAC**: `https://www.ssd.noaa.gov/VAAC/messages.html`
- **Darwin VAAC** (Indonesia/Philippines): `http://www.bom.gov.au/aviation/volcanic-ash/`
- **Auth**: None
- **Format**: Mostly text/HTML; ICAO-formatted advisory bulletins
- **Coverage**: 🌐 9 regional VAACs cover the globe
- **Note**: Heavy parsing required. Lower priority unless aviation use-case emerges.

---

## Tsunamis

### ✅ NWS Tsunami (via `nws.alerts`)

Already covered for US coastlines through NWS alerts feed.

### 🟡 NOAA Tsunami Warning Centers (PTWC + NTWC)

Pacific Tsunami Warning Center (Hawaii) + National Tsunami Warning Center
(Alaska) cover all US-affiliated coastlines plus Pacific basin.

- **PTWC**: `https://tsunami.gov/events/xml/PAAQAtom.xml` (Atlantic) / `https://tsunami.gov/events/xml/PHEBAtom.xml` (Pacific)
- **Auth**: None
- **Format**: Atom XML
- **Coverage**: 🌐 Pacific + Atlantic basins

### 🔵 IOC Tsunami Service Provider (Indian Ocean)

- **Endpoint**: `http://itic.ioc-unesco.org/index.php?option=com_content&view=category&id=2161`
- **Note**: Mostly HTML / regional warnings via member states. Lower priority.

---

## Tornadoes

### ✅ NWS alerts (live)

Tornado warnings + watches via `nws.alerts` feed already classified by
`nwsCategory()` → `tornado`.

### 🔵 SPC — Storm Prediction Center

Outlooks (1-8 day convective outlooks) + mesoscale discussions. Predictive,
not real-time alerts.

- **Endpoint**: `https://www.spc.noaa.gov/products/outlook/day1otlk.kml`
- **Auth**: None
- **Format**: KML
- **Coverage**: 🇺🇸
- **Use case**: "Tornadoes possible tomorrow" advance notice — useful for
  Travel Advisory but not for the events feed.

---

## Hurricanes / Tropical Cyclones

### 🟡 NHC — National Hurricane Center (Atlantic + E. Pacific)

- **Endpoint (active storms)**: `https://www.nhc.noaa.gov/CurrentStorms.json`
- **Endpoint (advisories XML)**: `https://www.nhc.noaa.gov/index-at.xml`
- **Auth**: None
- **Format**: JSON / RSS
- **Coverage**: 🌐 Atlantic + East Pacific basins (where most US-impacting storms form)

### 🟡 JTWC — Joint Typhoon Warning Center (W. Pacific + Indian Ocean)

US Navy-run, covers basins NHC doesn't. This is where typhoons hitting
Philippines / Japan / Vietnam are tracked.

- **Endpoint**: `https://www.metoc.navy.mil/jtwc/products/jtwc.json` (sometimes; format varies)
- **Endpoint (RSS)**: `https://www.metoc.navy.mil/jtwc/rss/jtwc.rss?west_pac`
- **Auth**: None
- **Format**: RSS / KMZ
- **Coverage**: 🌐 W. Pacific, Indian Ocean, S. Pacific
- **Note**: Government-run, occasional outages.

### 🔵 BoM (Australia), JMA (Japan), CMA (China)

Regional met agencies for cyclones in their basins. GDACS aggregates these
upstream — start with GDACS, integrate direct only if needed.

---

## Floods

### ✅ NWS flood alerts (live, US)

Via `nws.alerts` → `flood` category.

### 🟡 GloFAS — Global Flood Awareness System (Copernicus)

JRC + ECMWF-run global flood forecasting model. 30-day forecast horizon.

- **Endpoint**: `https://cds.climate.copernicus.eu/api/v2/resources/cems-glofas-forecast` (CDS API)
- **Auth**: Free Copernicus account + API key (UID + key in `~/.cdsapirc`)
- **Format**: GRIB / NetCDF (heavy — needs preprocessing)
- **Coverage**: 🌍
- **Note**: Format is scientific — would need a worker to convert to JSON events. Higher complexity.

### 🔵 Dartmouth Flood Observatory

Curated current-flood archive, more research-grade than alerting.

- **Endpoint**: `https://floodobservatory.colorado.edu/Events/Active/CurrentArchive.htm`
- **Coverage**: 🌍
- **Note**: HTML; no clean API.

### 🔵 USGS WaterNow (streamflow)

Real-time river gauge readings. Useful for "is this river flooding right
now" but not a curated event feed.

- **Endpoint**: `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=01646500&parameterCd=00060`
- **Coverage**: 🇺🇸

---

## Wildfires

### ✅ NASA EONET (live)

- **Endpoint**: `https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&days=7&status=open&limit=200`
- **Auth**: None
- **Coverage**: 🌍 (curated — only "newsworthy" fires, ~50–200 active globally)

### 🟡 NASA FIRMS — Fire Information for Resource Management (raw detections)

Pixel-level satellite detections from VIIRS + MODIS. ~20-50k detections
globally per day — too noisy as a feed but excellent for **map heatmaps** and
imagery layers.

- **Endpoint (CSV)**: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/VIIRS_SNPP_NRT/world/1`
- **Auth**: Free MAP_KEY (register at firms.modaps.eosdis.nasa.gov/api/map_key)
- **Format**: CSV (simple parse)
- **Coverage**: 🌍
- **Use**: Map overlay layer, not events table (we already tried; see Phase 9.0.1)

### 🟡 NIFC — National Interagency Fire Center (US incidents)

Authoritative US wildfire incident database with size, containment, evac.

- **Endpoint**: `https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query?where=1%3D1&outFields=*&f=json`
- **Auth**: None
- **Format**: ArcGIS GeoJSON-ish
- **Coverage**: 🇺🇸
- **Pros**: Has acreage, containment %, evacuation status — much richer than EONET

### 🔵 EFFIS — European Forest Fire Information System

- **Endpoint**: `https://maps.effis.emergency.copernicus.eu/gwis` (GeoServer WMS/WFS)
- **Coverage**: 🇪🇺
- **Note**: WFS format; preprocessing required.

---

## Severe Weather (Storms / Winter / Heat / Marine / Wind / Fire weather)

### ✅ NWS alerts (live, US-only via `nws.alerts`)

All these subcategories already classified via `nwsCategory()`.

### 🟡 Open-Meteo Weather Alerts (global non-NWS coverage)

Free, generous limits, no key. Wraps national met-services worldwide.

- **Endpoint**: `https://api.open-meteo.com/v1/forecast?latitude=14.06&longitude=121.06&current_weather=true`
- **Alerts variant**: `https://api.open-meteo.com/v1/warnings?latitude=14&longitude=121` (in beta)
- **Auth**: None (1k req/day free)
- **Format**: JSON
- **Coverage**: 🌍

### 🔵 ECMWF Open Data

European Centre for Medium-Range Weather Forecasts — global model output.

- **Endpoint**: `https://data.ecmwf.int/forecasts/`
- **Format**: GRIB2 (heavy)
- **Note**: Better as a model backend than an events feed.

---

## Geomagnetic / Space weather

### ✅ NOAA SWPC Kp index (live)

- **Endpoint**: `https://services.swpc.noaa.gov/json/planetary_k_index_1m.json`

### 🟡 NOAA SWPC Alerts API (storm-level events, not just Kp values)

Issued G1-G5 storm alerts, S1-S5 radiation events, R1-R5 radio blackouts.
Higher signal than raw Kp readings.

- **Endpoint**: `https://services.swpc.noaa.gov/products/alerts.json`
- **Auth**: None
- **Format**: JSON array of alert messages
- **Coverage**: 🌍

### 🔵 NASA DONKI — Database of Notifications, Knowledge, Information

Coronal mass ejections, solar flares, geomagnetic storms with predicted
arrival times.

- **Endpoint**: `https://api.nasa.gov/DONKI/notifications?startDate=2026-04-01&endDate=2026-05-04&type=all&api_key=DEMO_KEY`
- **Auth**: Free NASA API key (or DEMO_KEY for testing)
- **Format**: JSON
- **Coverage**: 🌍

### 🔵 Aurora Forecast (NOAA OVATION)

Real-time aurora oval prediction — useful for "go look up tonight" cards.

- **Endpoint**: `https://services.swpc.noaa.gov/json/ovation_aurora_latest.json`
- **Coverage**: 🌍

---

## Air Quality

### 🟡 OpenAQ — Open Air Quality (global)

Aggregates 100+ national air-quality networks worldwide. Free, generous
limits.

- **Endpoint**: `https://api.openaq.org/v2/latest?limit=100&parameter=pm25`
- **Auth**: None (rate-limited; API key optional for higher limits)
- **Format**: JSON
- **Coverage**: 🌍

### 🟡 EPA AirNow (US authoritative)

- **Endpoint**: `https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=90210&API_KEY={KEY}`
- **Auth**: Free API key
- **Format**: JSON
- **Coverage**: 🇺🇸

### 🔵 Copernicus CAMS — Atmosphere Monitoring Service

Global atmospheric composition forecasts (PM2.5, ozone, NO2, dust, smoke).

- **Endpoint**: CDS API (same auth pattern as GloFAS)
- **Coverage**: 🌍
- **Format**: NetCDF / GRIB (heavy)

### 🔵 World Air Quality Index (WAQI)

Public real-time AQI tile server.

- **Endpoint**: `https://api.waqi.info/feed/here/?token={TOKEN}`
- **Auth**: Free token
- **Format**: JSON

---

## Avalanche

Avalanche data is fragmented — no global feed exists. Each major mountain
country has its own forecasting authority.

### 🔵 Avalanche Canada

- **Endpoint**: `https://api.avalanche.ca/forecasts/v2/forecasts`
- **Auth**: None
- **Coverage**: 🇨🇦

### 🔵 USDA Forest Service Avalanche Centers (US, regional)

- ~20 regional centers (Northwest, Sierra, Colorado, Utah, etc.). No
  unified API; would need to integrate per-center.
- Examples: `https://nwac.us/avalanche-forecast/`, `https://www.cnfaic.org/`
- **Format**: HTML (scraping required)

### 🔵 EAWS — European Avalanche Warning Services

- **Endpoint**: `https://www.avalanches.org/wp-json/eaws/v1/regions`
- **Coverage**: 🌐 Alps, Pyrenees, Carpathians, Scandinavia

**Recommendation**: Defer. Avalanche category will stay sparse unless we
commit to a specific region.

---

## Imagery sources (for social cards / event detail enrichment)

The user asked: "is there a repo that gathers photos too?" Short answer: no
single source aggregates event photos. The cleanest pattern is
**generated imagery** (satellite snapshot of the event area + overlay).

### 🟡 NASA Worldview Snapshot API

Generate a JPEG of any bounding box at any date with selectable layers
(MODIS true-color, VIIRS, fire detections, etc.).

- **Endpoint**: `https://wvs.earthdata.nasa.gov/api/v1/snapshot?REQUEST=GetSnapshot&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&FORMAT=image/jpeg&BBOX=10,120,18,128&CRS=EPSG:4326&TIME=2026-05-04&WIDTH=512&HEIGHT=512`
- **Auth**: None
- **Format**: JPEG / PNG
- **Use case**: wildfire / volcano / hurricane backgrounds for social cards

### 🟡 NOAA GOES Imagery (Western Hemisphere)

Real-time geostationary satellite imagery (GOES-East, GOES-West).

- **Endpoint**: `https://cdn.star.nesdis.noaa.gov/GOES16/ABI/SECTOR/conus/GEOCOLOR/latest.jpg`
- **Auth**: None
- **Coverage**: 🌐 Americas

### 🟡 Himawari-8 / 9 (Asia-Pacific)

Geostationary imagery covering Asia-Pacific — would have shown Mayon's ash
plume in real time.

- **Endpoint**: `https://www.data.jma.go.jp/mscweb/data/himawari/sat_img.php?area=fd_`
- **Coverage**: 🌐 Asia-Pacific

### 🔵 Sentinel Hub / Copernicus

Higher-resolution but rate-limited free tier.

- **Endpoint**: `https://services.sentinel-hub.com/api/v1/process` (POST with JSON request)
- **Auth**: Free OAuth token (rate-limited)

### 🟡 Static map services (for non-imagery events like earthquakes)

For events without satellite-visible signatures, use a static map with the
location pinned.

- **Mapbox Static**: `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-l+f44({lon},{lat})/{lon},{lat},6,0/600x400@2x?access_token={TOKEN}` (free up to 50k req/mo)
- **MapTiler Static**: `https://api.maptiler.com/maps/streets/static/{lon},{lat},6/600x400.png?key={KEY}`
- **OpenStreetMap (no key)**: `https://staticmap.openstreetmap.de/staticmap.php?center={lat},{lon}&zoom=6&size=600x400&markers={lat},{lon},red-pushpin`

---

## Recommended integration order

This is sequenced by **impact-per-day-of-work** for closing the empty-category problem:

1. **GDACS** — single feed, fills global earthquake (M5.5+) + cyclone + flood + volcano + tsunami in one shot. ~half day.
2. **Smithsonian GVP** — closes the Mayon-class global volcano gap. ~half day.
3. **NHC + JTWC** — accurate hurricane tracks (vs GDACS's coarser severity bands). ~1 day.
4. **OpenAQ** — populates the air_quality category that's currently empty. ~half day.
5. **Open-Meteo Warnings (beta)** — global non-NWS severe weather. ~half day.
6. **EMSC** — faster Eurasia earthquakes (complement, not replacement). ~half day.
7. **NASA SWPC Alerts** — upgrade space weather from raw Kp values to named storm events. ~2 hours.
8. **NIFC** — richer US wildfire data (acreage, containment). ~half day.
9. **NASA Worldview Snapshot** — imagery for social broadcast cards. ~half day (no ingest, called on-demand).

That's ~5 days of focused work to roughly **double the live source count and
fill the empty-category gap to near-zero**.

---

## How to test in Postman

1. Open Postman → New Collection → "TerraWatch Sources"
2. Per source above: New Request → paste the endpoint URL → no auth (most are
   keyless) → Send. The free ones are designed for direct browser GET.
3. For sources that need a key:
   - **NASA FIRMS**: free key from firms.modaps.eosdis.nasa.gov/api/map_key
   - **NASA DONKI**: free key from api.nasa.gov (or use `DEMO_KEY` for testing)
   - **Mapbox**: free token at account.mapbox.com (up to 50k req/mo)
   - **OpenAQ**: optional key at explore.openaq.org/register
   - **AirNow**: free key at docs.airnowapi.org
4. **Required header for NWS**: `User-Agent: terrawatch (you@example.com)` —
   NWS rejects requests without one. We saw this in Phase 8.2.

---

## Notes on what we deliberately skipped

- **X (Twitter) firehose / search** — paid, $200/mo Basic tier, treated as
  output channel only.
- **Planet Labs / Maxar** — commercial high-res imagery, $$$, overkill for
  beta.
- **GBIF, iNaturalist** — biodiversity / species data, off-topic.
- **CMEMS (Copernicus Marine)** — ocean data, defer until ocean-monitoring
  feature ships.
- **Lightning networks (Blitzortung, Vaisala)** — interesting but high
  noise; would need its own viz to be useful.
- **EarthquakeTrack / Volcano Discovery** — derivative aggregators of the
  primary sources we already use.

---

_Last updated: 2026-05-04 — branch `claude/terrawatch-redesign-dMM0l`._
