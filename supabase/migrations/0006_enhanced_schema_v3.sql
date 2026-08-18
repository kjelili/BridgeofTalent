-- ============================================================================
-- 0006_enhanced_schema_v3.sql
-- BridgeofTalent v3.0 — Production-Ready Schema with AI, Payments, Audit
-- ============================================================================

-- ---- New Enums ---------------------------------------------------------------
do $$ begin create type payment_status as enum ('pending', 'held', 'released', 'refunded', 'disputed');
exception when duplicate_object then null; end $$;

do $$ begin create type milestone_status as enum ('pending', 'funded', 'in_progress', 'submitted', 'approved', 'disputed');
exception when duplicate_object then null; end $$;

do $$ begin create type subscription_tier as enum ('free', 'plus', 'pro', 'enterprise');
exception when duplicate_object then null; end $$;

do $$ begin create type verification_level as enum ('none', 'email', 'identity', 'skill_tested', 'expert_vetted');
exception when duplicate_object then null; end $$;

do $$ begin create type notification_channel as enum ('in_app', 'email', 'push', 'sms');
exception when duplicate_object then null; end $$;

-- ---- Enhanced profiles -------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_url text default '',
  add column if not exists timezone text default 'UTC',
  add column if not exists language text default 'en',
  add column if not exists subscription_tier subscription_tier default 'free',
  add column if not exists verification_level verification_level default 'none',
  add column if not exists onboarding_completed boolean default false,
  add column if not exists last_active_at timestamptz default now(),
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null;

-- ---- Enhanced freelancers ----------------------------------------------------
alter table public.freelancers
  add column if not exists jss_score integer default 0 check (jss_score between 0 and 100),
  add column if not exists total_earnings numeric(14,2) default 0,
  add column if not exists total_hours_worked numeric(10,2) default 0,
  add column if not exists availability_status text default 'available', -- available, busy, part_time, not_available
  add column if not exists weekly_hours_available integer default 40,
  add column if not exists preferred_project_types text[] default '{}',
  add column if not exists ai_match_score numeric(5,2) default 0,
  add column if not exists embedding vector(1536); -- for AI semantic matching

-- ---- Skill tests & certifications ------------------------------------------
create table if not exists public.skill_tests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text default '',
  passing_score integer not null default 70,
  time_limit_minutes integer not null default 30,
  question_count integer not null default 20,
  is_active boolean default true,
  created_at timestamptz not null default now()
);

