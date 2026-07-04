import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";
import {
  LayoutDashboard, Database, AlertTriangle, CheckCircle2,
  RefreshCw, Plus, CalendarClock, ChevronRight, X, Layers,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TODAY = "2026-07-01";
const D = "Done", N = "Not Done";

const STAGES = [
  { key: "opname",          label: "Opname"         },
  { key: "bapp",            label: "BAPP"            },
  { key: "submit_invoice",  label: "Submit Invoice"  },
  { key: "correct_invoice", label: "Correct Invoice" },
  { key: "piutang_usaha",   label: "Piutang Usaha"  },
];

const USERS = { admin: "Rani (Admin)", editor: "Budi (Editor)", viewer: "Sari (Viewer)" };

const PT = {
  monthly:          { label: "Monthly",          cls: "bg-sky-50 text-sky-700 border border-sky-200"          },
  termin:           { label: "Termin",           cls: "bg-violet-50 text-violet-700 border border-violet-200"  },
  progress_payment: { label: "Progress Payment", cls: "bg-teal-50 text-teal-700 border border-teal-200"        },
  milestone:        { label: "Milestone",        cls: "bg-amber-50 text-amber-700 border border-amber-200"     },
  turnkey:          { label: "Turnkey",          cls: "bg-rose-50 text-rose-700 border border-rose-200"        },
};

// Mekanisme billing: hanya 'monthly' yang recurring (auto-generate).
// Sisanya event-based (di-setup manual). Dipakai buat filter tombol admin.
const isEventBased = type => type !== "monthly";

// ---------------------------------------------------------------------------
// Master Proyek
// ---------------------------------------------------------------------------
const PROJECTS = {
  "P-2401": { nama: "Renovasi Gedung A",        dept: "Sipil",                  pc: "PC-JKT", type: "monthly", contract: 2_400_000_000 },
  "P-2402": { nama: "Instalasi HVAC Tower B",   dept: "Mekanikal & Elektrikal", pc: "PC-JKT", type: "termin",           contract: 2_000_000_000 },
  "P-2403": { nama: "Jaringan Pipa Distrik 3",  dept: "Sistem Air",             pc: "PC-SBY", type: "progress_payment", contract: 1_300_000_000 },
  "P-2404": { nama: "Struktur Jembatan KM12",   dept: "Sipil",                  pc: "PC-SBY", type: "monthly",          contract: 3_500_000_000 },
  "P-2405": { nama: "Panel Listrik Pabrik C",   dept: "Mekanikal & Elektrikal", pc: "PC-MDN", type: "monthly",          contract:   800_000_000 },
  "P-2406": { nama: "IPAL Kawasan Industri",    dept: "Sistem Air",             pc: "PC-MDN", type: "monthly",          contract: 1_500_000_000 },
  "P-2407": { nama: "Fasad & Interior Lobby",   dept: "Sipil",                  pc: "PC-JKT", type: "milestone",        contract:   950_000_000 },
  "P-2408": { nama: "Gudang Logistik Turnkey",  dept: "Sipil",                  pc: "PC-MDN", type: "turnkey",          contract: 1_800_000_000 },
};

// ---------------------------------------------------------------------------
// Seed data
// [event_type, periode_MM-YYYY, no_project, no_termin|null, nilai_invoice,
//  opname, bapp, submit_invoice, correct_invoice, piutang_usaha,
//  target_konversi_pu, ket_konversi_pu, target_cash_in, ket_cash_in, updated_at]
// ---------------------------------------------------------------------------
const SEED = [
  // ── Monthly events ──────────────────────────────────────────────────────
  ["monthly","06-2026","P-2401",null,  200_000_000, D,D,D,D,N,"2026-06-25","Menunggu approval klien","2026-07-20","","2026-06-28 14:22"],
  ["monthly","06-2026","P-2404",null,  350_000_000, D,N,N,N,N,"","","","","2026-06-20 11:05"],
  ["monthly","06-2026","P-2405",null,  100_000_000, D,D,D,D,D,"2026-06-15","Sudah dikonversi","2026-06-28","Follow up keuangan klien","2026-06-29 08:55"],
  ["monthly","06-2026","P-2406",null,  150_000_000, D,D,D,D,D,"2026-06-20","","2026-07-15","","2026-06-24 13:30"],
  ["monthly","05-2026","P-2401",null,  200_000_000, D,D,D,D,D,"2026-05-28","","2026-06-20","Cair sebagian","2026-05-30 15:12"],
  ["monthly","05-2026","P-2404",null,  350_000_000, D,D,N,N,N,"","","","","2026-05-22 11:20"],
  ["monthly","05-2026","P-2405",null,  100_000_000, D,D,D,D,D,"2026-05-15","","2026-05-31","Sudah cair","2026-05-31 16:05"],
  ["monthly","05-2026","P-2406",null,  150_000_000, D,D,D,D,N,"2026-05-25","","2026-06-10","","2026-05-26 10:45"],
  // ── Termin: P-2402 HVAC Tower B (3 termin) ──────────────────────────────
  ["termin","04-2026","P-2402","DP",         400_000_000, 20, D,D,D,D,D,"2026-04-20","","2026-05-10","Lunas","2026-04-22 10:00"],
  ["termin","06-2026","P-2402","Termin 1",   800_000_000, 40, D,D,D,N,N,"2026-07-10","","2026-07-31","","2026-06-27 09:10"],
  ["termin","09-2026","P-2402","Final",       800_000_000, 40, N,N,N,N,N,"2026-09-30","","2026-10-20","",""],
  // ── Progress Payment: P-2403 Jaringan Pipa (basis % fisik) ──────────────
  ["termin","03-2026","P-2403","Progress 20%",260_000_000, 20, D,D,D,D,D,"2026-03-25","","2026-04-10","Lunas","2026-03-26 14:00"],
  ["termin","06-2026","P-2403","Progress 50%",650_000_000, 30, D,D,N,N,N,"2026-06-30","Revisi volume pekerjaan","2026-08-05","","2026-06-26 16:40"],
  ["termin","10-2026","P-2403","Final 30%",   390_000_000, 50, N,N,N,N,N,"","","","",""],
  // ── Milestone: P-2407 Fasad & Interior (basis deliverable) ──────────────
  ["termin","05-2026","P-2407","Struktur",   475_000_000, 50, D,N,N,N,N,"","","","","2026-05-20 09:15"],
  ["termin","08-2026","P-2407","Finishing",  475_000_000, 50, N,N,N,N,N,"","","","",""],
  // ── Turnkey: P-2408 Gudang Logistik (1 event serah terima akhir) ────────
  ["termin","09-2026","P-2408","Serah Terima",1_800_000_000,100, N,N,N,N,N,"2026-09-25","","2026-10-25","",""],
];

let _uid = 0;
const mkRow = r => ({
  id: ++_uid,
  event_type: r[0], periode: r[1], no_project: r[2], no_termin: r[3], nilai_invoice: r[4],
  pct_termin: r[5], pct_termin_cumul: null, // akan dihitung oleh helper computeCumul
  opname: r[6], bapp: r[7], submit_invoice: r[8], correct_invoice: r[9], piutang_usaha: r[10],
  target_konversi_pu: r[11], ket_konversi_pu: r[12], target_cash_in: r[13], ket_cash_in: r[14],
  updated_by: r[15] ? "Import awal" : "", updated_at: r[15] || "",
});

// Helper: compute cumulative pct untuk audit trail
const computeCumulForProject = (rows, noProj) => {
  const byProj = rows
    .filter(r => r.no_project === noProj && r.event_type === 'termin' && r.pct_termin)
    .sort((a, b) => sortPer(a.periode).localeCompare(sortPer(b.periode)));
  
  let cumul = 0;
  return new Map(byProj.map(r => {
    cumul += r.pct_termin;
    return [r.id, cumul];
  }));
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const doneCount  = row => STAGES.reduce((n, s) => n + (row[s.key] === D ? 1 : 0), 0);
const progress   = row => Math.round(doneCount(row) / STAGES.length * 100);
const overdueKPU = row => !!row.target_konversi_pu && row.piutang_usaha === N && row.target_konversi_pu < TODAY;
const overdueCIn = row => !!row.target_cash_in && row.target_cash_in < TODAY;
const anyOverdue = row => overdueKPU(row) || overdueCIn(row);
const fmtDate    = iso => iso ? new Date(iso + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const monthKey   = iso => iso ? `${iso.slice(5,7)}-${iso.slice(0,4)}` : null;
const sortPer    = p  => { const [m, y] = p.split("-"); return `${y}${m}`; };
const formatIDR  = val => {
  if (!val && val !== 0) return "—";
  if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)} M`;
  if (val >= 1_000_000)     return `Rp ${Math.round(val / 1_000_000)} jt`;
  return `Rp ${val.toLocaleString("id-ID")}`;
};

// ---------------------------------------------------------------------------
// Atom components
// ---------------------------------------------------------------------------
function StatusPill({ value, editable, onToggle }) {
  const done = value === D;
  return (
    <button type="button" disabled={!editable} onClick={onToggle}
      title={editable ? "Klik untuk ubah" : value}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition
        ${done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 border border-slate-200"}
        ${editable ? "cursor-pointer hover:brightness-95" : "cursor-default"}`}>
      {done
        ? <CheckCircle2 size={12} />
        : <span className="h-2.5 w-2.5 rounded-full border border-slate-400" />}
      {done ? "Done" : "Not Done"}
    </button>
  );
}

