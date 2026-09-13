-- ============================================================================
-- 0001_core_schema.sql
-- BridgeofTalent — Core marketplace schema (base tables, RLS, helpers)
-- Runs BEFORE 0006_enhanced_schema_v3.sql, which ALTERs several of these
-- tables and adds AI / payments / audit features on top.
-- ============================================================================

-- ---- Extensions --------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists vector;     -- required by 0006 (embeddings)

-- ---- Enums -------------------------------------------------------------------
do $$ begin create type user_role as enum ('client', 'freelancer');
exception when duplicate_object then null; end $$;

-- ---- profiles ----------------------------------------------------------------
-- One row per auth user. 0006 adds subscription_tier, verification_level,
-- avatar_url, timezone, language, referral_code, referred_by, etc.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  role user_role not null default 'client',
  company text default '',
  stripe_customer_id text,
  stripe_connect_id text,
  created_at timestamptz not null default now()
);

-- ---- freelancers -------------------------------------------------------------
-- Shares its primary key with the owning profile. 0006 adds jss_score,
-- availability_status, embedding, etc.
create table if not exists public.freelancers (
  id uuid primary key references public.profiles(id) on delete cascade,
  title text not null default '',
  location text default '',
  hourly_rate numeric(10,2) default 0,
  rating numeric(3,2) default 0,
  review_count integer default 0,
  skills text[] default '{}',
  verified_skills text[] default '{}',
  bio text default '',
  status text default 'active',
  avatar text default '',
  identity_verified boolean default false,
  top_rated boolean default false,
  created_at timestamptz not null default now()
);

-- ---- jobs --------------------------------------------------------------------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  client_name text not null default '',
  title text not null,
  description text not null default '',
  skills text[] default '{}',
  budget_min numeric(12,2) default 0,
  budget_max numeric(12,2) default 0,
  budget_type text not null default 'fixed' check (budget_type in ('fixed', 'hourly')),
  category text default '',
  location text default 'Remote',
  team_size integer default 1,
  status text not null default 'open' check (status in ('open', 'closed', 'draft')),
  deadline timestamptz,
  created_at timestamptz not null default now()
);

-- ---- projects ----------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  client_name text default '',
  title text not null,
  description text default '',
  budget numeric(12,2) default 0,
  category text default '',
  status text not null default 'active' check (status in ('active', 'completed', 'disputed')),
  escrow_released boolean default false,
  created_at timestamptz not null default now()
);

-- ---- project_members ---------------------------------------------------------
-- freelancer_id references profiles(id) so it can be compared to auth.uid().
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  freelancer_id uuid not null references public.profiles(id) on delete cascade,
  role text default 'member',
  created_at timestamptz not null default now(),
  unique (project_id, freelancer_id)
);

-- ---- bids --------------------------------------------------------------------
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  freelancer_id uuid not null references public.freelancers(id) on delete cascade,
  freelancer_name text default '',
  amount numeric(12,2) not null default 0,
  message text default '',
  timeline text default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (job_id, freelancer_id)
);

-- ---- reviews -----------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references public.freelancers(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  client_name text default '',
  rating integer not null check (rating between 1 and 5),
  comment text default '',
  created_at timestamptz not null default now()
);

-- ---- notifications -----------------------------------------------------------
-- 0006 adds channel, action_url, expires_at.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'info',
  title text not null default '',
  message text default '',
  read boolean default false,
  created_at timestamptz not null default now()
);

-- ---- Indexes -----------------------------------------------------------------
create index if not exists idx_jobs_client on public.jobs (client_id);
create index if not exists idx_jobs_status_created on public.jobs (status, created_at desc);
create index if not exists idx_jobs_category on public.jobs (category);
create index if not exists idx_bids_job on public.bids (job_id);
create index if not exists idx_bids_freelancer on public.bids (freelancer_id);
create index if not exists idx_reviews_freelancer on public.reviews (freelancer_id);
create index if not exists idx_projects_client on public.projects (client_id);
create index if not exists idx_project_members_project on public.project_members (project_id);
create index if not exists idx_project_members_freelancer on public.project_members (freelancer_id);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);

