# DataSnake Sensor Data Contract

**Status:** v1 — Phase 9.13.1
**Audience:** DataSnake hardware engineering team + TerraWatch / Vultr Postgres software team
**Cross-reference:** `supabase/migrations/0014_measurements.sql` (TerraWatch schema), `src/services/sensorPipeline.ts`, `src/data/insurance-explainers.ts`

## Why this doc exists

DataSnake's commercial story has three layers stacked on top of each
other: a hardware fleet, a software ingest + analytics layer, and a
buyer-facing product surface (the Risk API, the parametric trigger
engine, the underwriting dashboards). The cleanest interface between
those layers is a written data contract — what fields the hardware
team must send for every measurement, what the software team commits
to in exchange, and what controlled vocabulary both sides agree on.

This doc is the single source of truth for that interface. It is
intentionally backwards-compatible: the TerraWatch `sensors` +
`measurements` schema (Phase 9.6, already shipped) is a strict
subset of what's described here, so existing rows keep working
unchanged. New columns are optional (nullable) so the NDBC ingester
keeps writing without any code change.

The same contract applies to the DataSnake-managed Vultr Postgres
database that the existing `datasnake.io/datapreview` site reads
from. Both databases follow the same vocabulary, the same long-
format table shape, and the same provenance columns — so when a
sensor uplink reaches either ingest, the row shape is identical.

---

## 1. Transport — how a sensor reaches the database

```
[Sensor unit, e.g. ds:sub:ocean:001]
    │ firmware buffers readings; signs each batch with the sensor's ed25519 hardware key
    ▼
[Uplink medium]                       (whichever the sensor variant uses)
    ├─ Iridium SBD                    (deep-ocean / no LTE)
    ├─ LoRaWAN gateway → cell         (coastal / urban)
    └─ Cellular LTE-M direct          (ground met / air quality)
    ▼
[Ground / sat broker]
    ▼
[DataSnake ingest API — HTTP POST]    (sensor uplinks batch into HTTPS)
    │ validates signature against sensors.metadata.public_key
    │ validates sensor_id exists + active
    │ runs server-side QC (range, spike, frozen-value)
    │ writes to public.measurements
    ▼
[public.measurements_hourly]          (materialized rollup, 30-min refresh)
    ▼
[Analytics: Risk API, parametric triggers, /insurance/* dashboards]
```

The contract between hardware and software is **HTTP, not raw MQTT**.
If the hardware team has a gateway that speaks MQTT, the gateway
batches and POSTs to our HTTPS endpoint. This decouples the firmware
release schedule from the ingest deployment schedule.

---

## 2. Tables — what the database stores

Four tables, all `long-format` (one row per measurement-per-parameter
rather than wide tables with 50 columns each). Long format is
deliberately additive: a new parameter is a new row value, never a
new column. No schema migration needed when the hardware team adds a
sensor variant.

### 2.1 `public.sensors` — identity, position, lifecycle

**One row per deployed unit.** Stable for the lifetime of the unit;
move/redeploy events go into `sensor_deployments` (history).

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | text PK | yes | Stable string, never reused. Recommended pattern: `ds:<variant>:<seq>`, e.g. `ds:sub:ocean:001`. |
| `source` | text | yes | `'datasnake'` for DataSnake hardware. `'ndbc'`, `'usgs'`, etc. for public mirrors. |
| `source_tier` | text | yes | `'public'` or `'proprietary'`. Gates the higher-tier API + RLS policies. |
| `domain` | text | yes | `'ocean'`, `'land'`, or `'air'`. Drives which dashboards consume the data. |
| `name` | text | yes | Human-readable, e.g. `"DataSnake Sub — Biscayne Bay"`. Shown in UI. |
| `location` | `geography(point, 4326)` | yes (fixed) / no (drifters) | WGS84 lat/lon. For drifters, location lives on each measurement instead. |
| `metadata` | jsonb | yes | See §2.1.1 below — strongly-typed sub-keys go here, not as top-level columns. |
| `active` | boolean | yes | Default true. False = decommissioned. |
| `created_at` | timestamptz | yes | Default `now()`. |

#### 2.1.1 `sensors.metadata` recommended sub-keys

