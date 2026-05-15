-- TerraWatch — Phase 9.13.2: DataSnake proprietary sensor seed + live cron.
--
-- Until proprietary hardware ships, the /insurance/pipeline showcase needs
-- representative data to make the "raw → transformed → business" narrative
-- work end-to-end. This migration:
--
--   1. Seeds 5 ocean + 15 ground sensors with source='datasnake',
--      source_tier='proprietary'. Locations match the existing Risk Cell
--      footprint (Miami, Houston, SF Bay, NY, Sonoma County) so the
--      Command Center map and the pipeline view tell the same story.
--
--   2. Seeds 7 days of synthetic measurements per sensor per parameter
--      with realistic daily seasonality + Gaussian noise. Each sensor gets
--      one deliberate anomaly (z-score > 3) on day-3 so the pipeline's
--      anomaly strip has something to flag in the demo.
--
--   3. Adds a 10-minute pg_cron job that appends one fresh reading per
--      sensor per parameter so the showcase feels "live" without a real
--      uplink.
--
-- All inserts use ON CONFLICT DO NOTHING so re-running the migration is
-- idempotent. Cron job is created with CREATE IF NOT EXISTS via the
-- cron.schedule wrapper.

-- =====================================================================
-- 1. Sensor catalog
-- =====================================================================

insert into public.sensors (id, source, source_tier, name, domain, location, metadata, active)
values
  -- Ocean submarine pressure / chem nodes — 5 units
  ('ds:sub:ocean:001', 'datasnake', 'proprietary', 'DataSnake Sub — Biscayne Bay',     'ocean', st_makepoint(-80.13,  25.79)::geography, jsonb_build_object('variant','ds-sub-ocean','depth_m', 18,  'firmware','v2.4.1','deployed_at','2026-03-12'), true),
  ('ds:sub:ocean:002', 'datasnake', 'proprietary', 'DataSnake Sub — Galveston Channel','ocean', st_makepoint(-94.79,  29.31)::geography, jsonb_build_object('variant','ds-sub-ocean','depth_m', 14,  'firmware','v2.4.1','deployed_at','2026-03-18'), true),
  ('ds:sub:ocean:003', 'datasnake', 'proprietary', 'DataSnake Sub — SF Bay Mouth',     'ocean', st_makepoint(-122.50, 37.81)::geography, jsonb_build_object('variant','ds-sub-ocean','depth_m', 28,  'firmware','v2.4.1','deployed_at','2026-03-22'), true),
  ('ds:sub:ocean:004', 'datasnake', 'proprietary', 'DataSnake Sub — NY Harbor',        'ocean', st_makepoint(-74.04,  40.69)::geography, jsonb_build_object('variant','ds-sub-ocean','depth_m', 21,  'firmware','v2.4.0','deployed_at','2026-04-01'), true),
  ('ds:sub:ocean:005', 'datasnake', 'proprietary', 'DataSnake Sub — Tampa Bay',        'ocean', st_makepoint(-82.55,  27.95)::geography, jsonb_build_object('variant','ds-sub-ocean','depth_m', 16,  'firmware','v2.4.1','deployed_at','2026-04-04'), true),

  -- Ground hyperlocal met / soil nodes — 15 units across the same metros
  ('ds:ground:met:001', 'datasnake', 'proprietary', 'DataSnake Ground — Miami Beach',   'land', st_makepoint(-80.13,  25.79)::geography, jsonb_build_object('variant','ds-ground-met','firmware','v1.8.2','deployed_at','2026-03-10'), true),
  ('ds:ground:met:002', 'datasnake', 'proprietary', 'DataSnake Ground — Coral Gables',  'land', st_makepoint(-80.27,  25.72)::geography, jsonb_build_object('variant','ds-ground-met','firmware','v1.8.2','deployed_at','2026-03-10'), true),
  ('ds:ground:met:003', 'datasnake', 'proprietary', 'DataSnake Ground — Downtown Houston','land', st_makepoint(-95.36,  29.76)::geography, jsonb_build_object('variant','ds-ground-met','firmware','v1.8.2','deployed_at','2026-03-15'), true),
  ('ds:ground:met:004', 'datasnake', 'proprietary', 'DataSnake Ground — Galveston',     'land', st_makepoint(-94.78,  29.30)::geography, jsonb_build_object('variant','ds-ground-met','firmware','v1.8.1','deployed_at','2026-03-18'), true),
  ('ds:ground:met:005', 'datasnake', 'proprietary', 'DataSnake Ground — Mission SF',    'land', st_makepoint(-122.42, 37.76)::geography, jsonb_build_object('variant','ds-ground-met','firmware','v1.8.2','deployed_at','2026-03-22'), true),
  ('ds:ground:met:006', 'datasnake', 'proprietary', 'DataSnake Ground — Oakland Hills', 'land', st_makepoint(-122.19, 37.82)::geography, jsonb_build_object('variant','ds-ground-met','firmware','v1.8.2','deployed_at','2026-03-22'), true),
  ('ds:ground:met:007', 'datasnake', 'proprietary', 'DataSnake Ground — Manhattan',     'land', st_makepoint(-73.97,  40.78)::geography, jsonb_build_object('variant','ds-ground-met','firmware','v1.8.2','deployed_at','2026-04-01'), true),
  ('ds:ground:met:008', 'datasnake', 'proprietary', 'DataSnake Ground — Brooklyn',      'land', st_makepoint(-73.95,  40.65)::geography, jsonb_build_object('variant','ds-ground-met','firmware','v1.8.2','deployed_at','2026-04-01'), true),
  ('ds:ground:met:009', 'datasnake', 'proprietary', 'DataSnake Ground — Tampa',         'land', st_makepoint(-82.46,  27.95)::geography, jsonb_build_object('variant','ds-ground-met','firmware','v1.8.1','deployed_at','2026-04-04'), true),
  ('ds:ground:met:010', 'datasnake', 'proprietary', 'DataSnake Ground — St. Petersburg','land', st_makepoint(-82.68,  27.77)::geography, jsonb_build_object('variant','ds-ground-met','firmware','v1.8.1','deployed_at','2026-04-04'), true),
  ('ds:ground:met:011', 'datasnake', 'proprietary', 'DataSnake Ground — Santa Rosa WUI','land', st_makepoint(-122.71, 38.44)::geography, jsonb_build_object('variant','ds-ground-met','firmware','v1.8.2','deployed_at','2026-04-08'), true),
  ('ds:ground:met:012', 'datasnake', 'proprietary', 'DataSnake Ground — Healdsburg WUI','land', st_makepoint(-122.87, 38.61)::geography, jsonb_build_object('variant','ds-ground-met','firmware','v1.8.2','deployed_at','2026-04-08'), true),
  ('ds:ground:met:013', 'datasnake', 'proprietary', 'DataSnake Ground — Sugar Land',    'land', st_makepoint(-95.63,  29.62)::geography, jsonb_build_object('variant','ds-ground-met','firmware','v1.8.2','deployed_at','2026-04-12'), true),
  ('ds:ground:met:014', 'datasnake', 'proprietary', 'DataSnake Ground — The Woodlands', 'land', st_makepoint(-95.46,  30.17)::geography, jsonb_build_object('variant','ds-ground-met','firmware','v1.8.2','deployed_at','2026-04-12'), true),
  ('ds:ground:met:015', 'datasnake', 'proprietary', 'DataSnake Ground — Sausalito',     'land', st_makepoint(-122.49, 37.86)::geography, jsonb_build_object('variant','ds-ground-met','firmware','v1.8.2','deployed_at','2026-04-15'), true)
