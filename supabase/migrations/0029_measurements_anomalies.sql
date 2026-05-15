-- TerraWatch — Phase 9.13.2: anomaly detection + parameter comparison RPCs.
--
-- The /insurance/pipeline showcase needs two pieces of math beyond the
-- raw measurements_series RPC:
--
--   1. Rolling z-score anomaly detection — "the sensor knows something
--      is wrong before the news does". A 24h rolling mean + std,
--      flagging any point with |z| > 2.
--
--   2. Two-parameter correlation — temperature vs humidity dual-axis
--      chart from the user's datapreview screenshot, generalized to
--      any (sensor, param_a, param_b, window). Returns aligned hourly
--      pairs + a pearson_r scalar via a sibling function.
--
-- Both functions read from public.measurements_hourly (already shipped
-- in migration 0014). The pipeline shows hours >= 24 — anomaly detection
-- benefits from the hourly rollup's noise reduction.

-- =====================================================================
-- 1. Rolling z-score anomaly detection
-- =====================================================================

create or replace function public.measurements_anomalies(
  sensor text,
  param  text,
  hours  integer default 168
) returns table (
  observed_at timestamptz,
  value       double precision,
  rolling_mean double precision,
  rolling_std  double precision,
  z_score      double precision,
  is_anomaly   boolean,
  unit         text
)
language sql
stable
as $$
  with base as (
    select
      h.hour as observed_at,
      h.avg_value as value,
      h.unit
    from public.measurements_hourly h
    where h.sensor_id = sensor
      and h.parameter = param
      and h.hour >= now() - make_interval(hours => hours)
  ),
  windowed as (
    select
      observed_at,
      value,
      unit,
      avg(value) over (order by observed_at rows between 23 preceding and current row) as rolling_mean,
      stddev_samp(value) over (order by observed_at rows between 23 preceding and current row) as rolling_std
    from base
  )
  select
    observed_at,
    value,
    rolling_mean,
    rolling_std,
    case
      when rolling_std is null or rolling_std = 0 then 0
      else (value - rolling_mean) / rolling_std
    end as z_score,
    case
      when rolling_std is null or rolling_std = 0 then false
      else abs((value - rolling_mean) / rolling_std) > 2.0
    end as is_anomaly,
    unit
  from windowed
  order by observed_at asc;
$$;

grant execute on function public.measurements_anomalies(text, text, integer) to anon, authenticated;

comment on function public.measurements_anomalies(text, text, integer) is
  'Rolling 24h z-score anomaly detection on a single (sensor, parameter, hours) window. Reads measurements_hourly; flags |z| > 2.';

-- =====================================================================
-- 2. Two-parameter correlation — aligned hourly pairs
-- =====================================================================

create or replace function public.measurements_compare(
  sensor   text,
  param_a  text,
  param_b  text,
  hours    integer default 168
) returns table (
  observed_at timestamptz,
  value_a     double precision,
  value_b     double precision,
  unit_a      text,
  unit_b      text
)
language sql
stable
as $$
  with a as (
    select h.hour, h.avg_value, h.unit
    from public.measurements_hourly h
    where h.sensor_id = sensor
      and h.parameter = param_a
      and h.hour >= now() - make_interval(hours => hours)
  ),
  b as (
    select h.hour, h.avg_value, h.unit
    from public.measurements_hourly h
    where h.sensor_id = sensor
      and h.parameter = param_b
      and h.hour >= now() - make_interval(hours => hours)
  )
  select
    a.hour as observed_at,
    a.avg_value as value_a,
    b.avg_value as value_b,
    a.unit as unit_a,
    b.unit as unit_b
  from a
  join b on a.hour = b.hour
  order by a.hour asc;
$$;

grant execute on function public.measurements_compare(text, text, text, integer) to anon, authenticated;

comment on function public.measurements_compare(text, text, text, integer) is
  'Returns time-aligned hourly pairs of two parameters from the same sensor. Inner-joined on hour bucket.';

-- =====================================================================
-- 3. Pearson correlation coefficient — single-row companion
-- =====================================================================

create or replace function public.measurements_correlation(
  sensor   text,
  param_a  text,
  param_b  text,
  hours    integer default 168
) returns table (
  pearson_r  double precision,
  n_samples  integer,
  unit_a     text,
  unit_b     text
)
language sql
stable
as $$
  select
    corr(c.value_a, c.value_b) as pearson_r,
    count(*)::int as n_samples,
    max(c.unit_a) as unit_a,
    max(c.unit_b) as unit_b
  from public.measurements_compare(sensor, param_a, param_b, hours) c;
$$;

grant execute on function public.measurements_correlation(text, text, text, integer) to anon, authenticated;

comment on function public.measurements_correlation(text, text, text, integer) is
  'Pearson r and sample count for two parameters on the same sensor over the window. Companion to measurements_compare.';
