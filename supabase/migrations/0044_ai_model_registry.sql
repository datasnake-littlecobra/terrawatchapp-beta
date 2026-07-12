-- TerraWatch — Phase 10.0: AI/ML model registry.
--
-- Central catalog of all AI/ML models in the DataSnake stack.
-- Drives the /ai-models section hub page + per-model detail views.
-- Status values: 'demo' = synthetic data, 'training' = model being
-- built, 'live' = real sensor inference running, 'planned' = roadmap.

create table if not exists public.model_registry (
  slug          text primary key,
  name          text    not null,
  tier          int     not null check (tier in (1,2,3)),
  score         int     not null check (score between 0 and 20),
  status        text    not null check (status in ('demo','training','live','planned')),
  architecture  text,
  dataset_name  text,
  dataset_url   text,
  accuracy_pct  numeric,
  description   text,
  created_at    timestamptz not null default now()
);

alter table public.model_registry enable row level security;
drop policy if exists "model_registry anon select" on public.model_registry;
create policy "model_registry anon select"
  on public.model_registry for select to anon, authenticated using (true);

comment on table public.model_registry is
  'Phase 10.0: AI/ML model catalog. Drives /ai-models section. Status: demo=synthetic, training=building, live=real-sensor, planned=roadmap.';
