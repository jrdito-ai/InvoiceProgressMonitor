-- ===========================================================================
-- FIX: permission denied for table users on monthly_status updates
-- Root cause: ms_before_write() queried auth.users without SECURITY DEFINER
-- Execute in Supabase SQL Editor
-- ===========================================================================

create or replace function public.ms_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.version := coalesce(old.version, 0) + 1;
  new.updated_at := now();
  new.updated_by := coalesce(
    (select email from public.profiles where id = auth.uid()),
    new.updated_by
  );
  return new;
end $$;

-- Recreate trigger to ensure it uses the updated function body
drop trigger if exists trg_ms_before_write on public.monthly_status;
create trigger trg_ms_before_write
  before insert or update on public.monthly_status
  for each row execute function public.ms_before_write();