on conflict (id) do nothing;

-- =====================================================================
-- 2. Synthetic 7-day backfill — one helper function + a single CALL
-- =====================================================================

-- Parameter spec table — keyed by sensor variant. Each entry defines the
-- baseline value, daily-seasonality amplitude, gaussian noise σ, and the
-- unit. Day-3 anomaly is added separately on top of the baseline.
create or replace function pg_temp.ds_seed_param_spec()
returns table (variant text, parameter text, unit text, baseline double precision, amplitude double precision, sigma double precision, anomaly_delta double precision)
language sql as $$
  select * from (values
    -- Ocean: ds-sub-ocean variant
    ('ds-sub-ocean', 'temperature_c',        '°C',   22.0,   1.8,   0.20,   3.5),
    ('ds-sub-ocean', 'salinity_psu',         'psu',  35.0,   0.3,   0.05,  -1.8),
    ('ds-sub-ocean', 'pressure_dbar',        'dbar', 18.5,   0.4,   0.10,   4.0),
    ('ds-sub-ocean', 'dissolved_oxygen_mgl', 'mg/L',  6.8,   0.6,   0.08,  -1.2),
    ('ds-sub-ocean', 'ph',                   'pH',    8.10,  0.05,  0.015, -0.18),

    -- Ground: ds-ground-met variant
    ('ds-ground-met', 'air_temp_c',          '°C',   22.0,   6.0,   0.40,   8.0),
    ('ds-ground-met', 'humidity_pct',        '%',    52.0,  12.0,   1.20, -18.0),
    ('ds-ground-met', 'soil_moisture_pct',   '%',    28.0,   2.5,   0.30,   9.0),
    ('ds-ground-met', 'pm25_ugm3',           'µg/m³', 9.0,   2.5,   0.40,  22.0),
    ('ds-ground-met', 'wind_speed_mps',      'm/s',   3.2,   1.6,   0.30,  11.0)
  ) as v(variant, parameter, unit, baseline, amplitude, sigma, anomaly_delta);
$$;

-- Seed 7d × 6 readings/hr (every 10 min) for every (sensor, parameter)
-- listed in the spec, with daily seasonality, gaussian noise, and one
-- anomaly point on day-3 at 14:00.
do $$
declare
  v_sensor record;
  v_param  record;
  v_ts     timestamptz;
  v_h      double precision;
  v_val    double precision;
  v_now    timestamptz := date_trunc('minute', now());
  v_anom_at timestamptz := v_now - interval '3 days' + interval '14 hours';
  v_anom_window interval := interval '30 minutes';