-- ---- Security-definer helpers ------------------------------------------------
-- Used inside RLS policies to check project membership WITHOUT re-triggering
-- RLS on the referenced table (which would cause infinite policy recursion
-- between projects and project_members).
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = p_project_id and pm.freelancer_id = auth.uid()
  );
$$;

create or replace function public.is_project_client(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.client_id = auth.uid()
  );
$$;

-- ---- Row Level Security ------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.freelancers enable row level security;
alter table public.jobs enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.bids enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;

-- profiles: publicly readable (marketplace directory); writable only by owner.
-- NOTE: this exposes the `email` column to any reader. Before production,
-- move PII behind a restricted view or column-level protection.
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select using (true);
drop policy if exists "profiles insert self" on public.profiles;
create policy "profiles insert self" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- freelancers: publicly readable; writable only by owner.
drop policy if exists "freelancers readable" on public.freelancers;
create policy "freelancers readable" on public.freelancers for select using (true);
drop policy if exists "freelancers insert self" on public.freelancers;
create policy "freelancers insert self" on public.freelancers for insert with check (auth.uid() = id);
drop policy if exists "freelancers update self" on public.freelancers;
create policy "freelancers update self" on public.freelancers for update using (auth.uid() = id) with check (auth.uid() = id);

-- jobs: open jobs are public; owners see and manage their own (incl. drafts).
drop policy if exists "jobs readable" on public.jobs;
create policy "jobs readable" on public.jobs for select using (status = 'open' or auth.uid() = client_id);
drop policy if exists "jobs insert own" on public.jobs;
create policy "jobs insert own" on public.jobs for insert with check (auth.uid() = client_id);
drop policy if exists "jobs update own" on public.jobs;
create policy "jobs update own" on public.jobs for update using (auth.uid() = client_id) with check (auth.uid() = client_id);
drop policy if exists "jobs delete own" on public.jobs;
create policy "jobs delete own" on public.jobs for delete using (auth.uid() = client_id);

-- projects: visible to the client and assigned members.
drop policy if exists "projects readable" on public.projects;
create policy "projects readable" on public.projects for select
  using (auth.uid() = client_id or public.is_project_member(id));
drop policy if exists "projects insert own" on public.projects;
create policy "projects insert own" on public.projects for insert with check (auth.uid() = client_id);
drop policy if exists "projects update own" on public.projects;
create policy "projects update own" on public.projects for update using (auth.uid() = client_id) with check (auth.uid() = client_id);

-- project_members: visible to the freelancer themselves and the project client.
drop policy if exists "project_members readable" on public.project_members;
create policy "project_members readable" on public.project_members for select
  using (auth.uid() = freelancer_id or public.is_project_client(project_id));
drop policy if exists "project_members managed by client" on public.project_members;
create policy "project_members managed by client" on public.project_members for all
  using (public.is_project_client(project_id))
  with check (public.is_project_client(project_id));

-- bids: visible to the bidding freelancer and the job's client; freelancers
-- create their own bids; both parties may update (e.g. accept/reject).
drop policy if exists "bids readable" on public.bids;
create policy "bids readable" on public.bids for select
  using (
    auth.uid() = freelancer_id
    or auth.uid() = (select j.client_id from public.jobs j where j.id = bids.job_id)
  );
drop policy if exists "bids insert own" on public.bids;
create policy "bids insert own" on public.bids for insert with check (auth.uid() = freelancer_id);
drop policy if exists "bids update parties" on public.bids;
create policy "bids update parties" on public.bids for update
  using (
    auth.uid() = freelancer_id
    or auth.uid() = (select j.client_id from public.jobs j where j.id = bids.job_id)
  );

-- reviews: publicly readable; written by the reviewing client.
drop policy if exists "reviews readable" on public.reviews;
create policy "reviews readable" on public.reviews for select using (true);
drop policy if exists "reviews insert own" on public.reviews;
create policy "reviews insert own" on public.reviews for insert with check (auth.uid() = client_id);

-- notifications: private to the recipient.
drop policy if exists "notifications readable" on public.notifications;
create policy "notifications readable" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- End of migration 0001
-- ============================================================================
