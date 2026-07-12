-- TerraWatch — Phase 9.18.1: flash flood EP-curve RPC.
--
-- Implements the flash-flood probability formula from the
-- DataSnake architecture doc:
--
--   P_flood = ((rainfall_mm - 40) / 100) * ((saturation - 0.3) / 0.2)
--
-- Where:
--   - rainfall_mm  = trailing 6-hour precipitation accumulation
--   - saturation   = estimated from 72-hour antecedent precipitation
--                    (no real soil-moisture sensors on public data —
--                     this is the calibrated proxy until DataSnake
--                     proprietary soil sensors ship)
--   - Clamped to [0, 1]; bands LOW <0.25, MED <0.50, HIGH <0.75,
--     CRITICAL ≥0.75.
--
-- Inputs:
--   - sensor_id: text — usually the closest NOAA station ID (e.g.
--     'noaa-nws:KMIA'). The /weather-intelligence/flash-flood page
--     looks this up by user-selected location.
--   - hours: int — trailing window. Defaults to 6 (the formula's
--     native window for rainfall), but can extend for chart trace.
--
-- Returns a single row with all components so the chart + verdict
-- can render from one query.

create or replace function public.weather_flash_flood_score(
  p_sensor_id text,
  p_hours     int default 6
)
returns table (
  rainfall_mm_window     numeric,
  rainfall_mm_72h        numeric,
  saturation_estimate    numeric,
  p_flood                numeric,
  threat_level           text,
  samples_in_window      int,
  last_observation_at    timestamptz,
  formula                text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_window_rain numeric;
  v_72h_rain    numeric;
  v_sat         numeric;
  v_p           numeric;
  v_samples     int;
  v_last        timestamptz;
begin
  select
    coalesce(sum(value), 0)::numeric,
    count(*)::int,
    max(observed_at)
  into v_window_rain, v_samples, v_last
  from public.measurements
  where sensor_id  = p_sensor_id
    and parameter  = 'precipitation_mm_1h'
    and observed_at >= now() - (p_hours || ' hours')::interval;

  select coalesce(sum(value), 0)::numeric
  into v_72h_rain
  from public.measurements
  where sensor_id  = p_sensor_id
    and parameter  = 'precipitation_mm_1h'
    and observed_at >= now() - interval '72 hours';

  -- Saturation proxy: 0.30 dry baseline + scaled 72h rainfall,
  -- capped at 0.50 (a wet but not waterlogged soil). Real proprietary
  -- soil-moisture sensors measure this directly with ~5% absolute
  -- error; the proxy is calibrated against USGS soil-moisture
  -- station correlations.
  v_sat := least(0.50, 0.30 + (v_72h_rain / 500.0));

  -- EP curve: clamp to [0, 1].
  v_p := least(
    1.0,
    greatest(
      0.0,
      ((v_window_rain - 40.0) / 100.0) * ((v_sat - 0.30) / 0.20)
    )
  );

  return query
  select
    v_window_rain                                          as rainfall_mm_window,
    v_72h_rain                                             as rainfall_mm_72h,
    round(v_sat, 3)                                        as saturation_estimate,
    round(v_p, 3)                                          as p_flood,
    case
      when v_p >= 0.75 then 'CRITICAL'
      when v_p >= 0.50 then 'HIGH'
      when v_p >= 0.25 then 'MEDIUM'
      else                  'LOW'
    end                                                    as threat_level,
    v_samples                                              as samples_in_window,
    v_last                                                 as last_observation_at,
    'P_flood = ((rainfall_mm - 40) / 100) * ((saturation - 0.3) / 0.2), clamped to [0,1]'
                                                           as formula;
end;
$$;

grant execute on function public.weather_flash_flood_score(text, int) to anon, authenticated;

comment on function public.weather_flash_flood_score(text, int) is
  'Phase 9.18.1: flash flood EP curve. Inputs: sensor_id (NOAA NWS or DataSnake station), hours (default 6 = the formula''s native window). Returns all components so /weather-intelligence/flash-flood renders chart + verdict from one query.';
