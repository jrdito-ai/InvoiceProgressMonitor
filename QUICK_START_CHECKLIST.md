==============================================================================
  QUICK START CHECKLIST — Copy-Paste ke IDE
==============================================================================

STEP 1: SETUP PROJECT
─────────────────────
☐ Buat folder project baru (atau gunakan project React yang sudah ada)
☐ Install dependencies:
    npm install @supabase/supabase-js recharts lucide-react

☐ Copy file dari outputs folder:
    README_SETUP_COMPLETE.md
    supabaseClient.js → src/lib/
    useAuthContext.js → src/hooks/
    useMonthlyStatus.js → src/hooks/
    InvoiceProgressMonitor_v2.jsx → src/components/ (rename jadi final)
    schema_COMPLETE.sql → /db/ (reference saja)
    .env.example → root, copy ke .env.local

STEP 2: SUPABASE SETUP
──────────────────────
☐ Login ke https://supabase.com
☐ Create new project
☐ Tunggu project ready
☐ Buka SQL editor
☐ Copy SELURUH isi schema_COMPLETE.sql
☐ Paste ke SQL editor, jalankan (run all)
☐ Tunggu semua query berhasil (no error)

STEP 3: AUTH SETUP DI SUPABASE
──────────────────────────────
☐ Di Supabase Dashboard, buka Settings → Authentication → Providers
☐ Pastikan "Email" enabled
☐ Email Confirmations: disable (buat development mudah)
☐ Go to Users → buat user pertama (admin@demo.co / password)
☐ Di SQL editor, jalankan:
    UPDATE public.profiles 
    SET role='admin', departemen=NULL 
    WHERE email='admin@demo.co';

STEP 4: COPY CREDENTIALS
────────────────────────
☐ Settings → API → Copy Project URL → ke VITE_SUPABASE_URL di .env.local
☐ Settings → API → Copy Anon public key → ke VITE_SUPABASE_ANON_KEY di .env.local
☐ .env.local tidak boleh di-commit (add ke .gitignore)

STEP 5: APP.JSX — SETUP AUTH PROVIDER
──────────────────────────────────────
Buat src/App.jsx seperti ini:

```jsx
import { AuthProvider } from "./hooks/useAuthContext";
import LoginScreen from "./components/LoginScreen";
import InvoiceProgressMonitor from "./components/InvoiceProgressMonitor_FINAL";
import { useAuth } from "./hooks/useAuthContext";

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  return isAuthenticated ? <InvoiceProgressMonitor /> : <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
```

STEP 6: LOGIN SCREEN — BUAT SEDERHANA
──────────────────────────────────────
Buat src/components/LoginScreen.jsx:

```jsx
import { useState } from "react";
import { useAuth } from "../hooks/useAuthContext";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await login(email, password);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-100">
      <form onSubmit={handleLogin} className="w-80 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-bold">Login</h2>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded border px-3 py-2"
          disabled={loading}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded border px-3 py-2"
          disabled={loading}
        />
        <button
          type="submit"
          className="w-full rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Loading..." : "Login"}
        </button>
      </form>
    </div>
  );
}
```

STEP 7: TEST
────────────
☐ npm run dev
☐ Buka http://localhost:5173
☐ Login dengan admin@demo.co
☐ Cek apakah dashboard muncul
☐ Cek apakah data load (dari mock data dulu)

STEP 8: INTEGRASI REAL DATA (NANTI)
────────────────────────────────────
Sekarang UI pake mock data. Untuk pakai real Supabase:

Di InvoiceProgressMonitor_v2.jsx:
- Replace const SEED = [] dengan useMonthlyStatus(fPeriode)
- Replace PROJECTS const dengan useQuery ke projects table
- Update handleSave, handleToggle, dll dengan supabase.from().update()
- Tambah error handling, loading state, refresh data

File useMonthlyStatus.js sudah siapin helper functions:
- updateStatus(id, fieldKey, value, version)
- updateTargets(id, updates, version)
- deleteInvoice(id)
- generatePeriod(periode)
- setupTermins(noProject, termins)

STEP 9: INVITE TEST USERS
─────────────────────────
Di Supabase Dashboard → Auth → Users → Invite
- Email: editor@demo.co, password: demo123
- Jalankan SQL:
    UPDATE public.profiles 
    SET role='editor', departemen='Sipil' 
    WHERE email='editor@demo.co';
    
- Email: viewer@demo.co, password: demo123
- Jalankan SQL:
    UPDATE public.profiles 
    SET role='viewer', departemen='Mekanikal & Elektrikal'
    WHERE email='viewer@demo.co';

Test dengan ketiga account beda-beda untuk validasi departemen filter.

==============================================================================
  FILE CHECKLIST
==============================================================================

✅ Files yang sudah ready di outputs folder:

1. README_SETUP_COMPLETE.md — Dokumentasi lengkap
2. supabaseClient.js — Supabase client initialization
3. useAuthContext.js — Auth state management
4. useMonthlyStatus.js — Data operations (fetch, update, delete)
5. .env.example — Environment template
6. schema_COMPLETE.sql — Database schema
7. InvoiceProgressMonitor_v2.jsx — UI component (mock data)

Optional (reference):
- CHANGELOG_marginal_model.txt
- nilai_invoice_design.txt
- daftar_tabel_database.txt

==============================================================================
  TROUBLESHOOTING
==============================================================================

"Module not found: @supabase/supabase-js"
  → npm install @supabase/supabase-js

"Environment variables not loading"
  → Pastikan .env.local ada di root folder
  → Restart dev server
  → Cek VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY ada value

"Login failed"
  → Cek credentials di Supabase dashboard
  → Pastikan profiles table udah ada row untuk user itu
  → Cek di browser console untuk error detail

"RLS deny all queries"
  → Pastikan RLS policies sudah create di database
  → Cek anon key punya akses
  → Jalankan SQL: SELECT * FROM public.v_monthly_progress;

"Komponens tidak render"
  → Cek imports (reconcils, lucide-react terinstall?)
  → Cek JSX syntax (React.Fragment, key di list, dll)
  → Lihat browser console untuk error

==============================================================================
==============================================================================
