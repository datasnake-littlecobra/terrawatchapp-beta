-- TerraWatch — Phase 10.0: AI/ML inference log + RPC.
--
-- Stores inference outputs from all models. Each row is one detection
-- event: a detected class + confidence from a given input source.
-- Metadata JSONB carries model-specific fields (bbox, area_km2,
-- displacement_cm, etc.). Spatial rows carry a geography point for
-- map rendering (oil spill, seismic InSAR).
--
-- RPC model_inference_results(slug, limit) is what each /ai-models/*
-- page calls to render its chart + log table.

create table if not exists public.model_inference_log (
  id             bigint generated always as identity primary key,
  model_slug     text    not null references public.model_registry(slug) on delete cascade,
  input_source   text    not null,
  detected_class text    not null,
  confidence     numeric not null check (confidence between 0 and 1),
  lat            double precision,
  lon            double precision,
  location       geography(point, 4326),
  metadata       jsonb,
  inferred_at    timestamptz not null default now()
);

create index if not exists ai_log_model_idx
  on public.model_inference_log (model_slug, inferred_at desc);

create index if not exists ai_log_location_idx
  on public.model_inference_log using gist (location)
  where location is not null;

alter table public.model_inference_log enable row level security;
drop policy if exists "ai_log anon select" on public.model_inference_log;
create policy "ai_log anon select"
  on public.model_inference_log for select to anon, authenticated using (true);

-- =====================================================================
-- model_inference_results — per-model inference log for UI
-- =====================================================================

create or replace function public.model_inference_results(
  p_slug  text,
  p_limit int default 50
)
returns table (
  id             bigint,
  input_source   text,
  detected_class text,
  confidence     numeric,
  lat            double precision,
  lon            double precision,
  metadata       jsonb,
  inferred_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, input_source, detected_class, confidence, lat, lon, metadata, inferred_at
  from public.model_inference_log
  where model_slug = p_slug
  order by inferred_at desc
  limit p_limit;
$$;

grant execute on function public.model_inference_results(text, int) to anon, authenticated;

comment on table public.model_inference_log is
  'Phase 10.0: AI/ML inference event log. One row per detection. Powers /ai-models/* views.';
comment on function public.model_inference_results(text, int) is
  'Phase 10.0: returns last p_limit inference results for a given model slug, ordered newest first.';
