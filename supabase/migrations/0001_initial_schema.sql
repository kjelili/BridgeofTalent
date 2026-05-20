-- ============================================================================
-- BridgeofTalent — Initial database schema (Supabase / PostgreSQL)
-- ============================================================================
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- It is idempotent-ish: it creates types/tables only if absent. Review before
-- running in an environment that already has data.
--
-- Supabase provides auth.users (email + securely hashed password) out of the
-- box. We never store raw passwords. `profiles` extends auth.users 1:1.
-- ============================================================================

-- ---- Enums -----------------------------------------------------------------
do $$ begin
  create type user_role as enum ('freelancer', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_status as enum ('open', 'closed', 'draft');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bid_status as enum ('pending', 'accepted', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum ('active', 'completed', 'disputed');
exception when duplicate_object then null; end $$;

-- ---- profiles (extends auth.users 1:1) -------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  name        text not null default 'User',
  role        user_role not null default 'freelancer',
  company     text default '',
  created_at  timestamptz not null default now()
);

-- ---- freelancers (1:1 with a profile whose role = 'freelancer') -------------
create table if not exists public.freelancers (
  id                uuid primary key references public.profiles (id) on delete cascade,
  title             text default 'Freelancer',
  location          text default '',
  hourly_rate       numeric(10,2) not null default 50,
  rating            numeric(3,2) not null default 0,
  review_count      integer not null default 0,
  skills            text[] not null default '{}',
  verified_skills   text[] not null default '{}',
  bio               text default '',
  status            text not null default 'available',  -- available | busy
  avatar            text default '',
  identity_verified boolean not null default false,
  top_rated         boolean not null default false,
  created_at        timestamptz not null default now()
);

-- ---- portfolio_items -------------------------------------------------------
create table if not exists public.portfolio_items (
  id            uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references public.freelancers (id) on delete cascade,
  title         text not null,
  description   text default '',
  link          text default '',
  image_url     text,
  created_at    timestamptz not null default now()
);

-- ---- jobs ------------------------------------------------------------------
create table if not exists public.jobs (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles (id) on delete cascade,
  client_name  text not null,
  title        text not null,
  description  text not null default '',
  skills       text[] not null default '{}',
  budget_min   numeric(12,2) not null default 0,
  budget_max   numeric(12,2) not null default 0,
  budget_type  text not null default 'fixed',           -- fixed | hourly
  category     text default 'Other',
  location     text default 'Remote',
  team_size    integer not null default 1,
  status       job_status not null default 'open',
  deadline     timestamptz,
  created_at   timestamptz not null default now()
);

-- ---- bids ------------------------------------------------------------------
create table if not exists public.bids (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.jobs (id) on delete cascade,
  freelancer_id   uuid not null references public.freelancers (id) on delete cascade,
  freelancer_name text not null,
  amount          numeric(12,2) not null default 0,
  message         text default '',
  timeline        text default '',
  status          bid_status not null default 'pending',
  created_at      timestamptz not null default now(),
  unique (job_id, freelancer_id)   -- enforce one bid per freelancer per job
);

-- ---- projects --------------------------------------------------------------
create table if not exists public.projects (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.profiles (id) on delete cascade,
  client_name      text not null,
  title            text not null,
  description      text default '',
  budget           numeric(12,2) not null default 0,
  category         text default 'Other',
  status           project_status not null default 'active',
  escrow_released  boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ---- project_members (join: projects <-> freelancers) ----------------------
create table if not exists public.project_members (
  project_id    uuid not null references public.projects (id) on delete cascade,
  freelancer_id uuid not null references public.freelancers (id) on delete cascade,
  primary key (project_id, freelancer_id)
);

-- ---- reviews ---------------------------------------------------------------
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references public.freelancers (id) on delete cascade,
  client_id     uuid not null references public.profiles (id) on delete cascade,
  client_name   text not null,
  rating        integer not null check (rating between 1 and 5),
  comment       text default '',
  created_at    timestamptz not null default now()
);

-- ---- conversations + messages ---------------------------------------------
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  primary key (conversation_id, profile_id)
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  text            text not null,
  created_at      timestamptz not null default now()
);

-- ---- notifications ---------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,
  title       text not null,
  message     text default '',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---- Auto-create a profile row when a new auth user signs up ---------------
