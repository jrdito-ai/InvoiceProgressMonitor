-- ==============================================================================
--  COMPLETE SCHEMA — Invoice Progress Monitor
--  Includes all brainstorming decisions:
--  - Multi-invoice per bulan (invoice_seq)
--  - Marginal model (pct_termin + pct_termin_cumul)
--  - 5 payment types (monthly, termin, progress_payment, milestone, turnkey)
--  - Departemen filter (1 user = 1 dept)
--  - Audit trail + optimistic locking
--  - RLS security
--
--  JALANKAN URUT:
--  1. Types
--  2. Tables
--  3. Indexes
--  4. Functions
--  5. Triggers
--  6. RLS Policies
--  7. Views
--
-- ==============================================================================

-- ===== 1. TYPES =====

create type app_role as enum ('admin', 'editor', 'viewer');

-- ===== 2. TABLES =====

-- 2a. Profiles (dari auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role app_role not null default 'viewer',
  departemen text,  -- NEW: 1 user = 1 dept; NULL untuk admin (akses semua)
  created_at timestamp with time zone default now()
);

-- 2b. Projects (master)
create table if not exists public.projects (
  no_project text primary key,
  nama_project text not null,
  departemen text not null,
  profit_center text,
  payment_type text not null default 'monthly'
    check (payment_type in ('monthly','termin','progress_payment','milestone','turnkey')),
  contract_value numeric check (contract_value > 0),
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- 2c. Monthly Status (billing events — termasuk monthly, termin, milestone, dll)
create table if not exists public.monthly_status (
  id bigint primary key generated always as identity,
  no_project text not null references projects(no_project),
  periode date not null,  -- tgl 1 tiap bulan
  event_type text not null default 'monthly'
    check (event_type in ('monthly','termin','progress_payment','milestone','turnkey')),
  
  -- NEW: invoice_seq — bedain multiple invoice per bulan/proyek
  invoice_seq integer not null default 1,
  
  invoice_label text,  -- label untuk invoice/manual row
  
  -- Nilai progress (gross, sebelum potongan)
  nilai_progress numeric check (nilai_progress > 0),
  nilai_progress_submitted boolean default false,
  nilai_progress_submitted_by text,
  nilai_progress_submitted_at timestamp with time zone,
  nilai_progress_approved boolean default false,
  nilai_progress_approved_by text,
  nilai_progress_approved_at timestamp with time zone,
  
  -- Marginal model: progres TAHAP INI (bukan total)
  pct_termin numeric check (pct_termin > 0 and pct_termin <= 100),
  
  -- Otomatis dihitung, read-only
  pct_termin_cumul numeric check (pct_termin_cumul >= 0 and pct_termin_cumul <= 100),
  
  -- Pipeline stages
  opname text check (opname in ('Done','Not Done')),
  bapp text check (bapp in ('Done','Not Done')),
  submit_invoice text check (submit_invoice in ('Done','Not Done')),
  correct_invoice text check (correct_invoice in ('Done','Not Done')),
  piutang_usaha text check (piutang_usaha in ('Done','Not Done')),
  
  -- Targets
  target_konversi_pu date,
  ket_konversi_pu text,
  target_cash_in date,
  ket_cash_in text,
  
  -- Audit
  version integer not null default 1,
  updated_by text,
  updated_at timestamp with time zone,
  
  created_at timestamp with time zone default now(),
  
  unique (no_project, periode, event_type, invoice_seq),  -- NEW: multi-invoice support
  
  constraint chk_event_has_label
    check (
      event_type = 'monthly'
      or (
        event_type in ('termin','progress_payment','milestone','turnkey')
        and invoice_label is not null
        and btrim(invoice_label) <> ''
      )
    ),

  constraint chk_pct_termin_optional
    check (pct_termin is null or (pct_termin > 0 and pct_termin <= 100))
);

-- 2d. Audit Log
create table if not exists public.audit_log (
  id bigint primary key generated always as identity,
  no_project text,
  periode date,
  field_changed text not null,
  old_value text,
  new_value text,
  changed_by text,
  changed_at timestamp with time zone default now()
);

-- ===== 3. INDEXES =====

create index if not exists idx_ms_periode on public.monthly_status (periode);
create index if not exists idx_ms_project on public.monthly_status (no_project);
create index if not exists idx_audit_project on public.audit_log (no_project, periode);

-- ===== 4. FUNCTIONS =====

-- 4a. Helper: current_role() — dapatkan role user saat ini
create or replace function public.current_role()
returns text language sql security definer as $$
  select role::text from public.profiles where id = auth.uid()
$$;

-- 4b. Helper: handle_new_user — auto-create profile saat user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.email, 'viewer');
  return new;
