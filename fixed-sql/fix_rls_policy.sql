-- ===========================================================================
-- FIX RLS POLICY: Restore editor access + block nilai_progress via trigger
-- Execute in Supabase SQL Editor
-- ===========================================================================

-- 1. Drop the problematic policy (the one that blocks all editor updates)
DROP POLICY IF EXISTS "Editor cannot edit nilai_progress after submit"
  ON public.monthly_status;

-- 2. Drop existing update policy to recreate it cleanly
DROP POLICY IF EXISTS "Editor/Viewer edit invoice di dept-nya"
  ON public.monthly_status;

-- 3. Recreate permissive update policy (same as original schema)
--    Editor can update any row in their department
--    RLS does NOT check nilai_progress — that's handled by trigger below
CREATE POLICY "Editor/Viewer edit invoice di dept-nya"
  ON public.monthly_status FOR UPDATE
  USING (
    public.current_role() = 'admin' OR
    (public.current_role() = 'editor' AND
     no_project IN (
       SELECT no_project FROM public.projects
       WHERE departemen = (SELECT departemen FROM public.profiles WHERE id = auth.uid())
     ))
  )
  WITH CHECK (true);

-- 4. Add BEFORE UPDATE trigger to lock nilai_progress after submission
--    If nilai_progress_submitted = true, editor cannot change nilai_progress
--    Admin can always change anything
CREATE OR REPLACE FUNCTION public.ms_lock_nilai_progress()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- If editor already submitted, block further changes to nilai_progress
  IF OLD.nilai_progress_submitted = TRUE AND public.current_role() = 'editor' THEN
    -- Revert nilai_progress to old value (force no change)
    NEW.nilai_progress := OLD.nilai_progress;
  END IF;
  RETURN NEW;
END $$;

-- 5. Drop old trigger if exists, then create new one
DROP TRIGGER IF EXISTS trg_ms_lock_nilai ON public.monthly_status;
CREATE TRIGGER trg_ms_lock_nilai
  BEFORE UPDATE ON public.monthly_status
  FOR EACH ROW EXECUTE FUNCTION public.ms_lock_nilai_progress();
