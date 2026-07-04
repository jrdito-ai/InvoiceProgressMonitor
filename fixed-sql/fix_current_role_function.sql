-- ===========================================================================
-- FIX: current_role() returning NULL and editor permission denied
-- Execute in Supabase SQL Editor
-- ===========================================================================

-- 1. Make current_role() robust: never return NULL
create or replace function public.current_role()
returns text language sql security definer set search_path = public as $$
  select coalesce(
    (
      select p.role::text
      from public.profiles p
      where p.id = auth.uid()
      limit 1
    ),
    'viewer'
  )
$$;

-- 2. Make auto-profile creation explicit and idempotent
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, departemen)
  values (new.id, new.email, new.email, 'viewer', null)
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end $$;

-- 3. Repair the specific editor profile used for testing
update public.profiles
set role = 'editor'
where email = 'dept.ei@adhi.co.id';

-- 4. Re-assert that editor has access to their department data
--    No data change here, just sanity check query for the operator.
select email, role, departemen
from public.profiles
where email = 'dept.ei@adhi.co.id';

-- 5. Optional verification after login as that user:
-- select public.current_role();
