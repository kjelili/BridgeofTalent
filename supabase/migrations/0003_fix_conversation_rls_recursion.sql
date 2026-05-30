-- ============================================================================
-- 0003_fix_conversation_rls_recursion.sql
-- ============================================================================
-- Fix infinite recursion (Postgres 42P17) in the RLS policies for the chat
-- tables introduced by 0001_initial_schema.sql.
--
-- WHAT WAS WRONG
-- --------------
-- The policies queried conversation_participants from within their own
-- USING clauses:
--
--   create policy "see own participation" on conversation_participants
--     for select using (profile_id = auth.uid()
--                       or exists (select 1 from conversation_participants cp ...));
--
--   create policy "see own conversations" on conversations
--     for select using (exists (select 1 from conversation_participants cp ...));
--
-- When either policy ran, Postgres applied the participants SELECT policy to
-- the inner query. That policy queried participants again, applying itself,
-- and so on forever. Any SELECT touching either table -- including the
-- implicit SELECT that PostgREST runs after an INSERT to return the new row
-- under `Prefer: return=representation` -- bombed with HTTP 500.
--
-- The same recursive shape was duplicated into the messages policies, so
-- this migration rewrites all four.
--
-- HOW WE FIX IT
-- -------------
-- Pull the membership check into a SECURITY DEFINER function. The function
-- runs with the privileges of its owner (the migration runner, typically
-- postgres / supabase_admin), which bypasses RLS on the inner query. The
-- policies then call the function instead of querying the table directly,
-- so there's no policy-on-policy recursion.
--
-- The function is marked STABLE so the planner can cache its result within
-- a single statement, and given an explicit search_path to defuse the
-- well-known SECURITY DEFINER hijack vector where a caller manipulates
-- search_path to point at a malicious schema.
--
-- This migration is idempotent: function uses CREATE OR REPLACE, policies
-- use DROP IF EXISTS before CREATE.
-- ============================================================================

create or replace function public.is_conversation_participant(_conv_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants
    where conversation_id = _conv_id
      and profile_id = auth.uid()
  );
$$;

-- Lock the function down: only the authenticated role can call it. We
-- don't want the anon role enumerating conversation membership.
revoke all     on function public.is_conversation_participant(uuid) from public;
grant  execute on function public.is_conversation_participant(uuid) to authenticated;

-- Replace the four recursive policies.

drop policy if exists "see own conversations"       on public.conversations;
drop policy if exists "see own participation"       on public.conversation_participants;
drop policy if exists "read messages in own convos" on public.messages;
drop policy if exists "send message if participant" on public.messages;

create policy "see own conversations"
  on public.conversations for select
  using (public.is_conversation_participant(id));

create policy "see own participation"
  on public.conversation_participants for select
  using (
    profile_id = auth.uid()
    or public.is_conversation_participant(conversation_id)
  );

create policy "read messages in own convos"
  on public.messages for select
  using (public.is_conversation_participant(conversation_id));

create policy "send message if participant"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and public.is_conversation_participant(conversation_id)
  );
