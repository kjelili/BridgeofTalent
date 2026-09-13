-- ============================================================================
-- 0009_escrow_milestone_link.sql
-- Link an escrow account to the specific milestone it funds, so the UI can
-- show and release funds per milestone.
-- ============================================================================

alter table public.escrow_accounts
  add column if not exists milestone_id uuid references public.milestones(id) on delete set null;

create index if not exists idx_escrow_milestone on public.escrow_accounts (milestone_id);

-- ============================================================================
-- End of migration 0009
-- ============================================================================