function Pipeline({ row }) {
  return (
    <div className="flex items-center">
      {STAGES.map((s, i) => {
        const done     = row[s.key] === D;
        const nextDone = i < STAGES.length - 1 && row[STAGES[i + 1].key] === D;
        return (
          <React.Fragment key={s.key}>
            <div title={`${s.label}: ${row[s.key]}`}
              className={`h-2.5 w-2.5 rounded-full ${done ? "bg-emerald-500" : "bg-slate-200"}`} />
            {i < STAGES.length - 1 && (
              <div className={`h-0.5 w-4 ${done && nextDone ? "bg-emerald-500" : "bg-slate-200"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function TerminProgress({ termins, currentTermin }) {
  if (!termins || termins.length === 0) return null;
  const sorted = [...termins].sort((a, b) => sortPer(a.periode).localeCompare(sortPer(b.periode)));
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {sorted.map(t => (
        <span key={t.id}
          title={`${t.no_termin} · ${t.periode} · ${formatIDR(t.nilai_invoice)}`}
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition ${
            t.no_termin === currentTermin
              ? "bg-violet-600 text-white"
              : t.piutang_usaha === D
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}>
          {t.no_termin}
        </span>
      ))}
    </div>
  );
}

function Kpi({ label, value, sub, tone = "slate" }) {
  const tones = { slate: "text-slate-900", indigo: "text-indigo-600", emerald: "text-emerald-600", rose: "text-rose-600" };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums leading-tight ${tones[tone]}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        {subtitle && <div className="text-xs text-slate-400">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function DateField({ value, editable, overdue, onChange }) {
  if (!editable) return <div className={`text-xs ${overdue ? "font-medium text-rose-600" : "text-slate-600"}`}>{fmtDate(value)}</div>;
  return <input type="date" value={value || ""} onChange={e => onChange(e.target.value)}
    className={`mb-1 w-36 rounded border px-2 py-1 text-xs ${overdue ? "border-rose-300 text-rose-600" : "border-slate-200 text-slate-700"}`} />;
}

function TextField({ value, editable, placeholder, onChange }) {
  if (!editable) return <div className="text-xs text-slate-500">{value || "—"}</div>;
  return <input type="text" value={value || ""} placeholder={placeholder} onChange={e => onChange(e.target.value)}
    className="w-40 rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 placeholder:text-slate-300" />;
}

function Legend2({ items }) {
  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} /> {label}
        </span>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
        <ChevronRight size={22} />
      </div>
      <div className="text-sm font-medium text-slate-700">Pilih periode & departemen, lalu klik Muat Data</div>
      <div className="mt-1 text-xs text-slate-400">Filter berlaku untuk billing event monthly maupun termin yang dijadwalkan di periode tersebut.</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
export default function App() {
  const [data,    setData]    = useState(() => SEED.map(mkRow));
  const [role,    setRole]    = useState("editor");
  const [tab,     setTab]     = useState("summary");
  const [fPeriode,setFPeriode]= useState("06-2026");
  const [fDept,   setFDept]   = useState("Semua");
  const [applied, setApplied] = useState(null);
  const [toast,   setToast]   = useState(null);
  const [showSetup, setShowSetup] = useState(false);

  const canEdit = role === "admin" || role === "editor";
  const isAdmin = role === "admin";

  const periodes = useMemo(() =>
    [...new Set(data.map(r => r.periode))].sort((a, b) => sortPer(b).localeCompare(sortPer(a)))
  , [data]);

  const depts = useMemo(() =>
    ["Semua", ...new Set(Object.values(PROJECTS).map(p => p.dept))].sort()
  , []);

  const terminsByProject = useMemo(() => {
    const map = {};
    data.filter(r => r.event_type === "termin").forEach(r => {
      (map[r.no_project] ||= []).push(r);
    });
    return map;
  }, [data]);

  const rows = useMemo(() => {
    if (!applied) return [];
    return data
      .filter(r => r.periode === applied.periode)
      .filter(r => applied.dept === "Semua" || PROJECTS[r.no_project]?.dept === applied.dept)
      .sort((a, b) => a.no_project.localeCompare(b.no_project));
  }, [data, applied]);

  const flash = msg => { setToast(msg); setTimeout(() => setToast(null), 1800); };
  const loadData = () => setApplied({ periode: fPeriode, dept: fDept });

  const patch = (id, changes) =>
    setData(prev => prev.map(r => r.id === id
      ? { ...r, ...changes, updated_by: USERS[role], updated_at: new Date().toISOString().slice(0, 16).replace("T", " ") }
      : r));

  const toggleStage = (row, key) => {
    if (!canEdit) return;
    patch(row.id, { [key]: row[key] === D ? N : D });
    flash("Perubahan tersimpan");
  };

  const generateMonthly = () => {
    const per = applied?.periode || fPeriode;
    const existing = new Set(data.filter(r => r.periode === per && r.event_type === "monthly").map(r => r.no_project));
    const [mm, yyyy] = per.split("-").map(Number);
    const prevDate = new Date(yyyy, mm - 2, 1);
    const prevKey  = `${String(prevDate.getMonth() + 1).padStart(2, "0")}-${prevDate.getFullYear()}`;
    const prevMap  = new Map(data.filter(r => r.periode === prevKey && r.event_type === "monthly").map(r => [r.no_project, r]));

    const additions = Object.entries(PROJECTS)
      .filter(([np, p]) => p.type === "monthly" && !existing.has(np))
      .map(([np]) => {
        const prev = prevMap.get(np);
        return {
          id: ++_uid, event_type: "monthly", periode: per, no_project: np,
          no_termin: null, nilai_invoice: null,
          opname: N, bapp: N, submit_invoice: N, correct_invoice: N, piutang_usaha: N,
          target_konversi_pu: prev?.target_konversi_pu || "",
          ket_konversi_pu:    prev?.ket_konversi_pu    || "",
          target_cash_in:     prev?.target_cash_in     || "",
          ket_cash_in:        prev?.ket_cash_in        || "",
          updated_by: USERS[role],
          updated_at: new Date().toISOString().slice(0, 16).replace("T", " "),
        };
      });

    if (additions.length === 0) return flash("Semua proyek monthly sudah ada di periode ini");
    setData(prev => [...prev, ...additions]);
    flash(`${additions.length} proyek monthly digenerate untuk ${per}`);
  };

  // ── Derived for Summary ──
  const kpi = useMemo(() => {
    const totalNilai = rows.reduce((s, r) => s + (r.nilai_invoice || 0), 0);
    const nilaiAR    = rows.filter(r => r.piutang_usaha === D).reduce((s, r) => s + (r.nilai_invoice || 0), 0);
    return {
      total:      rows.length,
      monthly:    rows.filter(r => r.event_type === "monthly").length,
      termin:     rows.filter(r => r.event_type === "termin").length,
      totalNilai, nilaiAR,
      overdue:    rows.filter(anyOverdue).length,
    };
  }, [rows]);

  const funnel = useMemo(() =>
    STAGES.map(s => ({ name: s.label, count: rows.filter(r => r[s.key] === D).length }))
  , [rows]);

  const nilaiPipeline = useMemo(() =>
    STAGES.map(s => ({
      name: s.label,
      nilai: Math.round(rows.filter(r => r[s.key] === D).reduce((s2, r) => s2 + (r.nilai_invoice || 0), 0) / 1_000_000),
    }))
  , [rows]);

  const byDept = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      const dept = PROJECTS[r.no_project]?.dept || "Lainnya";
      const d = (map[dept] ||= { departemen: dept.split(" ")[0], Selesai: 0, Proses: 0, Belum: 0 });
      const p = progress(r);
      if (p === 100) d.Selesai++; else if (p === 0) d.Belum++; else d.Proses++;
    });
    return Object.values(map);
  }, [rows]);

  const overdueList = useMemo(() => rows.filter(anyOverdue), [rows]);

  const forecast = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      const k = monthKey(r.target_cash_in);
      if (k) map[k] = (map[k] || 0) + (r.nilai_invoice || 0);
    });
    return Object.entries(map)
      .map(([name, val]) => ({ name, nilai: Math.round(val / 1_000_000) }))
      .sort((a, b) => { const [ma,ya]=a.name.split("-"); const [mb,yb]=b.name.split("-"); return `${ya}${ma}`.localeCompare(`${yb}${mb}`); });
  }, [rows]);

  const funnelColors = ["#6366f1","#6d6ff2","#818cf8","#a5b4fc","#c7d2fe"];
  const nilaiColors  = ["#0ea5e9","#0284c7","#0369a1","#075985","#0c4a6e"];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" style={{ fontFamily: "ui-sans-serif,system-ui,sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <CalendarClock size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">Invoice Progress Monitor</div>
              <div className="text-[11px] text-slate-400 leading-tight">Monitoring invoicing — Monthly & Termin</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-400 sm:inline">Masuk sebagai</span>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700">
              {Object.entries(USERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl gap-1 px-4">
          {[
            { k: "summary", label: "Summary",     Icon: LayoutDashboard },
            { k: "input",   label: "Input & Edit", Icon: Database },
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition
                ${tab === t.k ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              <t.Icon size={16} /> {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {/* Filter bar */}
        <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Periode
            <select value={fPeriode} onChange={e => setFPeriode(e.target.value)}
              className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800">
              {periodes.map(p => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            Departemen
            <select value={fDept} onChange={e => setFDept(e.target.value)}
              className="w-52 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800">
              {depts.map(d => <option key={d}>{d}</option>)}
            </select>
          </label>
          <button onClick={loadData}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Muat Data
          </button>
          {isAdmin && applied && (
            <div className="ml-auto flex gap-2">
              <button onClick={generateMonthly}
                className="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100">
                <RefreshCw size={15} /> Generate Monthly
              </button>
              <button onClick={() => setShowSetup(true)}
                className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100">
                <Layers size={15} /> Setup Termin
              </button>
            </div>
          )}
        </div>

        {!applied ? <EmptyState /> : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            Tidak ada billing event untuk filter ini.
          </div>
        ) : tab === "summary" ? (
          /* ══════════════ SUMMARY ══════════════ */
          <div className="space-y-5">
            {/* KPI */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Billing Events" value={kpi.total}
                sub={`${kpi.monthly} monthly · ${kpi.termin} termin`} />
              <Kpi label="Total Nilai Invoice" value={formatIDR(kpi.totalNilai)}
                sub="seluruh billing event" tone="indigo" />
              <Kpi label="Nilai AR Terbentuk" value={formatIDR(kpi.nilaiAR)}
                sub="piutang usaha Done" tone="emerald" />
              <Kpi label="Overdue" value={kpi.overdue}
                sub="target konversi / cash in terlewat" tone="rose" />
            </div>

            {/* 2 pipeline charts */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Pipeline — Jumlah Event" subtitle="Billing event yang selesaikan tiap tahap">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={funnel} layout="vertical" margin={{ left: 12, right: 32 }}>
                    <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                    <YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 12, fill: "#475569" }} />
                    <Tooltip cursor={{ fill: "#f8fafc" }} formatter={v => [v, "Event"]} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {funnel.map((_, i) => <Cell key={i} fill={funnelColors[i]} />)}
                      <LabelList dataKey="count" position="right" style={{ fontSize: 12, fill: "#475569" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Pipeline — Nilai Invoice (juta Rp)" subtitle="Nilai yang sudah mencapai tiap tahap">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={nilaiPipeline} layout="vertical" margin={{ left: 12, right: 48 }}>
                    <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 12, fill: "#475569" }} />
                    <Tooltip cursor={{ fill: "#f8fafc" }} formatter={v => [`Rp ${v} jt`, "Nilai"]} />
                    <Bar dataKey="nilai" radius={[0, 6, 6, 0]}>
                      {nilaiPipeline.map((_, i) => <Cell key={i} fill={nilaiColors[i]} />)}
                      <LabelList dataKey="nilai" position="right" style={{ fontSize: 11, fill: "#475569" }}
                        formatter={v => `${v}jt`} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Per departemen */}
              <Card title="Status per Departemen" subtitle="Selesai / proses / belum mulai">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={byDept} margin={{ left: -12, right: 8 }}>
                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="departemen" tick={{ fontSize: 11, fill: "#475569" }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                    <Tooltip cursor={{ fill: "#f8fafc" }} />
                    <Bar dataKey="Selesai" stackId="a" fill="#10b981" />
                    <Bar dataKey="Proses"  stackId="a" fill="#6366f1" />
                    <Bar dataKey="Belum"   stackId="a" fill="#e2e8f0" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <Legend2 items={[["Selesai","#10b981"],["Proses","#6366f1"],["Belum","#e2e8f0"]]} />
              </Card>

              {/* Forecast cash in (nilai IDR) */}
              <Card title="Forecast Cash In (juta Rp)" subtitle="Proyeksi nilai cash masuk per bulan target">
                {forecast.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">Belum ada target cash in.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={forecast} margin={{ left: -12, right: 8 }}>
                      <CartesianGrid vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <Tooltip cursor={{ fill: "#f8fafc" }} formatter={v => [`Rp ${v} jt`, "Nilai"]} />
                      <Bar dataKey="nilai" fill="#0ea5e9" radius={[6, 6, 0, 0]}>
                        <LabelList dataKey="nilai" position="top" style={{ fontSize: 11, fill: "#475569" }}
                          formatter={v => `${v}jt`} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>

            {/* Watchlist overdue */}
            <Card title="Watchlist Overdue" subtitle="Target konversi piutang / cash in yang terlewat">
              {overdueList.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Tidak ada yang overdue.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {overdueList.map(r => {
                    const proj = PROJECTS[r.no_project];
                    return (
                      <li key={r.id} className="flex items-start gap-3 py-2.5">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-500" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-sm">
                            <span className="font-medium text-slate-800">{r.no_project}</span>
                            {r.no_termin && (
                              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                                {r.no_termin}
                              </span>
                            )}
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-600">{proj?.nama}</span>
                            {r.nilai_invoice && (
                              <span className="ml-auto text-xs text-slate-400">{formatIDR(r.nilai_invoice)}</span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {overdueKPU(r) && <>Konversi PU jatuh tempo {fmtDate(r.target_konversi_pu)}. </>}
                            {overdueCIn(r) && <>Cash in target {fmtDate(r.target_cash_in)}. </>}
                            {(r.ket_konversi_pu || r.ket_cash_in) && (
                              <span className="italic">{r.ket_konversi_pu || r.ket_cash_in}</span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        ) : (
          /* ══════════════ INPUT & EDIT ══════════════ */
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                {rows.length} billing event · {applied.periode}
                {!canEdit && <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Baca saja (Viewer)</span>}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-[1350px] w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2.5">Proyek</th>
                    <th className="px-3 py-2.5">Tipe Billing</th>
                    <th className="px-3 py-2.5">Nilai Invoice</th>
                    <th className="px-3 py-2.5">% Tahap / Kumulatif</th>
                    <th className="px-3 py-2.5">Progress</th>
                    {STAGES.map(s => <th key={s.key} className="px-3 py-2.5">{s.label}</th>)}
                    <th className="px-3 py-2.5">Konversi PU</th>
                    <th className="px-3 py-2.5">Cash In</th>
                    <th className="px-3 py-2.5">Diperbarui</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(r => {
                    const proj   = PROJECTS[r.no_project];
                    const ptMeta = PT[proj?.type || "monthly"];
                    return (
                      <tr key={r.id} className="align-top hover:bg-slate-50/60">
                        {/* Proyek */}
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-800">{r.no_project}</div>
                          <div className="text-xs text-slate-500">{proj?.nama}</div>
                          <div className="mt-0.5 text-[11px] text-slate-400">{proj?.dept} · {proj?.pc}</div>
                          {anyOverdue(r) && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-600">
                              <AlertTriangle size={11} /> Overdue
                            </span>
                          )}
                        </td>
                        {/* Tipe billing */}
                        <td className="px-3 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${ptMeta.cls}`}>
                            {ptMeta.label}
                          </span>
                          {r.no_termin && (
                            <div className="mt-1 text-xs font-semibold text-violet-700">{r.no_termin}</div>
                          )}
                          {r.event_type === "termin" && (
                            <TerminProgress
                              termins={terminsByProject[r.no_project]}
                              currentTermin={r.no_termin}
                            />
                          )}
                        </td>
                        {/* Nilai invoice */}
                        <td className="px-3 py-3">
                          {r.nilai_invoice ? (
                            <div>
                              <div className="text-sm font-medium text-slate-800">{formatIDR(r.nilai_invoice)}</div>
                              {proj?.contract && (
                                <div className="text-[11px] text-slate-400">
                                  {Math.round(r.nilai_invoice / proj.contract * 100)}% dari kontrak
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        {/* % Termin — marginal & cumulative (audit trail) */}
                        <td className="px-3 py-3 text-xs">
                          {r.event_type === "termin" && r.pct_termin ? (
                            <div className="space-y-0.5">
                              <div className="font-medium text-slate-800">
                                {r.pct_termin}% <span className="text-slate-400">/</span> {r.pct_termin_cumul || "?"}%
                              </div>
                              <div className="text-[10px] text-slate-400">
                                tahap / kumulatif
                              </div>
                              {r.pct_termin_cumul && r.pct_termin_cumul > 100 && (
                                <div className="mt-0.5 flex items-center gap-1 text-rose-600 font-medium">
                                  <AlertTriangle size={12} /> Over 100%
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        {/* Progress */}
                        <td className="px-3 py-3">
                          <Pipeline row={r} />
                          <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress(r)}%` }} />
                          </div>
                          <div className="mt-0.5 text-[11px] tabular-nums text-slate-400">{progress(r)}%</div>
                        </td>
                        {/* Status pills */}
                        {STAGES.map(s => (
                          <td key={s.key} className="px-3 py-3">
                            <StatusPill value={r[s.key]} editable={canEdit} onToggle={() => toggleStage(r, s.key)} />
                          </td>
                        ))}
                        {/* Konversi PU */}
                        <td className="px-3 py-3">
                          <DateField value={r.target_konversi_pu} editable={canEdit} overdue={overdueKPU(r)}
                            onChange={v => patch(r.id, { target_konversi_pu: v })} />
                          <TextField value={r.ket_konversi_pu} editable={canEdit} placeholder="Keterangan…"
                            onChange={v => patch(r.id, { ket_konversi_pu: v })} />
                        </td>
                        {/* Cash In */}
                        <td className="px-3 py-3">
                          <DateField value={r.target_cash_in} editable={canEdit} overdue={overdueCIn(r)}
                            onChange={v => patch(r.id, { target_cash_in: v })} />
                          <TextField value={r.ket_cash_in} editable={canEdit} placeholder="Keterangan…"
                            onChange={v => patch(r.id, { ket_cash_in: v })} />
                        </td>
                        {/* Audit */}
                        <td className="px-3 py-3 text-[11px] text-slate-400">
                          {r.updated_by}<br />{r.updated_at}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Klik status untuk toggle Done/Not Done. Di app asli tersimpan ke Supabase dengan optimistic lock.
            </p>
          </div>
        )}
      </main>

      {/* Setup Termin Modal */}
      {showSetup && (
        <SetupTerminModal
          data={data}
          onClose={() => setShowSetup(false)}
          onSave={newRows => {
            setData(prev => [...prev, ...newRows]);
            setShowSetup(false);
            flash(`${newRows.length} termin ditambahkan`);
          }}
          role={role}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup Termin Modal
// ---------------------------------------------------------------------------
function SetupTerminModal({ data, onClose, onSave, role }) {
  const terminProjs = Object.entries(PROJECTS).filter(([, p]) => isEventBased(p.type));
  const [selProj, setSelProj] = useState(terminProjs[0]?.[0] || "");
  const [rows, setRows] = useState([{ no_termin: "", periode: "", nilai: "", pct: "" }]);

  const existing = data.filter(r => r.event_type === "termin" && r.no_project === selProj);
  const setF = (i, f, v) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [f]: v } : r));

  const handleSave = () => {
    const existSet  = new Set(existing.map(e => e.no_termin));
    const validRows = rows.filter(r => r.no_termin.trim() && r.periode.trim() && r.pct);
    const newRows   = validRows
      .filter(r => !existSet.has(r.no_termin.trim()))
      .map(r => ({
        id: ++_uid,
        event_type: "termin",
        no_project: selProj,
        periode: r.periode,
        no_termin: r.no_termin.trim(),
        nilai_invoice: r.nilai ? Number(r.nilai.replace(/\D/g, "")) || null : null,
        pct_termin: r.pct ? parseFloat(r.pct) || null : null,
        pct_termin_cumul: null, // akan dihitung otomatis di database
        opname: N, bapp: N, submit_invoice: N, correct_invoice: N, piutang_usaha: N,
        target_konversi_pu: "", ket_konversi_pu: "", target_cash_in: "", ket_cash_in: "",
        updated_by: USERS[role],
        updated_at: new Date().toISOString().slice(0, 16).replace("T", " "),
      }));

    if (newRows.length === 0) { 
      flash_local("Tidak ada termin baru. Semua baris harus punya Label, Periode, dan % Kontrak.");
      return; 
    }

    // VALIDASI: Marginal model — hitung cumulative % dan deteksi masalah
    const allTermins = [...existing, ...newRows].sort((a, b) => sortPer(a.periode).localeCompare(sortPer(b.periode)));
    let totalPct = 0;
    let lastPct = 0;
    let errors = [];

    for (const t of allTermins) {
      if (t.pct_termin) {
        totalPct += t.pct_termin;
        if (totalPct > 100) {
          errors.push(`${t.no_termin} (${t.periode}): Kumulatif jadi ${totalPct}% (> 100%)`);
        }
        if (t.pct_termin < lastPct && t.periode > allTermins[allTermins.indexOf(t) - 1]?.periode) {
          errors.push(`${t.no_termin}: Progres mundur dari ${lastPct}% ke ${t.pct_termin}%`);
        }
        lastPct = t.pct_termin;
      }
    }

    if (errors.length > 0) {
      flash_local(`❌ ${errors[0]}`);
      return;
    }

    if (totalPct !== 100) {
      flash_local(`⚠️ Kumulatif ${totalPct}% ≠ 100%. Lanjut? (akan simpan)`);
      // Tapi tetap bisa simpan — warning aja
    }

    onSave(newRows);
  };

  const [localMsg, setLocalMsg] = useState("");
  const flash_local = msg => { setLocalMsg(msg); setTimeout(() => setLocalMsg(""), 2000); };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Setup Jadwal Termin</h3>
            <p className="text-xs text-slate-400">Daftarkan termin dari kontrak — sistem buat billing event dengan status awal Not Done</p>
          </div>
          <button onClick={onClose} className="mt-0.5 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {/* Pilih proyek */}
        <label className="mb-4 block text-xs font-medium text-slate-500">
          Proyek
          <select value={selProj}
            onChange={e => { setSelProj(e.target.value); setRows([{ no_termin: "", periode: "", nilai: "", pct: "" }]); }}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800">
            {terminProjs.map(([np, p]) => (
              <option key={np} value={np}>{np} · {p.nama} — Kontrak {formatIDR(p.contract)}</option>
            ))}
          </select>
        </label>

        {/* Termin yang sudah ada */}
        {existing.length > 0 && (
          <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="mb-2 text-xs font-medium text-slate-500">Termin sudah terdaftar:</div>
            <div className="flex flex-wrap gap-2">
              {[...existing].sort((a, b) => sortPer(a.periode).localeCompare(sortPer(b.periode))).map(t => (
                <span key={t.id}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    t.piutang_usaha === D ? "bg-emerald-100 text-emerald-700" : "bg-violet-50 text-violet-700"
                  }`}>
                  {t.no_termin}
                  <span className="opacity-60">· {t.periode}</span>
                  {t.nilai_invoice && <span className="opacity-60">· {formatIDR(t.nilai_invoice)}</span>}
                  {t.piutang_usaha === D && <CheckCircle2 size={12} />}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Input termin baru */}
        <div className="mb-2 grid grid-cols-[2fr_1fr_2fr_1fr_24px] gap-2 px-1">
          {["Label Termin","Periode","Nilai Invoice (Rp)","% Kontrak",""].map((h, i) => (
            <span key={i} className="text-[11px] font-medium text-slate-400">{h}</span>
          ))}
        </div>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_2fr_1fr_24px] items-center gap-2">
              <input value={r.no_termin} onChange={e => setF(i, "no_termin", e.target.value)}
                placeholder="DP / Termin 1 / Final"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
              <input value={r.periode} onChange={e => setF(i, "periode", e.target.value)}
                placeholder="MM-YYYY"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
              <input value={r.nilai} onChange={e => setF(i, "nilai", e.target.value)}
                placeholder="contoh: 400000000"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
              <input value={r.pct} onChange={e => setF(i, "pct", e.target.value)}
                placeholder="20" type="number" min="0" max="100"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
              <button onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))}
                disabled={rows.length === 1}
                className="text-slate-300 hover:text-rose-400 disabled:pointer-events-none disabled:opacity-0">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => setRows(prev => [...prev, { no_termin: "", periode: "", nilai: "", pct: "" }])}
          className="mt-2 flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800">
          <Plus size={14} /> Tambah baris termin
        </button>

        {/* PREVIEW: Cumulative progress */}
        {(existing.length > 0 || rows.some(r => r.pct)) && (
          <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="mb-2 text-xs font-medium text-slate-500">Preview Jadwal Termin:</div>
            <div className="space-y-1 text-[11px]">
              {(() => {
                const allTermins = [...existing, ...rows.filter(r => r.pct)]
                  .sort((a, b) => sortPer(a.periode || "00-0000").localeCompare(sortPer(b.periode || "00-0000")));
                let cumul = 0;
                return allTermins.map((t, i) => {
                  const pct = t.pct ? parseFloat(t.pct) : 0;
                  cumul += pct;
                  const isNew = !existing.some(e => e.id === t.id);
                  const warn = cumul > 100;
                  return (
                    <div key={i} className={`flex items-center gap-2 ${warn ? "text-rose-600" : "text-slate-600"}`}>
                      <span className={`w-16 font-medium ${isNew ? "font-bold" : ""}`}>
                        {t.no_termin || "(baru)"}: {pct}%
                      </span>
                      <span className="text-slate-400">→ Kumulatif {cumul}%</span>
                      {warn && <AlertTriangle size={12} className="text-rose-500" />}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {localMsg
              ? <span className="text-rose-500">{localMsg}</span>
              : "Semua termin baru akan dibuat dengan status Not Done."}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">
              Batal
            </button>
            <button onClick={handleSave}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">
              Simpan Termin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
