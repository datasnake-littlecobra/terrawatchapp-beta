-- TerraWatch — Phase 9.3: Global Terra Chat schema.
--
-- A free-form conversational surface scoped to TerraWatch's data. Multi-turn
-- (history matters), with RAG grounding from public.events_recent so the
-- model can ground answers in real recent events instead of training-data
-- generalities. Per-user daily quota separate from the trip-verdict
-- ask-terra usage so they don't compete for budget.
--
-- Tables follow the same pattern as bookmarks + ask_terra_usage from
-- migration 0001: RLS-locked to auth.uid() = user_id, writes via
-- service-role only on the server side.

-- 1. Conversations — one per chat thread. `title` auto-derives from the
--    first user message via the edge function.
create table if not exists public.terra_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists terra_conversations_user_idx
  on public.terra_conversations (user_id, updated_at desc);

alter table public.terra_conversations enable row level security;

create policy "own conversations"
  on public.terra_conversations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Messages — one row per turn. `events_used` snapshots the RAG context
--    that backed the assistant's reply, so retro-debugging is possible.
create table if not exists public.terra_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.terra_conversations on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  events_used jsonb,                                  -- snapshot of RAG events for this turn
  created_at timestamptz not null default now()
);
create index if not exists terra_messages_convo_idx
  on public.terra_messages (conversation_id, created_at);

alter table public.terra_messages enable row level security;

-- Read scope: messages of conversations the user owns.
create policy "read own messages"
  on public.terra_messages
  for select
  using (
    exists (
      select 1 from public.terra_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- Write scope: same ownership check; in practice all writes go through
-- the edge function with service-role, but the policy lets a client-side
-- "delete this thread" affordance work later without rewiring.
create policy "write own messages"
  on public.terra_messages
  for all
  using (
    exists (
      select 1 from public.terra_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.terra_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- 3. Quota — one row per (user, UTC day). Resets at 00:00 UTC. Default
--    daily limit is 10 (vs Ask Terra's 5) because chat turns are cheaper
--    than full trip-verdict explanations.
create table if not exists public.terra_chat_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.terra_chat_usage enable row level security;

create policy "read own chat usage"
  on public.terra_chat_usage
  for select
  using (auth.uid() = user_id);
-- writes only via service-role (edge function) — no policy needed for that path

-- 4. Convenience: list-conversations RPC keyed to the caller's user_id so
--    the client doesn't have to wire a row-level select with explicit
--    user_id filter. Returns the most recent N conversations with the
--    last message text (for the sidebar list when we add it).
create or replace function public.terra_list_conversations(
  max_rows integer default 20
) returns table (
  id uuid,
  title text,
  updated_at timestamptz,
  message_count bigint,
  last_message text
)
language sql
stable
security invoker
as $$
  select
    c.id,
    c.title,
    c.updated_at,
    count(m.*) as message_count,
    (
      select content from public.terra_messages m2
      where m2.conversation_id = c.id
      order by m2.created_at desc
      limit 1
    ) as last_message
  from public.terra_conversations c
  left join public.terra_messages m on m.conversation_id = c.id
  where c.user_id = auth.uid()
  group by c.id, c.title, c.updated_at
  order by c.updated_at desc
  limit greatest(1, least(max_rows, 100));
$$;

grant execute on function public.terra_list_conversations(integer) to authenticated;
