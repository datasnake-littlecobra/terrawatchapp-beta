-- TerraWatch — Phase 9.13.1: seed the new history tables for the
-- existing synthetic DataSnake sensors (migration 0028).
--
-- One initial deployment row + one initial calibration row per sensor.
-- Idempotent: skips if a row already exists for the sensor.

do $$
declare
  v_sensor record;
  v_calib_id uuid;
begin
  for v_sensor in
    select id, location, metadata
    from public.sensors
    where source = 'datasnake' and source_tier = 'proprietary'
  loop
    -- Deployment row
    if not exists (
      select 1 from public.sensor_deployments where sensor_id = v_sensor.id
    ) then
      insert into public.sensor_deployments (sensor_id, deployed_at, location, depth_m, height_m_agl, operator_id, notes)
      values (
        v_sensor.id,
        coalesce((v_sensor.metadata->>'deployed_at')::timestamptz, now() - interval '60 days'),
        v_sensor.location,
        nullif(v_sensor.metadata->>'depth_m', '')::double precision,
        case when v_sensor.metadata ? 'depth_m' then null else 2.5 end,    -- ground sensors default 2.5m AGL
        'datasnake-field-ops',
        'Initial deployment seeded by migration 0032.'
      );
    end if;

    -- Calibration row
    if not exists (
      select 1 from public.sensor_calibrations where sensor_id = v_sensor.id
    ) then
      insert into public.sensor_calibrations (sensor_id, applied_at, constants, protocol, operator_id, notes)
      values (
        v_sensor.id,
        coalesce((v_sensor.metadata->>'deployed_at')::timestamptz, now() - interval '60 days'),
        jsonb_build_object(
          'slope',  1.0,
          'offset', 0.0,
          'note',   'Factory-default calibration. Replaced at first re-calibration cycle.'
        ),
        'factory-default-v1',
        'datasnake-field-ops',
        'Factory-default calibration applied at deployment.'
      ) returning id into v_calib_id;
    end if;
  end loop;
end $$;
