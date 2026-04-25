-- TerraWatch — Phase 9.0: tiered event retention.
-- Different event kinds have different useful lifespans:
--   weather alerts: 3 days   (NWS alerts go stale fast; expires_at handles most)
--   wildfires:      7 days   (EONET keeps them open until contained)
--   space weather:  14 days  (Kp trend context; aurora chasers look back ~2 weeks)
--   seismic:        30 days  (Travel Advisory needs recent quake history)
--   volcano:        30 days  (alert levels persist until downgraded)
--
-- The old uniform `events_prune(older_than_days)` is replaced with this tiered
-- version. The edge function calls it with no arguments at the end of each ingest.

create or replace function public.events_prune()
returns integer
language plpgsql
security definer
as $$
declare
  removed integer;
begin
  delete from public.events
  where
    -- expired rows always go, regardless of kind
    (expires_at is not null and expires_at < now())
    -- weather alerts (non-wildfire): 3 days
    or (kind = 'weather' and (category is null or category != 'wildfire')
        and occurred_at < now() - interval '3 days')
    -- wildfires: 7 days
    or (kind = 'weather' and category = 'wildfire'
        and occurred_at < now() - interval '7 days')
    -- space weather: 14 days
    or (kind = 'space' and occurred_at < now() - interval '14 days')
    -- seismic (earthquakes + volcanoes + tsunamis): 30 days
    or (kind = 'seismic' and occurred_at < now() - interval '30 days')
    -- tides and anything else: 7 days
    or (kind not in ('weather', 'space', 'seismic')
        and occurred_at < now() - interval '7 days');
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Keep the old signature callable from legacy callers (edge function passes no
-- args after this migration, but pg_cron or manual calls with the old signature
-- won't break).
create or replace function public.events_prune(older_than_days integer)
returns integer
language sql
security definer
as $$
  select public.events_prune();
$$;
