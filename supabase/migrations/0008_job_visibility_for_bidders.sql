-- ============================================================================
-- 0008_job_visibility_for_bidders.sql
-- Let a freelancer read a job they've applied to, even after it closes, so
-- their applications remain viewable. Uses a security-definer helper to avoid
-- RLS recursion between jobs and bids.
-- ============================================================================

create or replace function public.has_bid_on_job(p_job_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.bids b
    where b.job_id = p_job_id and b.freelancer_id = auth.uid()
  );
$$;

drop policy if exists "jobs readable" on public.jobs;
create policy "jobs readable" on public.jobs for select
  using (
    status = 'open'
    or auth.uid() = client_id
    or public.has_bid_on_job(id)
  );

-- ============================================================================
-- End of migration 0008
-- ============================================================================