These are conventions, not enforced columns. Hardware ships them as
top-level keys inside `metadata`. The Edge Function ingest validates
on insert; SQL analytics read them via `metadata->>'key'` casts.

```jsonc
{
  "variant":             "ds-sub-ocean-v2",          // freeform variant string
  "hardware_revision":   "rev-c",
  "firmware_version":    "v2.4.1",
  "public_key":          "ed25519:base64...",        // for signature validation
  "deployed_at":         "2026-03-12T00:00:00Z",
  "deployed_by":         "operator-id-or-name",
  "depth_m":             18,                          // OCEAN only — fixed deployment depth
  "height_m_agl":        2.5,                         // GROUND only — sensor height above ground
  "battery_chemistry":   "li-ion",                    // operational
  "uplink":              "iridium-sbd"                // 'iridium-sbd' | 'lorawan' | 'lte-m'
}
```

### 2.2 `public.measurements` — the high-frequency time-series

**One row per (sensor, parameter, observation time).** Composite PK
gives idempotent upserts. This is the hot table.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `sensor_id` | text FK → `sensors.id` | yes | |
| `parameter` | text | yes | From the controlled vocabulary in §3. Long format — never a wide column per param. |
| `value` | double precision | yes | Always in the SI base unit declared for the parameter. |
| `unit` | text | yes | Redundant with `parameter` but stored anyway, because units drift across firmware revs and SQL must be able to re-validate. |
| `observed_at` | timestamptz UTC | yes | When the **sensor** measured. Hardware-set. |
| `quality_flag` | text | recommended | `'good'` / `'suspect'` / `'bad'` / `'missing'`. Sensor-side QC. |
| `firmware_version` | text | recommended | Denormalized from the sensor row — needed because firmware changes mid-deployment. |
| `calibration_id` | uuid FK → `sensor_calibrations.id` | recommended | Pointer to the calibration constants active at observation time. |
| `signature` | bytea | recommended (required for paid parametric) | ed25519 over the canonical row. Validated against `sensors.metadata.public_key`. |
| `received_at` | timestamptz | yes (server-set) | When the ingest accepted the row. Different from `observed_at` when offline → store-and-forward. |
| `raw_payload` | jsonb | optional | Full uplink packet pre-parse. Lets the software team back-compute if the parser had a bug. |
| `location_at_observation` | `geography(point, 4326)` | required for drifters | For mobile/drifter sensors only. Fixed-position sensors use `sensors.location`. |

**Composite primary key:** `(sensor_id, parameter, observed_at)`.

**Indexes (already in place):**
- `measurements_param_observed_idx`  on `(parameter, observed_at desc)`
- `measurements_sensor_observed_idx` on `(sensor_id, observed_at desc)`

### 2.3 `public.sensor_deployments` — every move/redeploy

Append-only history. Lets us reconstruct exactly where a sensor was
at any past observation time.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `sensor_id` | text FK → `sensors.id` | |
| `deployed_at` | timestamptz | |
| `removed_at` | timestamptz nullable | NULL = current deployment |
| `location` | `geography(point, 4326)` | |
| `depth_m` | double precision nullable | ocean only |
| `height_m_agl` | double precision nullable | ground only |
| `operator_id` | text | field-team operator |
| `notes` | text nullable | |
| `created_at` | timestamptz | default now() |

### 2.4 `public.sensor_calibrations` — every calibration applied

Append-only history. Required to reproduce any past measurement
exactly. Re-calibrating a sensor doesn't delete the previous row.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `sensor_id` | text FK → `sensors.id` | |
| `applied_at` | timestamptz | |
| `retired_at` | timestamptz nullable | NULL = currently active |
| `constants` | jsonb | calibration coefficients (slope, offset, lookup tables, etc.) |
| `protocol` | text | reference to calibration procedure, e.g. `"sub-pressure-v2-protocol-2026-03"` |
| `operator_id` | text | who calibrated |
| `notes` | text nullable | |

---

## 3. Controlled parameter vocabulary

The hardware team and software team **co-own** this list. Adding a
new parameter is a docs PR + a 7-day notice period before hardware
can start writing it. Removing a parameter is a 90-day deprecation.