begin
  for v_sensor in
    select id, metadata->>'variant' as variant
    from public.sensors
    where source = 'datasnake' and source_tier = 'proprietary'
  loop
    for v_param in
      select * from pg_temp.ds_seed_param_spec() where variant = v_sensor.variant
    loop
      v_ts := v_now - interval '7 days';
      while v_ts < v_now loop
        v_h := extract(hour from v_ts) + extract(minute from v_ts) / 60.0;
        -- Daily seasonality: cosine peaking at 14:00, plus noise. The trough
        -- is at 02:00 (cosine evaluated at h = 14 → cos(0) = 1).
        v_val := v_param.baseline
               + v_param.amplitude * cos((v_h - 14.0) * pi() / 12.0)
               + (random() - 0.5) * 2 * v_param.sigma;
        -- Inject the seeded anomaly within the day-3 window
        if v_ts >= v_anom_at and v_ts < v_anom_at + v_anom_window then
          v_val := v_val + v_param.anomaly_delta;
        end if;
        insert into public.measurements (sensor_id, parameter, value, unit, observed_at)
        values (v_sensor.id, v_param.parameter, round(v_val::numeric, 3)::double precision, v_param.unit, v_ts)
        on conflict (sensor_id, parameter, observed_at) do nothing;
        v_ts := v_ts + interval '10 minutes';
      end loop;
    end loop;
  end loop;

  -- Refresh the hourly rollup so the chart loads at /insurance/pipeline
  -- pick up the seeded data on first paint.
  refresh materialized view concurrently public.measurements_hourly;
end $$;

-- =====================================================================
-- 3. Live cron — append one reading every 10 minutes per (sensor, param)
-- =====================================================================

create or replace function public.ds_proprietary_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sensor record;
  v_param  record;
  v_ts     timestamptz := date_trunc('minute', now());
  v_h      double precision := extract(hour from v_ts) + extract(minute from v_ts) / 60.0;
  v_val    double precision;
begin
  -- Inline duplicate of the spec to avoid relying on a temp function
  -- inside a scheduled job.
  for v_sensor in
    select id, metadata->>'variant' as variant
    from public.sensors
    where source = 'datasnake' and source_tier = 'proprietary' and active
  loop
    for v_param in
      select * from (values
        ('ds-sub-ocean', 'temperature_c',        '°C',   22.0::double precision,   1.8::double precision,   0.20::double precision),
        ('ds-sub-ocean', 'salinity_psu',         'psu',  35.0::double precision,   0.3::double precision,   0.05::double precision),
        ('ds-sub-ocean', 'pressure_dbar',        'dbar', 18.5::double precision,   0.4::double precision,   0.10::double precision),
        ('ds-sub-ocean', 'dissolved_oxygen_mgl', 'mg/L',  6.8::double precision,   0.6::double precision,   0.08::double precision),
        ('ds-sub-ocean', 'ph',                   'pH',    8.10::double precision,  0.05::double precision,  0.015::double precision),
        ('ds-ground-met', 'air_temp_c',          '°C',   22.0::double precision,   6.0::double precision,   0.40::double precision),
        ('ds-ground-met', 'humidity_pct',        '%',    52.0::double precision,  12.0::double precision,   1.20::double precision),
        ('ds-ground-met', 'soil_moisture_pct',   '%',    28.0::double precision,   2.5::double precision,   0.30::double precision),
        ('ds-ground-met', 'pm25_ugm3',           'µg/m³', 9.0::double precision,   2.5::double precision,   0.40::double precision),
        ('ds-ground-met', 'wind_speed_mps',      'm/s',   3.2::double precision,   1.6::double precision,   0.30::double precision)
      ) as v(variant, parameter, unit, baseline, amplitude, sigma)
      where variant = v_sensor.variant
    loop
      v_val := v_param.baseline
             + v_param.amplitude * cos((v_h - 14.0) * pi() / 12.0)
             + (random() - 0.5) * 2 * v_param.sigma;
      insert into public.measurements (sensor_id, parameter, value, unit, observed_at)
      values (v_sensor.id, v_param.parameter, round(v_val::numeric, 3)::double precision, v_param.unit, v_ts)
      on conflict (sensor_id, parameter, observed_at) do nothing;
    end loop;
  end loop;
end $$;

revoke all on function public.ds_proprietary_tick() from public;
grant execute on function public.ds_proprietary_tick() to service_role;

-- Schedule via pg_cron — every 10 minutes. Idempotent: only schedule if not
-- already present. Reuses the cron extension created in earlier migrations.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'ds-proprietary-tick') then
    perform cron.schedule(
      'ds-proprietary-tick',
      '*/10 * * * *',
      $cmd$select public.ds_proprietary_tick();$cmd$
    );
  end if;
end $$;

comment on function public.ds_proprietary_tick() is
  'Phase 9.13.2 — appends one synthetic reading per DataSnake proprietary sensor every 10 minutes. Replaced by real uplink when hardware ships.';
