==============================================================================
  INVOICE PROGRESS MONITOR — Setup & Development Guide
  Complete Implementation with All Brainstorming Decisions
==============================================================================

TARGET: Copy-paste siap jalan di React development environment (Vite/CRA/Next.js)

==============================================================================
  QUICK START
==============================================================================

1. Copy semua file dari outputs ke project lo:
   - InvoiceProgressMonitor_FINAL.jsx
   - supabaseClient.js
   - useMonthlyStatus.js (custom hook)
   - useAuthContext.js (custom hook)
   - schema_COMPLETE.sql
   - .env.example

2. Install Supabase client:
   npm install @supabase/supabase-js

3. Setup Supabase (next section)

4. Copy .env.example → .env.local, isi credentials

5. Jalanin di dev:
   npm run dev (Vite) atau npm start (CRA)

==============================================================================
  SUPABASE SETUP (one-time)
==============================================================================

Di Supabase dashboard:

1. Buat project baru
2. Jalanin semua SQL dari schema_COMPLETE.sql di SQL editor
3. Setup Auth:
   - Email/Password enabled
   - Confirm email = OFF (untuk development mudah)
4. Copy API credentials:
   - Project URL → VITE_SUPABASE_URL
   - Anon Public Key → VITE_SUPABASE_ANON_KEY
5. Create first admin user:
   - Email: admin@demo.co
   - Password: demo123456
   - Di SQL run: UPDATE public.profiles SET role='admin', departemen=NULL WHERE email='admin@demo.co'
6. Invite test users (editor + viewer, assign departemen)

==============================================================================
  FILE STRUCTURE (setelah copy)
==============================================================================

src/
├── App.jsx                           (main router, auth guard)
├── InvoiceProgressMonitor_FINAL.jsx  (main UI, semua tab)
├── hooks/
│   ├── useAuthContext.js             (session + user role + departemen)
│   └── useMonthlyStatus.js           (fetch, update, delete data)
├── lib/
│   └── supabaseClient.js             (Supabase client initialization)
├── contexts/
│   └── AuthContext.jsx               (auth state provider)
└── .env.local                        (credentials, gitignore!)

==============================================================================
  DEVELOPMENT WORKFLOW
==============================================================================

STEP 1: Setup auth flow
  - User login → email + password
  - Session check → redirect ke dashboard atau login screen
  - Role + departemen dari profiles

STEP 2: Query data
  - Dashboard fetch dari v_monthly_progress (pake departemen filter)
  - Render tabel + summary

STEP 3: Update/Delete
  - User toggle status → konfirmasi dialog
  - Call supabase.from('monthly_status').update() + optimistic lock (version)
  - Audit log otomatis di database

STEP 4: Admin functions
  - Generate Monthly → call RPC generate_period()
  - Setup Termin → call RPC setup_termins()
  - Kelola User → query profiles, update role

==============================================================================
  KEY IMPLEMENTATION NOTES
==============================================================================

1. MULTI-INVOICE PER BULAN
   - Unique constraint (periode, no_project, event_type, invoice_seq)
   - invoice_seq = otomatis, nggak di-input user
   - UI: sub-row per invoice (grouped by proyek di Input & Edit)
   - Summary: aggregate per proyek (total nilai, weighted avg progress)

2. CONFIRMATION DIALOG
   - EVERY action: toggle status, edit field, tambah invoice, delete, generate, setup termin
   - Dialog: "Apakah anda yakin...?" dengan tombol Ya / Cancel
   - Implementasi: gunakan modal/dialog component (shadcn/ui recommended)

3. DEPARTEMEN FILTER
   - profiles punya kolom departemen (1 user = 1 dept)
   - Admin: departemen = NULL, akses semua
   - Editor/Viewer: hanya proyek di dept-nya
   - RLS enforce di database level

4. NILAI PROGRESS (bukan invoice)
   - Field: nilai_progress (numeric)
   - Artinya: nilai gross sebelum potongan (untuk orang teknik)
   - Reporting: forecast cash-in pakai angka ini (nggak 100% akurat, tapi ok buat teknis)

5. MARGINAL INVOICE MODEL
   - pct_termin = progres TAHAP INI (bukan total)
   - pct_termin_cumul = otomatis dihitung oleh trigger (read-only)
   - Validasi: cumul nggak boleh > 100%
   - Setup Termin modal: live-calc cumul, preview sebelum save

6. OPSI C: SUMMARY AGGREGATE + INPUT DETAIL
   - Summary tab: per proyek (1 baris, nilai total, progress rata-rata weighted)
   - Input & Edit: per invoice (setiap row = 1 invoice, punya pipeline sendiri)

==============================================================================
  ENVIRONMENT VARIABLES (.env.local)
==============================================================================

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
VITE_APP_NAME=Invoice Progress Monitor

==============================================================================
  TESTING CHECKLIST (sebelum production)
==============================================================================

Database:
  ☐ Schema terjalankan semua (no error)
  ☐ Trigger compute_pct_termin_cumul jalan (test insert termin)
  ☐ RLS active (query dari anon key hanya lihat dept sendiri)
  ☐ Audit log otomatis catat setiap update
  ☐ Optimistic lock (version) prevent concurrent edit

Auth:
  ☐ Login flow: email + password
  ☐ Session persist (refresh page tetap login)
  ☐ Logout: session clear
  ☐ Role enforcement: viewer nggak bisa edit, admin bisa semua

UI/UX:
  ☐ Confirmation dialog muncul setiap aksi
  ☐ Departemen filter locked untuk editor/viewer
  ☐ Tab Kelola User hanya muncul untuk admin
  ☐ Setup Termin: live-calc cumul, preview update saat edit
  ☐ Multi-invoice: tambah invoice, delete invoice, pipeline per invoice

Reporting:
  ☐ Summary KPI akurat (total nilai = sum all invoices)
  ☐ Forecast cash-in calculated (by target_cash_in)
  ☐ Watchlist overdue populated
  ☐ Progress % per invoice di Input & Edit, aggregate per proyek di Summary

==============================================================================
  DEPLOY CHECKLIST (sebelum production)
==============================================================================

  ☐ Environment variables di production (Vercel/Netlify/Railway env)
  ☐ Supabase: email confirm = ON (require verifikasi)
  ☐ Supabase: setup custom domain (optional)
  ☐ Supabase: backup schedule ON
  ☐ RLS policies tested di production environment
  ☐ CORS configured (frontend domain di Supabase)
  ☐ Rate limiting considered (API throttle)
  ☐ Monitoring setup (error logs, performance)

==============================================================================
  TROUBLESHOOTING
==============================================================================

"User nggak bisa login"
  → Cek email/password benar
  → Cek profiles table ada row dengan email itu
  → Cek auth.users di Supabase Dashboard

"Data nggak load"
  → Cek RLS: anon key punya permission?
  → Cek departemen filter: user punya departemen?
  → Cek network tab: ada error response dari Supabase?

"Cumulative % jadi > 100%"
  → Trigger compute_pct_cumul harus reject insert
  → Check database error message saat insert termin

"Konfirmasi dialog nggak muncul"
  → Cek modal/dialog component imported?
  → Cek onClick handler call handleXxx() function?

==============================================================================
