-- ============================================================================
-- User sessions tracking for Invoice Progress Monitor
-- Allows multiple concurrent sessions per user.
-- Sessions are removed after 35 minutes of inactivity.
-- ============================================================================

create table if not exists public.user_sessions (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role app_role not null,
  departemen text,
  current_page text,
  session_token text not null unique,
  last_activity timestamp with time zone not null default now(),
  logged_in_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_user_sessions_last_activity on public.user_sessions (last_activity desc);
create index if not exists idx_user_sessions_user_id on public.user_sessions (user_id);
create index if not exists idx_user_sessions_email on public.user_sessions (email);

create or replace function public.user_sessions_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_user_sessions_before_write on public.user_sessions;
create trigger trg_user_sessions_before_write
before insert or update on public.user_sessions
for each row execute function public.user_sessions_before_write();

create or replace function public.cleanup_stale_sessions()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.user_sessions
  where last_activity < now() - interval '35 minutes';
end $$;

drop trigger if exists trg_cleanup_stale_sessions on public.user_sessions;
create trigger trg_cleanup_stale_sessions
after insert or update on public.user_sessions
for each statement execute function public.cleanup_stale_sessions();

alter table public.user_sessions enable row level security;

drop policy if exists "Admin view all sessions" on public.user_sessions;
create policy "Admin view all sessions"
  on public.user_sessions for select
  using (public.current_role() = 'admin');

drop policy if exists "Users view own sessions" on public.user_sessions;
create policy "Users view own sessions"
  on public.user_sessions for select
  using (user_id = auth.uid());

drop policy if exists "Users insert own sessions" on public.user_sessions;
create policy "Users insert own sessions"
  on public.user_sessions for insert
  with check (user_id = auth.uid());

drop policy if exists "Users update own sessions" on public.user_sessions;
create policy "Users update own sessions"
  on public.user_sessions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users delete own sessions" on public.user_sessions;
create policy "Users delete own sessions"
  on public.user_sessions for delete
  using (user_id = auth.uid());