end $$;

-- 4c. Before write trigger — auto-increment version, set updated_at/by
create or replace function public.ms_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.version := coalesce(old.version, 0) + 1;
  new.updated_at := now();
  new.updated_by := coalesce((select email from public.profiles where id = auth.uid()), new.updated_by);
  return new;
end $$;

-- 4d. After write trigger — log ke audit_log
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
    'opname','bapp','submit_invoice','correct_invoice','piutang_usaha',
    'target_konversi_pu','ket_konversi_pu','target_cash_in','ket_cash_in'
  ] loop
    v_old := (case when tg_op='UPDATE' then (old #>> ('{' || v_col || '}')) end);
    v_new := (new #>> ('{' || v_col || '}'));
    if v_old is distinct from v_new then
      insert into public.audit_log (no_project, periode, field_changed, old_value, new_value, changed_by)
      values (new.no_project, new.periode, v_col, v_old, v_new, new.updated_by);
    end if;
  end loop;

  return new;
end $$;

-- 4e. Compute pct_termin_cumul otomatis (marginal model safety)
create or replace function public.compute_pct_termin_cumul()
returns trigger language plpgsql as $$
declare
  v_cumul numeric;
begin
  if new.event_type in ('termin','progress_payment','milestone','turnkey') and new.pct_termin is not null then
    select coalesce(sum(pct_termin), 0) into v_cumul
    from public.monthly_status
    where no_project = new.no_project
      and event_type = new.event_type
      and periode <= new.periode
      and (id != new.id or new.id is null);

    v_cumul := v_cumul + new.pct_termin;
    new.pct_termin_cumul := v_cumul;

    if v_cumul > 100 then
      raise exception
        'Progres kumulatif proyek % jadi %.0f%% (> 100%%). Cek pct_termin tahap-tahap sebelumnya.',
        new.no_project, v_cumul;
    end if;
  end if;
  return new;
end $$;

-- 4f. RPC: generate_period — bikin monthly invoice buat bulan tertentu
drop function if exists public.generate_period(date, boolean);

-- ===== 5. TRIGGERS =====

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists trg_ms_before_write on public.monthly_status;
create trigger trg_ms_before_write
  before insert or update on public.monthly_status
  for each row execute function public.ms_before_write();

drop trigger if exists trg_ms_audit on public.monthly_status;
create trigger trg_ms_audit
  after insert or update on public.monthly_status
  for each row execute function public.ms_audit();

drop trigger if exists trg_compute_pct_cumul on public.monthly_status;
create trigger trg_compute_pct_cumul
  before insert or update on public.monthly_status
  for each row execute function public.compute_pct_termin_cumul();

-- ===== 6. RLS POLICIES =====

-- 6a. Profiles RLS
alter table public.profiles enable row level security;

drop policy if exists "Users dapat lihat profil sendiri" on public.profiles;
create policy "Users dapat lihat profil sendiri"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Admin dapat lihat semua profil" on public.profiles;
create policy "Admin dapat lihat semua profil"
  on public.profiles for select
  using (public.current_role() = 'admin');

drop policy if exists "Admin dapat update role" on public.profiles;
create policy "Admin dapat update role"
  on public.profiles for update
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- 6b. Projects RLS
alter table public.projects enable row level security;

drop policy if exists "Admin akses semua proyek" on public.projects;
create policy "Admin akses semua proyek"
  on public.projects for all
  using (public.current_role() = 'admin');

drop policy if exists "User lihat proyek di dept-nya" on public.projects;
create policy "User lihat proyek di dept-nya"
  on public.projects for select
  using (
    departemen = (select departemen from public.profiles where id = auth.uid())
  );

-- 6c. Monthly Status RLS
alter table public.monthly_status enable row level security;

drop policy if exists "Admin akses semua" on public.monthly_status;
create policy "Admin akses semua"
  on public.monthly_status for all
  using (public.current_role() = 'admin');

drop policy if exists "User lihat invoice di dept-nya" on public.monthly_status;
create policy "User lihat invoice di dept-nya"
  on public.monthly_status for select
  using (
    public.current_role() = 'admin' or
    no_project in (
      select no_project from public.projects
      where departemen = (select departemen from public.profiles where id = auth.uid())
    )
  );

drop policy if exists "Editor/Viewer edit invoice di dept-nya" on public.monthly_status;
create policy "Editor/Viewer edit invoice di dept-nya"
  on public.monthly_status for update
  using (
    public.current_role() in ('admin','editor') and
    (
      public.current_role() = 'admin' or
      no_project in (
        select no_project from public.projects
        where departemen = (select departemen from public.profiles where id = auth.uid())
      )
    )
  )
  with check (true);

drop policy if exists "Editor insert invoice di dept-nya" on public.monthly_status;
create policy "Editor insert invoice di dept-nya"
  on public.monthly_status for insert
  with check (
    public.current_role() in ('admin','editor') and
    (
      public.current_role() = 'admin' or
      no_project in (
        select no_project from public.projects
        where departemen = (select departemen from public.profiles where id = auth.uid())
      )
    )
  );

drop policy if exists "Editor delete invoice di dept-nya" on public.monthly_status;
create policy "Editor delete invoice di dept-nya"
  on public.monthly_status for delete
  using (
    public.current_role() = 'admin' or
    (
      public.current_role() = 'editor' and
      no_project in (
        select no_project from public.projects
        where departemen = (select departemen from public.profiles where id = auth.uid())
      )
    )
  );

-- 6d. Audit Log RLS
alter table public.audit_log enable row level security;

drop policy if exists "User lihat audit log di dept-nya" on public.audit_log;
create policy "User lihat audit log di dept-nya"
  on public.audit_log for select
  using (
    public.current_role() = 'admin' or
    no_project in (
      select no_project from public.projects
      where departemen = (select departemen from public.profiles where id = auth.uid())
    )
  );

-- ===== 7. VIEWS =====

create or replace view public.v_monthly_progress as
select
  m.id, m.periode, m.no_project, m.event_type, m.no_termin,
  m.invoice_seq, m.nilai_progress,
  m.nilai_progress_submitted, m.nilai_progress_submitted_by, m.nilai_progress_submitted_at,
  m.nilai_progress_approved, m.nilai_progress_approved_by, m.nilai_progress_approved_at,
  m.pct_termin, m.pct_termin_cumul,
  p.nama_project, p.departemen, p.profit_center,
  p.payment_type, p.contract_value,
  m.opname, m.bapp, m.submit_invoice, m.correct_invoice, m.piutang_usaha,
  m.target_konversi_pu, m.ket_konversi_pu, m.target_cash_in, m.ket_cash_in,
  m.updated_by, m.updated_at, m.version,
  (
    (m.opname='Done')::int + (m.bapp='Done')::int +
    (m.submit_invoice='Done')::int + (m.correct_invoice='Done')::int +
    (m.piutang_usaha='Done')::int
  ) as done_count,
  round((
    (m.opname='Done')::int + (m.bapp='Done')::int +
    (m.submit_invoice='Done')::int + (m.correct_invoice='Done')::int +
    (m.piutang_usaha='Done')::int
  ) * 100.0 / 5, 0) as progress_pct,
  (m.target_konversi_pu is not null
   and m.piutang_usaha = 'Not Done'
   and m.target_konversi_pu < current_date) as overdue_konversi_pu,
  (m.target_cash_in is not null
   and m.target_cash_in < current_date) as overdue_cash_in
from public.monthly_status m
join public.projects p on p.no_project = m.no_project;
