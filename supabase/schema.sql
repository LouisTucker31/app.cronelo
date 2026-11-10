-- Cronelo: the database behind the app (Supabase / Postgres).
--
-- Each signed-in person's saved data lives in user_data, one row per item the app keeps:
-- the project list, each project's plan, tags, templates, notes and their profile. The
-- `key` is the same name the app uses in the browser (e.g. roadmapProjects,
-- roadmapPlan:<project id>) and `value` is that item as JSON.
--
-- Row level security means each person can only read and change their own rows; signed-out
-- visitors can't touch the table at all. Sharing projects with other people later would
-- add tables alongside this one.

create table if not exists public.user_data (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner, key)
);

alter table public.user_data enable row level security;

drop policy if exists "Read your own data" on public.user_data;
create policy "Read your own data" on public.user_data
  for select to authenticated using (owner = (select auth.uid()));

drop policy if exists "Add your own data" on public.user_data;
create policy "Add your own data" on public.user_data
  for insert to authenticated with check (owner = (select auth.uid()));

drop policy if exists "Change your own data" on public.user_data;
create policy "Change your own data" on public.user_data
  for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

drop policy if exists "Remove your own data" on public.user_data;
create policy "Remove your own data" on public.user_data
  for delete to authenticated using (owner = (select auth.uid()));

-- Limits on what a row can hold: only the item names the app uses, and at most 1MB of JSON per
-- item (a large plan is a few hundred KB). Stops one account filling the database. js/cloud.js
-- keeps anything near the limit in the browser rather than sending it.
alter table public.user_data drop constraint if exists user_data_key_name;
alter table public.user_data add constraint user_data_key_name
  check (key ~ '^roadmap(Projects|Tags|Templates|Notes|Profile|Plan(:.{1,200})?)$');

alter table public.user_data drop constraint if exists user_data_value_size;
alter table public.user_data add constraint user_data_value_size
  check (octet_length(value::text) <= 1048576);

revoke all on public.user_data from anon;
grant select, insert, update, delete on public.user_data to authenticated;


-- Deleting your account (Profile → Delete account). The browser can't remove a sign-in itself,
-- so this runs with the database's own rights, and only ever on the caller's own account.
-- Removing the auth.users row removes their user_data and app_errors rows too (on delete cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;


-- Error reports: when the app hits an error in someone's browser, js/cloud.js sends a short
-- note here (the message, where in the code, the page and browser; never their plans). Read them
-- in the Supabase dashboard: Table Editor → app_errors. People can add reports but not read them.
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  owner uuid default auth.uid() references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  message text not null check (char_length(message) <= 1000),
  source text check (char_length(source) <= 500),
  stack text check (char_length(stack) <= 4000),
  page text check (char_length(page) <= 500),
  agent text check (char_length(agent) <= 400)
);

create index if not exists app_errors_at on public.app_errors (at);
create index if not exists app_errors_owner_at on public.app_errors (owner, at);

alter table public.app_errors enable row level security;

drop policy if exists "Report an error" on public.app_errors;
create policy "Report an error" on public.app_errors
  for insert to authenticated with check (owner = (select auth.uid()));

revoke all on public.app_errors from anon, authenticated;
grant insert on public.app_errors to authenticated;

-- Keep the table small and tidy: reports older than 90 days are cleared as new ones arrive (the
-- privacy policy says 90 days), and one account can send at most 200 a day.
create or replace function public.app_errors_tidy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.app_errors
      where owner = new.owner and at > now() - interval '1 day') >= 200 then
    return null; -- quietly dropped
  end if;
  delete from public.app_errors where at < now() - interval '90 days';
  return new;
end;
$$;

drop trigger if exists app_errors_tidy on public.app_errors;
create trigger app_errors_tidy before insert on public.app_errors
  for each row execute function public.app_errors_tidy();
