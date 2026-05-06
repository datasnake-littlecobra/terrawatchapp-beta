-- TerraWatch — Phase 9.5: per-category row counts for honest dropdown UX.
--
-- The events filter dropdown lists 16 categories the schema can hold, but
-- many are naturally rare (avalanche, fire_weather) or seasonal (winter_storm
-- in May). Showing them all without indication of fill-rate reads as broken
-- to users. This RPC backs an auto-grey treatment in EventsFilters.vue:
-- categories with 0 rows over the rolling window render disabled + greyed.
--
-- Indexed on events_category_idx (migration 0005) so the group-by stays fast
-- even as the table grows. Default 30 days matches what the user perceives
-- as "recent" without being so narrow it greys-out seasonal categories on
-- transitional days.

create or replace function public.events_category_counts(
  window_days integer default 30
) returns table (
  category text,
  rows bigint
)
language sql
stable
as $$
  select
    coalesce(category, 'uncategorised') as category,
    count(*)::bigint as rows
  from public.events
  where occurred_at >= now() - make_interval(days => greatest(1, window_days))
  group by coalesce(category, 'uncategorised')
  order by rows desc;
$$;

grant execute on function public.events_category_counts(integer)
  to anon, authenticated;