create table if not exists public.freelancer_certifications (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references public.freelancers(id) on delete cascade,
  skill_test_id uuid not null references public.skill_tests(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  passed boolean not null default false,
  taken_at timestamptz not null default now(),
  certificate_url text default '',
  unique (freelancer_id, skill_test_id)
);

-- ---- Payments & Escrow -------------------------------------------------------
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_payment_method_id text not null,
  type text not null, -- card, bank_transfer
  last_four text,
  brand text,
  is_default boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.escrow_accounts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  total_amount numeric(12,2) not null default 0,
  platform_fee numeric(12,2) not null default 0,
  freelancer_payout numeric(12,2) not null default 0,
  stripe_payment_intent_id text,
  status payment_status default 'pending',
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text default '',
  amount numeric(12,2) not null default 0,
  due_date timestamptz,
  status milestone_status default 'pending',
  deliverables text[] default '{}',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  sort_order integer not null default 0
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  escrow_id uuid references public.escrow_accounts(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, -- deposit, release, refund, fee, payout
  amount numeric(12,2) not null,
  currency text default 'USD',
  stripe_transaction_id text,
  description text default '',
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- ---- AI Matching & Embeddings -----------------------------------------------
create table if not exists public.job_embeddings (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  embedding vector(1536),
  keywords text[] default '{}',
  complexity_score numeric(5,2) default 0,
  estimated_duration_days integer,
  ai_summary text default '',
  updated_at timestamptz default now()
);

create table if not exists public.match_scores (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  freelancer_id uuid not null references public.freelancers(id) on delete cascade,
  score numeric(5,2) not null default 0,
  skill_match numeric(5,2) default 0,
  rate_match numeric(5,2) default 0,
  experience_match numeric(5,2) default 0,
  availability_match numeric(5,2) default 0,
  ai_reasoning text default '',
  created_at timestamptz not null default now(),
  unique (job_id, freelancer_id)
);

-- ---- Subscriptions & Billing -------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_subscription_id text,
  tier subscription_tier default 'free',
  status text default 'active', -- active, canceled, past_due
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.subscription_features (
  tier subscription_tier primary key,
  monthly_proposal_limit integer default 10,
  can_see_competitor_bids boolean default false,
  featured_profile boolean default false,
  priority_support boolean default false,
  instant_payouts boolean default false,
  ai_proposals_per_month integer default 0,
  team_members_limit integer default 1,
  custom_branding boolean default false
);

-- Insert default feature tiers
insert into public.subscription_features (tier, monthly_proposal_limit, can_see_competitor_bids, featured_profile, priority_support, instant_payouts, ai_proposals_per_month, team_members_limit, custom_branding)
values
  ('free', 10, false, false, false, false, 3, 1, false),
  ('plus', 50, false, true, false, false, 20, 1, false),
  ('pro', 999, true, true, true, true, 100, 5, true),
  ('enterprise', 9999, true, true, true, true, 999, 20, true)
on conflict (tier) do update set
  monthly_proposal_limit = excluded.monthly_proposal_limit,
  can_see_competitor_bids = excluded.can_see_competitor_bids,
  featured_profile = excluded.featured_profile,
  priority_support = excluded.priority_support,
  instant_payouts = excluded.instant_payouts,
  ai_proposals_per_month = excluded.ai_proposals_per_month,
  team_members_limit = excluded.team_members_limit,
  custom_branding = excluded.custom_branding;

-- ---- Audit Logs --------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null, -- job, bid, project, escrow, profile
  entity_id uuid,
  old_values jsonb default '{}',
  new_values jsonb default '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

-- ---- Enhanced Notifications --------------------------------------------------
alter table public.notifications
  add column if not exists channel notification_channel default 'in_app',
  add column if not exists action_url text default '',
  add column if not expires_at timestamptz;

-- ---- Saved Searches & Talent Pools -------------------------------------------
create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  search_type text not null, -- jobs, freelancers
  filters jsonb not null default '{}',
  alert_frequency text default 'daily', -- immediate, daily, weekly, never
  last_alert_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.talent_pools (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text default '',
  freelancer_ids uuid[] default '{}',
  created_at timestamptz not null default now()
);

-- ---- Disputes ----------------------------------------------------------------
create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  raised_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  evidence text[] default '{}',
  status text default 'open', -- open, under_review, resolved, closed
  resolution text default '',
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---- Referrals & Rewards -----------------------------------------------------
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  status text default 'pending', -- pending, qualified, rewarded
  reward_amount numeric(12,2) default 50,
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (referred_id)
);

-- ---- RLS Policies for New Tables ---------------------------------------------
alter table public.skill_tests enable row level security;
alter table public.freelancer_certifications enable row level security;
alter table public.payment_methods enable row level security;
alter table public.escrow_accounts enable row level security;
alter table public.milestones enable row level security;
alter table public.transactions enable row level security;
alter table public.job_embeddings enable row level security;
alter table public.match_scores enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.saved_searches enable row level security;
alter table public.talent_pools enable row level security;
alter table public.disputes enable row level security;
alter table public.referrals enable row level security;

-- Public read for skill tests
create policy "skill_tests readable" on public.skill_tests for select using (true);

-- Freelancers can see their own certifications
create policy "own certifications" on public.freelancer_certifications for select using (auth.uid() = freelancer_id);
create policy "system inserts certifications" on public.freelancer_certifications for insert with check (true);

-- Payment methods: own only
create policy "own payment methods" on public.payment_methods for all using (auth.uid() = user_id);

-- Escrow: parties can see
create policy "escrow visible to parties" on public.escrow_accounts for select using (
  auth.uid() = client_id or auth.uid() in (
    select freelancer_id from public.project_members pm where pm.project_id = escrow_accounts.project_id
  )
);

-- Milestones: parties can see
create policy "milestones visible to parties" on public.milestones for select using (
  auth.uid() in (
    select client_id from public.projects p where p.id = milestones.project_id
    union
    select freelancer_id from public.project_members pm where pm.project_id = milestones.project_id
  )
);

-- Transactions: own only
create policy "own transactions" on public.transactions for select using (auth.uid() = user_id);

-- Match scores: visible to matched freelancer and job client
create policy "match scores visible" on public.match_scores for select using (
  auth.uid() = freelancer_id or auth.uid() = (select client_id from public.jobs j where j.id = match_scores.job_id)
);

-- Subscriptions: own only
create policy "own subscription" on public.subscriptions for all using (auth.uid() = user_id);

-- Audit logs: own only
create policy "own audit logs" on public.audit_logs for select using (auth.uid() = user_id);

-- Saved searches: own only
create policy "own saved searches" on public.saved_searches for all using (auth.uid() = user_id);

-- Talent pools: client only
create policy "own talent pools" on public.talent_pools for all using (auth.uid() = client_id);

-- Disputes: parties can see
create policy "disputes visible to parties" on public.disputes for select using (
  auth.uid() = raised_by or auth.uid() = resolved_by or auth.uid() in (
    select client_id from public.projects p where p.id = disputes.project_id
    union
    select freelancer_id from public.project_members pm where pm.project_id = disputes.project_id
  )
);

-- Referrals: referrer can see
create policy "own referrals" on public.referrals for select using (auth.uid() = referrer_id);

-- ---- Indexes -----------------------------------------------------------------
create index if not exists idx_freelancers_jss on public.freelancers (jss_score desc);
create index if not exists idx_freelancers_embedding on public.freelancers using ivfflat (embedding vector_cosine_ops);
create index if not exists idx_jobs_embedding on public.job_embeddings using ivfflat (embedding vector_cosine_ops);
create index if not exists idx_match_scores_job on public.match_scores (job_id, score desc);
create index if not exists idx_match_scores_freelancer on public.match_scores (freelancer_id, score desc);
create index if not exists idx_escrow_project on public.escrow_accounts (project_id);
create index if not exists idx_milestones_project on public.milestones (project_id);
create index if not exists idx_transactions_user on public.transactions (user_id, created_at desc);
create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);
create index if not exists idx_audit_logs_user on public.audit_logs (user_id, created_at desc);
create index if not exists idx_disputes_project on public.disputes (project_id);

