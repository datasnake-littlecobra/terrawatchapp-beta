-- TerraWatch — Phase 9.13.1: measurements provenance columns.
--
-- Adds the optional reproducibility + integrity columns described in
-- docs/DATASNAKE_SENSOR_DATA_CONTRACT.md §2.2. All new columns are
-- nullable so existing ingesters (NDBC public-tier, the synthetic
-- DataSnake seed) continue to work unchanged.
--
-- These columns become REQUIRED on writes from the DataSnake ingest
-- endpoint when it ships (Phase 9.15 / hardware go-live). Until then,
-- the synthetic seed (0028) leaves them NULL and the NDBC ingester
-- (0014) leaves them NULL.

alter table public.measurements
  add column if not exists quality_flag     text
    check (quality_flag in ('good','suspect','bad','missing')),
  add column if not exists firmware_version text,
  add column if not exists calibration_id   uuid,
  add column if not exists signature        bytea,
  add column if not exists received_at      timestamptz not null default now(),
  add column if not exists raw_payload      jsonb,
  add column if not exists location_at_observation geography(point, 4326);

-- Index supporting "latency analysis" queries — observed_at vs received_at.
-- Small index, only on rows where the lag is meaningful (received_at is
-- present and differs from observed_at by more than 60 seconds).
create index if not exists measurements_received_idx
  on public.measurements (received_at desc);

comment on column public.measurements.quality_flag     is 'Sensor-side QC: good | suspect | bad | missing. Phase 9.13.1.';
comment on column public.measurements.firmware_version is 'Denormalized from sensors.metadata.firmware_version at observation time. Phase 9.13.1.';
comment on column public.measurements.calibration_id   is 'FK to sensor_calibrations row active at observation time. Phase 9.13.1.';
comment on column public.measurements.signature        is 'ed25519 over the canonical row, signed by the sensor hardware key. Phase 9.13.1.';
comment on column public.measurements.received_at      is 'Server-set ingest timestamp. Differs from observed_at when uplink was offline. Phase 9.13.1.';
comment on column public.measurements.raw_payload      is 'Full uplink packet pre-parse, for software-team back-compute. Phase 9.13.1.';
comment on column public.measurements.location_at_observation is 'Location at observation time for drifter sensors. NULL for fixed-position. Phase 9.13.1.';
