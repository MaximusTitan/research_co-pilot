-- Research Mate database schema.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- profiles: one row per account, created automatically on sign-up.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- projects: a student's research project. The whole project document
-- (angles, sources, notes, sections, drafts) is stored in `data`.
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id         text primary key check (char_length(id) between 1 and 64),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic      text not null check (char_length(topic) <= 500),
  data       jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 2000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_updated_idx on public.projects (user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Keep updated_at current on every change.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- A project always belongs to whoever is signed in; the browser can't pick
-- another owner on insert or move a project to someone else on update.
-- ---------------------------------------------------------------------------
create or replace function public.projects_lock_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.created_at := now();
  else
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_lock_owner on public.projects;
create trigger projects_lock_owner
  before insert or update on public.projects
  for each row execute function public.projects_lock_owner();

-- ---------------------------------------------------------------------------
-- Create a profile when someone signs up, using the name from the sign-up form.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security: each user can only see and change their own rows.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;

-- Only what the app needs: guests get nothing, and a profile's name is the only editable field.
revoke all on public.profiles from anon, authenticated;
revoke all on public.projects from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "projects: read own" on public.projects;
create policy "projects: read own" on public.projects
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "projects: insert own" on public.projects;
create policy "projects: insert own" on public.projects
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "projects: update own" on public.projects;
create policy "projects: update own" on public.projects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "projects: delete own" on public.projects;
create policy "projects: delete own" on public.projects
  for delete to authenticated
  using ((select auth.uid()) = user_id);
