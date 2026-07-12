-- TerraWatch — Phase 10.1: safe_select RPC for the in-page SQL playground.
--
-- Executes any SQL statement submitted from the /ai-models/* SQL Playground
-- component, but ONLY if it is a read-only SELECT statement. This lets
-- anonymous users explore the model data in their browser without being able
-- to mutate anything.
--
-- Security model:
--   - Validates the trimmed, lower-cased query starts with 'select'
--   - Rejects any statement containing DDL/DML keywords as a second check
--   - Runs as the calling user (SECURITY INVOKER) so anon RLS policies still
--     apply — the caller cannot see rows they would not otherwise be allowed
--     to read via normal table access.
--   - Returns JSONB so a single RPC call handles any result shape.

create or replace function public.safe_select(p_sql text)
returns jsonb
language plpgsql
security invoker          -- caller's role + RLS apply; no privilege escalation
set search_path = public
as $$
declare
  v_sql    text;
  v_result jsonb;
begin
  -- Normalise whitespace for validation
  v_sql := trim(lower(regexp_replace(p_sql, '\s+', ' ', 'g')));

  -- Must start with SELECT
  if not (v_sql like 'select %' or v_sql = 'select') then
    raise exception 'Only SELECT statements are allowed.';
  end if;

  -- Block obvious mutation / DDL keywords regardless of position
  if v_sql ~* '\m(insert|update|delete|truncate|drop|create|alter|grant|revoke|copy|execute|do|call|set|reset|vacuum|analyze|explain\s+analyze)\M' then
    raise exception 'Statement contains disallowed keyword. Only read-only SELECT is permitted.';
  end if;

  -- Execute and collect into JSONB
  execute format(
    'select coalesce(jsonb_agg(row_to_json(t)), %L::jsonb) from (%s) t',
    '[]', p_sql
  ) into v_result;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

-- Grant to anon so the browser client can call it without being signed in
grant execute on function public.safe_select(text) to anon, authenticated;

comment on function public.safe_select(text) is
  'Phase 10.1: read-only SQL playground RPC. Accepts SELECT-only statements; '
  'returns JSONB array. SECURITY INVOKER so anon RLS policies still apply.';
