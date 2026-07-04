-- ===========================================================================
-- SCHEMA CHANGE: Add nilai_progress submit & approval tracking
-- Execute in Supabase SQL Editor
-- ===========================================================================

-- 1. Add 6 new columns to monthly_status
ALTER TABLE public.monthly_status ADD COLUMN IF NOT EXISTS
  nilai_progress_submitted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.monthly_status ADD COLUMN IF NOT EXISTS
  nilai_progress_submitted_by TEXT;
ALTER TABLE public.monthly_status ADD COLUMN IF NOT EXISTS
  nilai_progress_submitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.monthly_status ADD COLUMN IF NOT EXISTS
  nilai_progress_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE public.monthly_status ADD COLUMN IF NOT EXISTS
  nilai_progress_approved_by TEXT;
ALTER TABLE public.monthly_status ADD COLUMN IF NOT EXISTS
  nilai_progress_approved_at TIMESTAMP WITH TIME ZONE;

-- 2. Update ms_audit() trigger to include nilai_progress in tracked fields
drop trigger if exists trg_ms_audit on public.monthly_status;

create or replace function public.ms_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_col text;
  v_old text;
  v_new text;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  foreach v_col in array array[
    'nilai_progress',
    'opname','bapp','submit_invoice','correct_invoice','piutang_usaha',
    'target_konversi_pu','ket_konversi_pu','target_cash_in','ket_cash_in'
  ] loop
    v_old := case when tg_op='UPDATE' then 
      (row_to_json(old) ->> v_col) 
    end;
    v_new := (row_to_json(new) ->> v_col);
    
    if v_old is distinct from v_new then
      insert into public.audit_log (no_project, periode, field_changed, old_value, new_value, changed_by)
      values (new.no_project, new.periode, v_col, v_old, v_new, new.updated_by);
    end if;
  end loop;

  return new;
end $$;

create trigger trg_ms_audit
  after insert or update on public.monthly_status
  for each row execute function public.ms_audit();

-- 3. RLS Policy: Editor can update invoice in their department
--    Nilai_progress lock handled by trigger, not RLS
drop policy if exists "Editor cannot edit nilai_progress after submit" on public.monthly_status;
drop policy if exists "Editor/Viewer edit invoice di dept-nya" on public.monthly_status;

create policy "Editor/Viewer edit invoice di dept-nya"
  on public.monthly_status for update
  using (
    public.current_role() = 'admin' or
    (public.current_role() = 'editor' and
     no_project in (
       select no_project from public.projects
       where departemen = (select departemen from public.profiles where id = auth.uid())
     ))
  )
  with check (true);

-- 4. BEFORE UPDATE trigger to lock nilai_progress after submission
create or replace function public.ms_lock_nilai_progress()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.nilai_progress_submitted = true and public.current_role() = 'editor' then
    new.nilai_progress := old.nilai_progress;
  end if;
  return new;
end $$;

drop trigger if exists trg_ms_lock_nilai on public.monthly_status;
create trigger trg_ms_lock_nilai
  before update on public.monthly_status
  for each row execute function public.ms_lock_nilai_progress();
