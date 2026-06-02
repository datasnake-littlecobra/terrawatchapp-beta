-- TerraWatch — Phase 9.18.1: register NOAA NWS weather stations.
--
-- The /weather-intelligence/flash-flood page needs hourly weather
-- observations from real NOAA stations covering the Miami Beach
-- replay region (UC1) plus a few other coastal cities for
-- expansion. We use NOAA's NWS Observations API (free, no auth,
-- station-level JSON) — see ingest-noaa-nws-obs Edge Function.
--
-- Stations are registered as public.sensors rows with
-- source='noaa-nws' + source_tier='public'. Each is one METAR
-- station. The hourly cron (Phase 9.18.1 — 0041) calls the
-- ingester which fetches /observations/latest per station and
-- writes precipitation_mm_1h, air_temp_c, humidity_pct,
-- wind_speed_mps, pressure_hpa rows to public.measurements.

insert into public.sensors (id, source, source_tier, name, domain, location, metadata, active)
values
  -- Miami area (the UC1 replay region)
  ('noaa-nws:KMIA', 'noaa-nws', 'public', 'Miami Intl Airport (METAR KMIA)',         'land', st_makepoint(-80.290, 25.793)::geography, jsonb_build_object('station_id','KMIA','metar',true,'city','Miami','state','FL'), true),
  ('noaa-nws:KOPF', 'noaa-nws', 'public', 'Opa-Locka Airport (METAR KOPF)',          'land', st_makepoint(-80.279, 25.907)::geography, jsonb_build_object('station_id','KOPF','metar',true,'city','Opa-Locka','state','FL'), true),
  ('noaa-nws:KTMB', 'noaa-nws', 'public', 'Miami Executive Airport (METAR KTMB)',    'land', st_makepoint(-80.433, 25.648)::geography, jsonb_build_object('station_id','KTMB','metar',true,'city','Kendall','state','FL'), true),
  ('noaa-nws:KFLL', 'noaa-nws', 'public', 'Fort Lauderdale Intl (METAR KFLL)',       'land', st_makepoint(-80.153, 26.073)::geography, jsonb_build_object('station_id','KFLL','metar',true,'city','Fort Lauderdale','state','FL'), true),
  -- Other Gulf / coastal cities the section uses
  ('noaa-nws:KGLS', 'noaa-nws', 'public', 'Galveston Intl Airport (METAR KGLS)',     'land', st_makepoint(-94.860, 29.265)::geography, jsonb_build_object('station_id','KGLS','metar',true,'city','Galveston','state','TX'), true),
  ('noaa-nws:KHOU', 'noaa-nws', 'public', 'Houston Hobby (METAR KHOU)',              'land', st_makepoint(-95.279, 29.646)::geography, jsonb_build_object('station_id','KHOU','metar',true,'city','Houston','state','TX'), true),
  ('noaa-nws:KAPF', 'noaa-nws', 'public', 'Naples Municipal (METAR KAPF)',           'land', st_makepoint(-81.775, 26.153)::geography, jsonb_build_object('station_id','KAPF','metar',true,'city','Naples','state','FL'), true),
  ('noaa-nws:KTPA', 'noaa-nws', 'public', 'Tampa Intl Airport (METAR KTPA)',         'land', st_makepoint(-82.533, 27.976)::geography, jsonb_build_object('station_id','KTPA','metar',true,'city','Tampa','state','FL'), true)
on conflict (id) do nothing;

comment on column public.sensors.metadata is
  'Phase 9.18.1: NOAA NWS stations carry station_id (METAR ID, used by the ingester to construct the api.weather.gov URL) + city + state.';