-- ---- Functions ---------------------------------------------------------------

-- Auto-update freelancer JSS score based on reviews
create or replace function public.update_freelancer_jss()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.freelancers
  set 
    jss_score = least(100, greatest(0, (
      select round(avg(rating) * 20 * 0.7 + (count(*) * 5))
      from public.reviews
      where freelancer_id = new.freelancer_id
    ))),
    review_count = (select count(*) from public.reviews where freelancer_id = new.freelancer_id),
    rating = (select avg(rating) from public.reviews where freelancer_id = new.freelancer_id)
  where id = new.freelancer_id;
  return new;
end;
$$;

drop trigger if exists on_review_added on public.reviews;
create trigger on_review_added
  after insert on public.reviews
  for each row execute function public.update_freelancer_jss();

-- Audit log trigger
create or replace function public.create_audit_log()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

-- Apply audit trigger to critical tables
drop trigger if exists audit_jobs on public.jobs;
create trigger audit_jobs after insert or update or delete on public.jobs
  for each row execute function public.create_audit_log();

drop trigger if exists audit_bids on public.bids;
create trigger audit_bids after insert or update or delete on public.bids
  for each row execute function public.create_audit_log();

drop trigger if exists audit_projects on public.projects;
create trigger audit_projects after insert or update or delete on public.projects
  for each row execute function public.create_audit_log();

drop trigger if exists audit_escrow on public.escrow_accounts;
create trigger audit_escrow after insert or update or delete on public.escrow_accounts
  for each row execute function public.create_audit_log();

-- Auto-generate referral code on profile creation
create or replace function public.generate_referral_code()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.referral_code is null then
    new.referral_code := upper(substring(md5(random()::text), 1, 8));
  end if;
  return new;
end;
$$;

drop trigger if exists set_referral_code on public.profiles;
create trigger set_referral_code
  before insert on public.profiles
  for each row execute function public.generate_referral_code();

-- ============================================================================
-- End of migration 0006
-- ============================================================================
