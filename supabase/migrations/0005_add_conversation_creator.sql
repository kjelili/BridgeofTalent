-- ============================================================================
-- 0005_add_conversation_creator.sql
-- ============================================================================
-- Supersedes 0004 (which restricted INSERT policies to `authenticated` -- a
-- defensible hardening but not the actual fix).
--
-- ROOT CAUSE
-- ----------
-- PostgreSQL applies the SELECT USING policy to rows returned by an
-- INSERT...RETURNING * statement. PostgREST always sends
-- `Prefer: return=representation` to get the inserted row back, which
-- translates to INSERT...RETURNING *. If the inserted row doesn't pass
-- the SELECT visibility check, the entire INSERT aborts with 42501
-- ("new row violates row-level security policy") -- even when WITH CHECK
-- is `true`.
--
-- The conversations SELECT policy from 0003 was:
--   using (public.is_conversation_participant(id))
--
-- At INSERT time, the new conversation has zero participants (they're
-- added in a separate POST afterward), so the function returns false and
-- the INSERT fails.
--
-- THE FIX
-- -------
-- Track who created the conversation, and let them see their own row
-- immediately -- before participants are added. Apply the same pattern to
-- conversation_participants so the batch-insert of both participant rows
-- also returns cleanly.
--
-- The created_by lookup is non-recursive (queries the conversations table
-- directly, not conversation_participants), so it can be expressed inline
-- without needing another SECURITY DEFINER helper.

-- Step 1: clean slate.
-- Wipe any orphan rows from failed Step 7 testing. These can't have been
-- seen or used (the RLS bugs prevented it), so no real data is lost.
-- conversation_participants and messages cascade-delete via FK from
-- conversations, so one DELETE clears all three tables.
delete from public.conversations;

-- Step 2: track the creator.
-- NOT NULL because we always want it; default auth.uid() means the app
-- doesn't need to send it explicitly. Cascade on profile delete so
-- conversations don't orphan behind a deleted account.
alter table public.conversations
  add column if not exists created_by uuid
    not null
    default auth.uid()
    references public.profiles(id) on delete cascade;

-- Step 3: broaden the conversations SELECT policy.
-- Creator can see immediately; everyone else still gates on participation.
drop policy if exists "see own conversations" on public.conversations;
create policy "see own conversations"
  on public.conversations for select
  using (
    created_by = auth.uid()
    or public.is_conversation_participant(id)
  );

-- Step 4: broaden the conversation_participants SELECT policy.
-- The batch INSERT of [{me}, {other}] would otherwise fail on the second
-- row when its RETURNING * runs -- because at that moment is_conversation_participant
-- may or may not see the row inserted earlier in the same statement
-- (within-statement visibility for SECURITY DEFINER STABLE functions is
-- not something to rely on). Adding "conversation's creator can see all
-- its participants" sidesteps the question.
--
-- The EXISTS subquery is safe from recursion: it queries `conversations`,
-- whose SELECT policy uses `created_by = auth.uid()` (direct column read,
-- no further table queries) OR `is_conversation_participant` (SECURITY
-- DEFINER, bypasses RLS).
drop policy if exists "see own participation" on public.conversation_participants;
create policy "see own participation"
  on public.conversation_participants for select
  using (
    profile_id = auth.uid()
    or public.is_conversation_participant(conversation_id)
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
  );
