-- =============================================================================
-- TerraWatch Phase 10.0 — AI/ML Setup Verification
--
-- Run each block in Supabase SQL editor to confirm the AI/ML section is
-- correctly installed. All queries are read-only (SELECT / information_schema).
-- Expected results are documented inline.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. TABLES EXIST WITH CORRECT COLUMNS
-- -----------------------------------------------------------------------------

-- Expected: 2 rows — model_registry, model_inference_log
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('model_registry', 'model_inference_log')
order by table_name;


-- Expected: slug, name, tier, score, status, architecture,
--           dataset_name, dataset_url, accuracy_pct, description, created_at
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'model_registry'
order by ordinal_position;


-- Expected: id, model_slug, input_source, detected_class, confidence,
--           lat, lon, location, metadata, inferred_at
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'model_inference_log'
order by ordinal_position;


-- -----------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY — POLICIES EXIST
-- -----------------------------------------------------------------------------

-- Expected: 2 rows with policyname matching 'model_registry anon select'
--           and 'ai_log anon select'
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('model_registry', 'model_inference_log')
order by tablename;


-- -----------------------------------------------------------------------------
-- 3. RPC FUNCTION EXISTS AND IS CALLABLE
-- -----------------------------------------------------------------------------

-- Expected: 1 row showing the function signature
select routine_name, routine_type, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name   = 'model_inference_results';


-- Expected: returns rows from model_inference_log for pipeline-detection
-- (adjust slug to test another model)
select id, detected_class, confidence, inferred_at
from public.model_inference_results('pipeline-detection', 5)
order by inferred_at desc;


-- -----------------------------------------------------------------------------
-- 4. FUNCTION GRANTS — ANON ROLE CAN EXECUTE
-- -----------------------------------------------------------------------------

-- Expected: includes 'anon' and 'authenticated' in grantee
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public'
  and routine_name   = 'model_inference_results'
order by grantee;


-- -----------------------------------------------------------------------------
-- 5. SEED DATA COUNTS
-- -----------------------------------------------------------------------------

-- Expected: 7 rows (all models from the roadmap)
select count(*) as model_count
from public.model_registry;


-- Expected: distribution across slugs — ~30 rows each for Tier 1 models
select model_slug, count(*) as inference_count
from public.model_inference_log
group by model_slug
order by inference_count desc;


-- Expected: total >= 90 (30 per Tier 1 model × 3 models)
select count(*) as total_inference_rows
from public.model_inference_log;


-- -----------------------------------------------------------------------------
-- 6. MODEL REGISTRY CONTENTS — VERIFY ALL 7 MODELS
-- -----------------------------------------------------------------------------

-- Expected: 7 rows with tier (1, 2, or 3), score, status visible
select slug, name, tier, score, status, architecture, accuracy_pct
from public.model_registry
order by tier, score desc;


-- -----------------------------------------------------------------------------
-- 7. SPATIAL DATA — GEOGRAPHY COLUMN POPULATED FOR SPATIAL MODELS
-- -----------------------------------------------------------------------------

-- Expected: oil-spill and seismic-insar rows have non-null location
select model_slug, count(*) as spatial_rows
from public.model_inference_log
where location is not null
group by model_slug;


-- -----------------------------------------------------------------------------
-- 8. JSONB METADATA — KEY FIELDS PER MODEL
-- -----------------------------------------------------------------------------

-- pipeline-detection: should have bbox, segment_id, pipeline_km
select
  id,
  metadata ->> 'segment_id'   as segment_id,
  metadata ->> 'pipeline_km'  as pipeline_km,
  metadata -> 'bbox'           as bbox
from public.model_inference_log
where model_slug = 'pipeline-detection'
limit 5;


-- oil-spill: should have area_km2, satellite, polygon_geojson
select
  id,
  metadata ->> 'area_km2'         as area_km2,
  metadata ->> 'satellite'        as satellite,
  (metadata -> 'polygon_geojson') is not null as has_polygon
from public.model_inference_log
where model_slug = 'oil-spill'
limit 5;


-- seismic-insar: should have max_displacement_cm, event_date
select
  id,
  metadata ->> 'max_displacement_cm' as displacement_cm,
  metadata ->> 'event_date'          as event_date,
  metadata ->> 'coherence'           as coherence
from public.model_inference_log
where model_slug = 'seismic-insar'
limit 5;


-- -----------------------------------------------------------------------------
-- 9. INDEXES EXIST
-- -----------------------------------------------------------------------------

-- Expected: ai_log_model_idx and ai_log_location_idx
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename  = 'model_inference_log'
order by indexname;


-- -----------------------------------------------------------------------------
-- 10. END-TO-END: WHAT THE UI SEES (mirrors fetchModelRegistry service call)
-- -----------------------------------------------------------------------------

select slug, name, tier, score, status, architecture,
       dataset_name, dataset_url, accuracy_pct, description
from public.model_registry
order by score desc;
