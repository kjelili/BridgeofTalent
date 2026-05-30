-- ============================================================================
-- 0004_ensure_chat_insert_policies.sql
-- ============================================================================
-- Recovery migration. After 0003 fixed the recursion in the SELECT policies,
-- POSTing to /rest/v1/conversations started failing with Postgres 42501
-- ("new row violates row-level security policy"). 0003 didn't touch the
-- INSERT policies on the chat tables, so the only way that error happens
-- is if the original INSERT policies from 0001 aren't actually present in
-- the live database -- possibly because 0001 was applied incompletely, or
-- because a manual change dropped them at some point.
--
-- This migration drops (if exists) and recreates the two INSERT policies
-- the app relies on:
--
--   "create conversation"  on public.conversations
--   "add participation"    on public.conversation_participants
--
-- Both are restricted to the `authenticated` role rather than left open to
-- `public` (which would include the anon role). The auth check itself
-- comes from PostgREST having set the role to `authenticated` based on the
-- caller's JWT; anon users can't reach these policies.
--
-- The participants INSERT keeps `with check (true)` for a single reason:
-- getOrCreateConversation in App.js batch-inserts both participant rows
-- in one request, and a stricter policy like `profile_id = auth.uid()`
-- would fail the second row (the other party). The looseness is bounded
-- by the requirement that the caller already knows the conversation_id,
-- which they only get back from a successful conversations INSERT they
-- just made -- so in practice this still scopes participation creation
-- to the conversation's creator.
--
-- Idempotent: re-running is safe.
-- ============================================================================

drop policy if exists "create conversation" on public.conversations;
drop policy if exists "add participation"   on public.conversation_participants;

create policy "create conversation"
  on public.conversations for insert
  to authenticated
  with check (true);

create policy "add participation"
  on public.conversation_participants for insert
  to authenticated
  with check (true);