Parameters are grouped by sensor *variant*. A single sensor unit may
straddle two variants (e.g. a multi-sensor ground node that reports
both met and air-quality). In that case the unit writes both
vocabularies under one `sensor_id`.

### 3.1 Ocean — `ds-sub-ocean`

Ranked by insurance utility. Hardware should ship the top 5 by
default; the rest as the sensor capability grows.

| # | Parameter | Unit | Insurance use case |
| --- | --- | --- | --- |
| 1 | `wave_height_m` | m | Storm-surge proxy → parametric triggers. |
| 2 | `sea_temperature_c` | °C | Hurricane genesis indicator (NHC threshold 26.5°C). |
| 3 | `pressure_dbar` | dbar | Storm depth + tide. Absolute pressure; depth derived for fixed-position. |
| 4 | `salinity_psu` | psu | Freshwater intrusion → aquifer / agriculture claims. |
| 5 | `dissolved_oxygen_mgl` | mg/L | Fisheries + ecological; storm-mixing indicator. |
| 6 | `ph` | pH | Ocean acidification → coral reef → coastal protection erosion. |
| 7 | `turbidity_ntu` | NTU | Sediment flooding indicator post-storm. |
| 8 | `chlorophyll_a_ugl` | µg/L | Red tide → hospitality/tourism business-interruption. |
| 9 | `wave_period_s` | s | Surge calculation companion to wave_height. |
| 10 | `wave_dir_deg` | ° | Surge direction for parametric specificity. |
| 11 | `conductivity_msm` | mS/m | Direct measurement; salinity derived from C+T. |
| 12 | `current_speed_mps` | m/s | Drift modeling for spill insurance. |
| 13 | `current_dir_deg` | ° | Same. |

### 3.2 Ground met — `ds-ground-met`

| # | Parameter | Unit | Insurance use case |
| --- | --- | --- | --- |
| 1 | `air_temp_c` | °C | Hot-Dry-Windy (wildfire), heat-stroke health. |
| 2 | `humidity_pct` | % | HDW companion. |
| 3 | `wind_speed_mps` | m/s | Wildfire spread, structural damage. |
| 4 | `gust_mps` | m/s | Peak structural load. |
| 5 | `wind_dir_deg` | ° | Wildfire direction; structural attack angle. |
| 6 | `pressure_hpa` | hPa | Local forecast prediction. |
| 7 | `precip_mm_1h` | mm | Flood + hail accumulator. |
| 8 | `precip_rate_mmh` | mm/h | Hail intensity proxy. |
| 9 | `solar_radiation_wm2` | W/m² | Solar farm insurance; crop yield prediction. |
| 10 | `uv_index` | index | Health insurance signals. |
| 11 | `lightning_strikes_15min` | count | Fire ignition + electrical claims. |
| 12 | `visibility_km` | km | Auto insurance (fog), aviation. |

### 3.3 Ground air quality — `ds-ground-aq`

| # | Parameter | Unit | Insurance use case |
| --- | --- | --- | --- |
| 1 | `pm25_ugm3` | µg/m³ | Smoke claims, BI; EPA AQI driver. |
| 2 | `pm10_ugm3` | µg/m³ | Same. |
| 3 | `ozone_ppb` | ppb | Health; EPA AQI. |
| 4 | `no2_ppb` | ppb | Traffic-corridor health; environmental liability. |
| 5 | `co_ppm` | ppm | Industrial / urban; carbon-monoxide poisoning claims. |
| 6 | `so2_ppb` | ppb | Industrial corridor; respiratory claims. |
| 7 | `voc_ppb` | ppb | Indoor air; product liability. |
| 8 | `aqi_us` | index | Composite EPA index — computed, not raw. |

### 3.4 Ground soil — `ds-ground-soil`

| # | Parameter | Unit | Insurance use case |
| --- | --- | --- | --- |
| 1 | `soil_moisture_30cm_pct` | % | Flood index, urban tree-fall (saturated soil + wind). |
| 2 | `soil_moisture_10cm_pct` | % | Surface runoff prediction. |
| 3 | `soil_moisture_60cm_pct` | % | Aquifer recharge, deep-root crop. |
| 4 | `soil_temp_30cm_c` | °C | Agriculture frost, parametric ag policies. |
| 5 | `soil_temp_10cm_c` | °C | Germination conditions. |
| 6 | `soil_conductivity_dsm` | dS/m | Salinity intrusion in coastal ag. |
| 7 | `soil_ph` | pH | Crop-specific health. |