-- The signup call passes name/role/company in user_metadata; this trigger
-- copies them into public.profiles so the app always has a profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, company)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', 'User'),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'freelancer'),
    coalesce(new.raw_user_meta_data ->> 'company', '')
  );

  -- If they registered as a freelancer, seed an empty freelancer row.
  if coalesce(new.raw_user_meta_data ->> 'role', 'freelancer') = 'freelancer' then
    insert into public.freelancers (id, avatar)
    values (new.id, upper(left(coalesce(new.raw_user_meta_data ->> 'name', 'U'), 2)));
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Row-Level Security (RLS)
-- ----------------------------------------------------------------------------
-- Public marketplace data (freelancers, jobs, reviews, portfolios) is readable
-- by anyone. Writes are restricted to the owning user. Messages/notifications
-- are private to their participants/owner.
-- ============================================================================

alter table public.profiles               enable row level security;
alter table public.freelancers             enable row level security;
alter table public.portfolio_items         enable row level security;
alter table public.jobs                    enable row level security;
alter table public.bids                    enable row level security;
alter table public.projects                enable row level security;
alter table public.project_members         enable row level security;
alter table public.reviews                 enable row level security;
alter table public.conversations           enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                enable row level security;
alter table public.notifications           enable row level security;

-- profiles: anyone can read; you can update only your own.
create policy "profiles readable"     on public.profiles for select using (true);
create policy "update own profile"    on public.profiles for update using (auth.uid() = id);

-- freelancers: public read; owner write.
create policy "freelancers readable"  on public.freelancers for select using (true);
create policy "manage own freelancer" on public.freelancers for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- portfolio: public read; owner write.
create policy "portfolio readable"    on public.portfolio_items for select using (true);
create policy "manage own portfolio"  on public.portfolio_items for all
  using (auth.uid() = freelancer_id) with check (auth.uid() = freelancer_id);

-- jobs: public read; only the client who owns it can write.
create policy "jobs readable"         on public.jobs for select using (true);
create policy "client manages jobs"   on public.jobs for all
  using (auth.uid() = client_id) with check (auth.uid() = client_id);

-- bids: readable by the bidding freelancer and the job's client.
create policy "bids visible to parties" on public.bids for select using (
  auth.uid() = freelancer_id
  or auth.uid() = (select client_id from public.jobs j where j.id = job_id)
);
create policy "freelancer creates bid"  on public.bids for insert
  with check (auth.uid() = freelancer_id);
create policy "parties update bid"      on public.bids for update using (
  auth.uid() = freelancer_id
  or auth.uid() = (select client_id from public.jobs j where j.id = job_id)
);

-- projects: public read (portfolio of work); client write.
create policy "projects readable"     on public.projects for select using (true);
create policy "client manages project" on public.projects for all
  using (auth.uid() = client_id) with check (auth.uid() = client_id);

create policy "project members readable" on public.project_members for select using (true);
create policy "client manages members"   on public.project_members for all using (
  auth.uid() = (select client_id from public.projects p where p.id = project_id)
) with check (
  auth.uid() = (select client_id from public.projects p where p.id = project_id)
);

-- reviews: public read; only a client who wrote it can manage it.
create policy "reviews readable"      on public.reviews for select using (true);
create policy "client writes review"  on public.reviews for insert
  with check (auth.uid() = client_id);

-- conversations / messages: only participants.
create policy "see own conversations" on public.conversations for select using (
  exists (select 1 from public.conversation_participants cp
          where cp.conversation_id = id and cp.profile_id = auth.uid())
);
create policy "create conversation"   on public.conversations for insert with check (true);

create policy "see own participation" on public.conversation_participants for select
  using (profile_id = auth.uid()
         or exists (select 1 from public.conversation_participants cp
                    where cp.conversation_id = conversation_id and cp.profile_id = auth.uid()));
create policy "add participation"     on public.conversation_participants for insert
  with check (true);

create policy "read messages in own convos" on public.messages for select using (
  exists (select 1 from public.conversation_participants cp
          where cp.conversation_id = conversation_id and cp.profile_id = auth.uid())
);
create policy "send message if participant" on public.messages for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conversation_id and cp.profile_id = auth.uid())
);

-- notifications: private to the owner.
create policy "see own notifications"    on public.notifications for select
  using (auth.uid() = user_id);
create policy "update own notifications" on public.notifications for update
  using (auth.uid() = user_id);
create policy "insert notification"      on public.notifications for insert
  with check (true);

-- ---- Helpful indexes -------------------------------------------------------
create index if not exists idx_jobs_status      on public.jobs (status);
create index if not exists idx_jobs_client      on public.jobs (client_id);
create index if not exists idx_bids_job         on public.bids (job_id);
create index if not exists idx_bids_freelancer  on public.bids (freelancer_id);
create index if not exists idx_reviews_freelancer on public.reviews (freelancer_id);
create index if not exists idx_messages_convo   on public.messages (conversation_id);
create index if not exists idx_notif_user       on public.notifications (user_id);

-- ============================================================================
-- End of migration 0001
-- ============================================================================
