-- ============================================================================
-- 0007_auth_trigger.sql
-- Auto-provision a public.profiles row (and a freelancers row for freelancer
-- sign-ups) whenever a new auth user is created. Runs after 0001/0006 so all
-- columns and enums exist.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_name text;
  meta_role text;
begin
  meta_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  meta_role := lower(coalesce(new.raw_user_meta_data->>'role', 'client'));
  if meta_role not in ('client', 'freelancer') then
    meta_role := 'client';
  end if;

  insert into public.profiles (id, email, name, role)
  values (new.id, new.email, meta_name, meta_role::user_role)
  on conflict (id) do nothing;

  -- Freelancers get a freelancer profile row too.
  if meta_role = 'freelancer' then
    insert into public.freelancers (id, title, bio)
    values (new.id, meta_name, '')
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- End of migration 0007
-- ============================================================================
