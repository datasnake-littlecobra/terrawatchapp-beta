-- TerraWatch — Phase 9.13.1: sensor deployment + calibration history.
--
-- Append-only tables. Once a row is inserted it's never deleted —
-- past deployments and past calibrations must remain readable
-- forever so any historical measurement is reproducible exactly.
--
-- See docs/DATASNAKE_SENSOR_DATA_CONTRACT.md §2.3 and §2.4.

-- =====================================================================
-- 1. sensor_deployments — every move/redeploy
-- =====================================================================

create table if not exists public.sensor_deployments (
  id            uuid primary key default gen_random_uuid(),
  sensor_id     text not null references public.sensors on delete cascade,
  deployed_at   timestamptz not null,
  removed_at    timestamptz,
  location      geography(point, 4326),
  depth_m       double precision,            -- ocean only
  height_m_agl  double precision,            -- ground only
  operator_id   text,
  notes         text,
  created_at    timestamptz not null default now(),
  check (removed_at is null or removed_at >= deployed_at),
  check (
    -- Exactly one of depth_m, height_m_agl, or both NULL (e.g. fixed
    -- on a tower without a strict height-AGL).
    (depth_m is null or height_m_agl is null)
  )
);

create index if not exists sensor_deployments_sensor_idx
  on public.sensor_deployments (sensor_id, deployed_at desc);
create index if not exists sensor_deployments_active_idx
  on public.sensor_deployments (sensor_id) where removed_at is null;

alter table public.sensor_deployments enable row level security;
drop policy if exists "deployments readable by everyone" on public.sensor_deployments;
create policy "deployments readable by everyone"
  on public.sensor_deployments for select to anon, authenticated using (true);

comment on table public.sensor_deployments is
  'Append-only history of every deployment/move/redeploy of a sensor. Lets us reconstruct exactly where a sensor was at any past observation time.';

-- =====================================================================
-- 2. sensor_calibrations — every calibration applied
-- =====================================================================

create table if not exists public.sensor_calibrations (
  id          uuid primary key default gen_random_uuid(),
  sensor_id   text not null references public.sensors on delete cascade,
  applied_at  timestamptz not null,
  retired_at  timestamptz,
  constants   jsonb not null,                -- calibration coefficients
  protocol    text,                          -- reference to procedure doc
  operator_id text,
  notes       text,
  created_at  timestamptz not null default now(),
  check (retired_at is null or retired_at >= applied_at)
);

create index if not exists sensor_calibrations_sensor_idx
  on public.sensor_calibrations (sensor_id, applied_at desc);
create index if not exists sensor_calibrations_active_idx
  on public.sensor_calibrations (sensor_id) where retired_at is null;

alter table public.sensor_calibrations enable row level security;
drop policy if exists "calibrations readable by everyone" on public.sensor_calibrations;
create policy "calibrations readable by everyone"
  on public.sensor_calibrations for select to anon, authenticated using (true);

comment on table public.sensor_calibrations is
  'Append-only history of every calibration applied to a sensor. Required to reproduce any past measurement exactly. Phase 9.13.1.';

-- Now that the table exists, retroactively wire the FK on
-- measurements.calibration_id (added in migration 0030 without a FK so
-- it could ship independently). Use a deferred constraint name so the
-- ALTER is idempotent.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'measurements_calibration_id_fkey'
      and conrelid = 'public.measurements'::regclass
  ) then
    alter table public.measurements
      add constraint measurements_calibration_id_fkey
      foreign key (calibration_id) references public.sensor_calibrations(id);
  end if;
end $$;
