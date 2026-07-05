-- ============================================================================
-- Grant read-only cross-department visibility to dept.oc@adhi.co.id
-- Keeps insert/update/delete restricted to admin/editor only.
-- ============================================================================

-- Projects: allow this viewer to see all departments
drop policy if exists "User lihat proyek di dept-nya" on public.projects;
create policy "User lihat proyek di dept-nya"
  on public.projects for select
  using (
    public.current_role() = 'admin'
    or departemen = (select departemen from public.profiles where id = auth.uid())
    or (select email from public.profiles where id = auth.uid()) = 'dept.oc@adhi.co.id'
  );

-- Monthly status: allow this viewer to read all departments
drop policy if exists "User lihat invoice di dept-nya" on public.monthly_status;
create policy "User lihat invoice di dept-nya"
  on public.monthly_status for select
  using (
    public.current_role() = 'admin'
    or no_project in (
      select no_project
      from public.projects
      where departemen = (select departemen from public.profiles where id = auth.uid())
    )
    or (select email from public.profiles where id = auth.uid()) = 'dept.oc@adhi.co.id'
  );

-- Audit log: allow this viewer to read all departments
drop policy if exists "User lihat audit log di dept-nya" on public.audit_log;
create policy "User lihat audit log di dept-nya"
  on public.audit_log for select
  using (
    public.current_role() = 'admin'
    or no_project in (
      select no_project
      from public.projects
      where departemen = (select departemen from public.profiles where id = auth.uid())
    )
    or (select email from public.profiles where id = auth.uid()) = 'dept.oc@adhi.co.id'
  );