### 3.5 Ground fire / vegetation — `ds-ground-fire`

| # | Parameter | Unit | Insurance use case |
| --- | --- | --- | --- |
| 1 | `fuel_moisture_10hr_pct` | % | Wildfire spread rate, RMS-calibrated. |
| 2 | `fuel_moisture_100hr_pct` | % | Larger fuel class. |
| 3 | `fuel_moisture_1000hr_pct` | % | Drought-indicator class. |
| 4 | `ndvi` | index | Vegetation health for crop policies. |
| 5 | `kbdi_index` | index | Keetch-Byram Drought Index. |
| 6 | `hdw_index` | index | Hot-Dry-Windy compound score. |
| 7 | `erc_index` | index | Energy Release Component (NFDRS). |
| 8 | `heat_flux_wm2` | W/m² | Fire-front intensity. |

---

## 4. Pipeline SLAs — what the software team commits to

In exchange for the hardware team shipping the fields above, the
software team commits:

1. **Idempotent ingest.** Duplicate `(sensor_id, parameter, observed_at)` is a no-op. Hardware retries freely without coordination.
2. **At-least-once delivery semantics.** Hardware does not need to deduplicate on its side.
3. **< 60s ingest latency p95.** From request receipt to availability in `public.measurements`.
4. **< 5 min rollup latency p95.** To `public.measurements_hourly`.
5. **Replay endpoint.** `POST /functions/v1/ingest-datasnake-sensors?replay=true` accepts up to 7 days of backfill in a single batch, for post-outage recovery.
6. **Schema evolution is additive.** New parameters require a 7-day notice. Existing parameters are never removed without a 90-day deprecation window.
7. **Hot table integrity.** No bulk reads of `measurements` from anywhere except the materialized hourly rollup. Raw `measurements` is for ingest writes and per-sensor recent reads only.
8. **Calibration history is append-only.** Past calibrations are never deleted. Any historical measurement is reproducible.

---

## 5. Security, privacy, audit

- **Every measurement is signed at the sensor.** Tampering is detectable post-hoc.
- **Proprietary measurements are RLS-gated.** Anonymous role sees only `source_tier='public'`. Insurance/research dashboards using proprietary data go through service-role queries inside Edge Functions, themselves authed by API key (see Phase 9.13).
- **Sensor public keys are stored in `sensors.metadata.public_key`.** Private keys never leave the sensor hardware.
- **Calibration history is append-only.** Past calibrations are never deleted, so any historical measurement is reproducible exactly even after a re-calibration.
- **Replay endpoint is rate-limited.** Backfill is intentional, not silent.

---

## 6. Vultr Postgres / TerraWatch alignment

The DataSnake-managed Vultr Postgres database that today serves
`datasnake.io/datapreview` is moving to this same schema:

- Same `sensors` + `measurements` long-format tables.
- Same controlled parameter vocabulary (§3).
- Same provenance columns on `measurements` (§2.2).
- Same `sensor_deployments` + `sensor_calibrations` history tables.

Migration steps for an existing Vultr deployment:
1. Rename the existing wide tables to `*_legacy` (preserve everything).
2. Apply the migrations described in §2.
3. Backfill `measurements` from the legacy wide table — one INSERT per (legacy_row, parameter) — using a one-shot script.
4. Verify with `select count(*) from measurements group by parameter` — count per parameter should match `count(legacy.<col>) where <col> is not null` per legacy column.
5. Cut over the FastAPI router (`datasnake-fastapi-router`) to read from the new tables; verify the existing Vue charts still render.
6. Drop `*_legacy` after a 30-day safe window.

The TerraWatch app reads from its own Supabase instance, NOT from
Vultr. Both databases follow this same contract independently — so
a Vultr → TerraWatch sync (one-way replication for selected
proprietary rows) is a 1-day software task with no schema work, if
that's ever desired.

---

## 7. Versioning

- **v1** (this doc, Phase 9.13.1) — initial contract.
- Future revisions are PRs against this file. Hardware team and
  software team approve before merge.
