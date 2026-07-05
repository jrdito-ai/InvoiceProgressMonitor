import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  LayoutDashboard,
  LogOut,
  Plus,
  Trash2,
  UserCog,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuthContext";
import { useUserSessions } from "../hooks/useUserSessions";
import { useMonthlyStatus, useProfiles } from "../hooks/useMonthlyStatus";
import UserStatistics from "./UserStatistics";

const D = "Done";
const N = "Not Done";
const STAGES = [
  { key: "opname", label: "Opname" },
  { key: "bapp", label: "BAPP" },
  { key: "submit_invoice", label: "Submit Invoice" },
  { key: "correct_invoice", label: "Correct Invoice" },
  { key: "piutang_usaha", label: "Piutang Usaha" },
];
const PAYMENT_TYPE_LABELS = {
  monthly: "Monthly",
  termin: "Termin",
  progress_payment: "Progress Payment",
  milestone: "Milestone",
  turnkey: "Turnkey",
};
const PAYMENT_TYPE_COLORS = {
  monthly: "bg-sky-50 text-sky-700",
  termin: "bg-violet-50 text-violet-700",
  progress_payment: "bg-teal-50 text-teal-700",
  milestone: "bg-amber-50 text-amber-700",
  turnkey: "bg-rose-50 text-rose-700",
};
const ROLE_LABELS = { admin: "Admin", editor: "Editor", viewer: "Viewer" };
const SUPER_VIEWERS = ["dept.oc@adhi.co.id"];

const toPeriodDate = (periode) => `${periode}-01`;
const toNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : null;
};
const formatIDR = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(number);
};
const formatDateID = (value) => {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};
const formatPeriodMMMYYYY = (value) => {
  if (!value) return "-";
  const [year, month] = value.slice(0, 7).split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${months[Number(month) - 1]}-${year}`;
};
const formatPeriodMMMMYYYY = (value) => {
  if (!value) return "-";
  const [year, month] = value.slice(0, 7).split("-");
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${months[Number(month) - 1].toUpperCase()}-${year}`;
};
const formatPeriodWithContext = (value, appliedPeriode) => {
  if (!value) return "-";
  const monthYear = formatPeriodMMMYYYY(value);
  const isCurrent = value.slice(0, 7) === appliedPeriode.slice(0, 7);
  return `${monthYear} • ${isCurrent ? "Current" : "Previous"}`;
};

function Pill({ value, editable, disabled, title, onClick }) {
  const done = value === D;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!editable || disabled}
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${done ? "bg-emerald-500 text-white" : "border border-slate-200 bg-slate-100 text-slate-500"} ${editable && !disabled ? "hover:brightness-95 cursor-pointer" : "cursor-not-allowed opacity-50"}`}
    >
      {done ? <CheckCircle2 size={12} /> : <span className="h-2.5 w-2.5 rounded-full border border-slate-400" />}
      {done ? "Done" : "Not Done"}
    </button>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold leading-tight text-slate-900">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function StatusBadge({ row }) {
  if (row.nilai_progress_approved) return <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Approved</span>;
  if (row.nilai_progress_submitted) return <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">Submitted</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">Draft</span>;
}

function EmptyState({ title, subtitle }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="text-sm font-medium text-slate-700">{title}</div>
      <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
    </div>
  );
}

export default function InvoiceProgressMonitor() {
  const { profile, logout, isAdmin } = useAuth();
  const isSuperViewer = SUPER_VIEWERS.includes(profile?.email);
  const [periode, setPeriode] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });
  const [tab, setTab] = useState("summary");
  const [fDept, setFDept] = useState("Semua");
  const [applied, setApplied] = useState(() => {
    const today = new Date();
    return { periode: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`, dept: "Semua" };
  });
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [newRow, setNewRow] = useState({ no_project: "", event_type: "", invoice_label: "", nilai_progress: "", pct_termin: "", event_type_locked: false });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalSuccess, setCreateModalSuccess] = useState(false);
  const [createModalError, setCreateModalError] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editFormData, setEditFormData] = useState({ pct_termin: "", nilai_progress: "" });
  const [editModalError, setEditModalError] = useState("");
  const [editModalSuccess, setEditModalSuccess] = useState(false);
  const [ketState, setKetState] = useState({});
  const [targetDraftState, setTargetDraftState] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const {
    data,
    loading,
    error,
    updateStatus,
    updateTargets,
    updateInvoiceFields,
    createInvoice,
    deleteInvoice,
    submitNilaiProgress,
    approveNilaiProgress,
  } = useMonthlyStatus(applied.periode);
  const { profiles, loading: profilesLoading, updateRole } = useProfiles();
  const userSessions = useUserSessions(tab === "statistics" ? "User Statistics" : tab === "input" ? "Input & Edit" : tab);

  useEffect(() => {
    (async () => {
      setProjectsLoading(true);
      const { data: result } = await supabase.from("projects").select("*").order("no_project");
      setProjects(result || []);
      setProjectsLoading(false);
    })();
  }, []);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };
  const canToggleStage = (row, stageIndex) => {
    for (let i = 0; i < stageIndex; i += 1) {
      if (row[STAGES[i].key] !== D) {
        return { allowed: false, reason: `${STAGES[i].label} harus diselesaikan terlebih dahulu` };
      }
    }
    return { allowed: true, reason: "" };
  };
  const canEdit = profile?.role === "admin" || profile?.role === "editor";
  const depts = useMemo(() => ["Semua", ...new Set(projects.map((p) => p.departemen))].filter(Boolean).sort(), [projects]);
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.no_project, project])), [projects]);
  const selectableProjects = useMemo(() => projects.filter((p) => applied.dept === "Semua" || p.departemen === applied.dept), [projects, applied.dept]);
  const rows = useMemo(() => {
    if (isSuperViewer) return data;
    return data.filter((r) => applied.dept === "Semua" || r.departemen === applied.dept);
  }, [data, applied.dept, isSuperViewer]);
  const isFutureSelectedPeriod = useMemo(() => {
    if (!applied.periode) return false;
    const [year, month] = applied.periode.split("-").map(Number);
    const selected = new Date(year, month - 1, 1).getTime();
    const current = new Date();
    const todayMonth = new Date(current.getFullYear(), current.getMonth(), 1).getTime();
    return selected > todayMonth;
  }, [applied.periode]);
  const searchableRows = useMemo(() => [...rows].sort((a, b) => {
    const aKey = `${a.no_project || ""}-${a.periode || ""}-${a.event_type || ""}`;
    const bKey = `${b.no_project || ""}-${b.periode || ""}-${b.event_type || ""}`;
    return aKey.localeCompare(bKey);
  }), [rows]);
  const filteredRows = useMemo(() => {
    if (!appliedSearch.trim()) return searchableRows;
    const q = appliedSearch.toLowerCase();
    return searchableRows.filter((r) =>
      [
        r.no_project,
        r.profit_center,
        r.nama_project,
        r.departemen,
        projectMap.get(r.no_project)?.no_project,
        projectMap.get(r.no_project)?.profit_center,
        projectMap.get(r.no_project)?.nama_project,
        projectMap.get(r.no_project)?.departemen,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [searchableRows, appliedSearch, projectMap]);
  const previousMonthFilteredRows = useMemo(() => filteredRows.filter((r) => r.month_group === "previous"), [filteredRows]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const visibleRows = filteredRows.filter((row) => {
      if (row.id === null) return row.month_group === "previous";
      if (isFutureSelectedPeriod) {
        return Number(row.nilai_progress || 0) > 0;
      }
      return true;
    });
    return visibleRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, isFutureSelectedPeriod]);

  const kpi = useMemo(() => ({
    total: rows.filter((row) => row.id !== null).length,
    monthly: rows.filter((row) => row.event_type === "monthly").length,
    termin: rows.filter((row) => row.event_type === "termin").length,
    totalNilai: rows.reduce((sum, row) => sum + Number(row.nilai_progress || 0), 0),
    konversiPiutang: rows.length > 0 ? Math.round((rows.filter((row) => row.piutang_usaha === D).length / rows.length) * 100) : 0,
    overdue: rows.filter((row) => (
      row.target_cash_in && row.target_cash_in < new Date().toISOString().slice(0, 10)
    ) || (
      row.target_konversi_pu && row.target_konversi_pu < new Date().toISOString().slice(0, 10) && row.piutang_usaha !== D
    )).length,
  }), [rows]);
  const funnel = useMemo(() => STAGES.map((stage) => ({ name: stage.label, count: rows.filter((row) => row[stage.key] === D).length })), [rows]);
  const nilaiPipeline = useMemo(() => STAGES.map((stage) => ({
    name: stage.label,
    nilai: Math.round(rows.filter((row) => row[stage.key] === D).reduce((sum, row) => sum + Number(row.nilai_progress || 0), 0) / 1_000_000),
  })), [rows]);
  const funnelColors = ["#6366f1", "#6d6ff2", "#818cf8", "#a5b4fc", "#c7d2fe"];
  const nilaiColors = ["#0ea5e9", "#0284c7", "#0369a1", "#075985", "#0c4a6e"];
  const stageColors = {
    opname: "#6366f1",
    bapp: "#7c88fa",
    submit_invoice: "#93a0fd",
    correct_invoice: "#b3bdfd",
    piutang_usaha: "#d7ddff",
  };
  const statusByDept = useMemo(() => {
    const map = {};
    rows.forEach((row) => {
      const dept = row.departemen || "Lainnya";
      const item = (map[dept] ||= {
        departemen: dept,
        opname: 0,
        bapp: 0,
        submit_invoice: 0,
        correct_invoice: 0,
        piutang_usaha: 0,
      });
      STAGES.forEach((stage) => {
        if (row[stage.key] === D) item[stage.key] += 1;
      });
    });
    return Object.values(map);
  }, [rows]);
  const overdueRows = useMemo(() => rows.filter((row) => (
    row.target_cash_in && row.target_cash_in < new Date().toISOString().slice(0, 10)
  ) || (
    row.target_konversi_pu && row.target_konversi_pu < new Date().toISOString().slice(0, 10) && row.piutang_usaha !== D
  )), [rows]);

  const onLoad = () => {
    setApplied({ periode, dept: fDept });
    setAppliedSearch(searchQuery);
    setCurrentPage(1);
  };
  const isKeteranganLocked = (row, field) => {
    if (row.month_group === "previous") return true;
    return Boolean(row[field]);
  };
  const getTargetDraftValue = (row, field) => {
    const draftKey = `${row.id}-${field}`;
    return targetDraftState[draftKey] ?? row[field] ?? "";
  };
  const toggleStage = async (row, key) => {
    if (!canEdit) return;
    setBusy(`${row.id}:${key}`);
    const stageIndex = STAGES.findIndex((stage) => stage.key === key);
    const validation = canToggleStage(row, stageIndex);
    if (!validation.allowed) {
      setBusy("");
      flash(validation.reason);
      return;
    }

    const nextValue = row[key] === D ? N : D;
    const updates = { [key]: nextValue };
    if (nextValue === N) {
      STAGES.slice(stageIndex + 1).forEach((stage) => {
        updates[stage.key] = N;
      });
    }

    const result = await updateStatus(row.id, updates, undefined, row.version);
    setBusy("");
    flash(result.success ? "Perubahan tersimpan" : result.error || "Gagal update");
  };
  const changeTarget = async (row, updates) => {
    if (!canEdit) return;
    setBusy(String(row.id));
    const result = await updateTargets(row.id, updates, row.version);
    setBusy("");
    if (result.success) {
      setTargetDraftState((prev) => {
        const next = { ...prev };
        Object.keys(updates).forEach((field) => {
          delete next[`${row.id}-${field}`];
        });
        return next;
      });
      return;
    }
    flash(result.error || "Gagal update");
  };
  const saveKeterangan = async (row, field) => {
    if (!canEdit || row.month_group === "previous") return;
    const value = ketState[`${row.id}-${field}`];
    setBusy(`ket:${row.id}:${field}`);
    const result = await updateTargets(row.id, { [field]: value || null }, row.version);
    setBusy("");
    if (result.success) {
      flash("Keterangan tersimpan");
      setKetState((prev) => {
        const next = { ...prev };
        delete next[`${row.id}-${field}`];
        return next;
      });
    } else {
      flash(result.error || "Gagal simpan keterangan");
    }
  };
  const openEditModal = (row) => {
    setEditingRow(row);
    setEditFormData({
      pct_termin: row.pct_termin || "",
      nilai_progress: row.nilai_progress || "",
    });
    setEditModalError("");
    setEditModalSuccess(false);
    setEditModalOpen(true);
  };
  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingRow(null);
    setEditFormData({ pct_termin: "", nilai_progress: "" });
    setEditModalError("");
    setEditModalSuccess(false);
  };
  const submitEditModal = async () => {
    if (!editingRow) return;
    setEditModalError("");
    const nilaiValue = toNumber(editFormData.nilai_progress);
    if (!nilaiValue || nilaiValue <= 0) 
      return setEditModalError("Nilai progress wajib diisi dan lebih dari 0");
    const pctValue = toNumber(editFormData.pct_termin);
    if (!pctValue || pctValue <= 0 || pctValue > 100) 
      return setEditModalError("Progress (%) wajib diisi antara 1-100");
    setBusy(`edit:${editingRow.id}`);
    const result = await submitNilaiProgress(editingRow.id, nilaiValue, editingRow.version, { pct_termin: pctValue });
    setBusy("");
    if (result.success) {
      setEditModalSuccess(true);
    } else {
      setEditModalError(result.error || "Gagal submit nilai progress");
    }
  };
  const approveNilai = async (row, approved) => {
    setBusy(`approve:${row.id}`);
    const result = await approveNilaiProgress(row.id, approved, row.version);
    setBusy("");
    flash(result.success ? (approved ? "Nilai progress approved" : "Nilai progress rejected") : result.error || "Gagal approval");
  };
  const openCreateModal = () => {
    setNewRow({ no_project: "", event_type: "", invoice_label: "", nilai_progress: "", pct_termin: "", event_type_locked: false });
    setCreateModalSuccess(false);
    setCreateModalError("");
    setIsCreateModalOpen(true);
  };
  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setCreateModalSuccess(false);
    setCreateModalError("");
    setNewRow({ no_project: "", event_type: "", invoice_label: "", nilai_progress: "", pct_termin: "", event_type_locked: false });
  };
  const createManualRow = async () => {
    setCreateModalError("");
    if (!newRow.no_project) return setCreateModalError("Pilih proyek terlebih dahulu");
    if (!newRow.event_type) return setCreateModalError("Pilih tipe event terlebih dahulu");
    if (!newRow.invoice_label.trim()) return setCreateModalError("Invoice label wajib diisi");
    const nilaiValue = toNumber(newRow.nilai_progress);
    if (!nilaiValue || nilaiValue <= 0) return setCreateModalError("Nilai progress wajib diisi dan lebih dari 0");
    const pctValue = toNumber(newRow.pct_termin);
    if (!pctValue || pctValue <= 0 || pctValue > 100) return setCreateModalError("Progress (%) wajib diisi antara 1-100");
    const result = await createInvoice({
      no_project: newRow.no_project,
      periode: toPeriodDate(applied.periode),
      event_type: newRow.event_type,
      invoice_label: newRow.invoice_label.trim(),
      pct_termin: pctValue,
      nilai_progress: nilaiValue,
    });
    if (result.success) {
      setNewRow({ no_project: "", event_type: "", invoice_label: "", nilai_progress: "", pct_termin: "", event_type_locked: false });
      setCreateModalSuccess(true);
    } else {
      setCreateModalError(result.error || "Gagal membuat row invoice");
    }
  };
  const handleCreateForProject = (project) => {
    setNewRow({
      no_project: project.no_project,
      event_type: project.payment_type || "monthly",
      invoice_label: "",
      nilai_progress: "",
      pct_termin: "",
      event_type_locked: true,
    });
    setCreateModalSuccess(false);
    setCreateModalError("");
    setIsCreateModalOpen(true);
  };

  if (loading || projectsLoading) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">Loading...</div>;
  if (error) return <div className="flex h-screen items-center justify-center bg-slate-50 text-rose-600">{error}</div>;

  const tabs = [
    { key: "summary", label: "Summary", Icon: LayoutDashboard },
    { key: "input", label: "Input & Edit", Icon: Database },
    ...(isAdmin ? [{ key: "statistics", label: "User Statistics", Icon: UserCog }] : []),
    ...(isAdmin ? [{ key: "users", label: "Kelola User", Icon: UserCog }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white"><CalendarClock size={18} /></div>
            <div>
              <div className="text-sm font-semibold leading-tight">Invoice Progress Monitor</div>
              <div className="text-[11px] text-slate-400">Monthly and termin billing workflow</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs text-slate-500 sm:block">{profile?.email}<div className="text-[11px] text-slate-400">{ROLE_LABELS[profile?.role] || profile?.role}</div></div>
            <button onClick={logout} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"><LogOut size={15} /> Logout</button>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl gap-1 px-4">
          {tabs.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${tab === item.key ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500"}`}><item.Icon size={16} /> {item.label}</button>)}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5">
        {toast && <div className="fixed right-4 top-20 z-30 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>}
        <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">Periode<input value={periode} onChange={(e) => setPeriode(e.target.value)} type="month" className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800" /></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">Departemen<select value={fDept} onChange={(e) => setFDept(e.target.value)} className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800">{depts.map((dept) => <option key={dept}>{dept}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">Cari<input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="text" placeholder="Cari proyek, profit center, departemen..." className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800" /></label>
          <button onClick={onLoad} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Muat Data</button>
        </div>

        {tab === "summary" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Billing Events" value={kpi.total} sub={`${kpi.monthly} monthly · ${kpi.termin} termin`} />
              <Kpi label="Total Nilai Progress" value={formatIDR(kpi.totalNilai)} sub="seluruh billing event" />
              <Kpi label="Konversi Piutang Usaha" value={`${kpi.konversiPiutang}%`} sub="dari total events" />
              <Kpi label="Overdue" value={kpi.overdue} sub="target konversi / cash in terlewat" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3">
                  <div className="text-sm font-semibold text-slate-800">Pipeline — Jumlah Event</div>
                  <div className="text-xs text-slate-400">Billing event yang selesaikan tiap tahap</div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={funnel} layout="vertical" margin={{ left: 12, right: 32 }}>
                    <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                    <YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 12, fill: "#475569" }} />
                    <Tooltip cursor={{ fill: "#f8fafc" }} formatter={(value) => [value, "Event"]} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {funnel.map((_, index) => <Cell key={index} fill={funnelColors[index]} />)}
                      <LabelList dataKey="count" position="right" style={{ fontSize: 12, fill: "#475569" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3">
                  <div className="text-sm font-semibold text-slate-800">Pipeline — Nilai Progress (juta Rp)</div>
                  <div className="text-xs text-slate-400">Nilai yang sudah mencapai tiap tahap</div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={nilaiPipeline} layout="vertical" margin={{ left: 12, right: 48 }}>
                    <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 12, fill: "#475569" }} />
                    <Tooltip cursor={{ fill: "#f8fafc" }} formatter={(value) => [`Rp ${value} jt`, "Nilai"]} />
                    <Bar dataKey="nilai" radius={[0, 6, 6, 0]}>
                      {nilaiPipeline.map((_, index) => <Cell key={index} fill={nilaiColors[index]} />)}
                      <LabelList dataKey="nilai" position="right" style={{ fontSize: 11, fill: "#475569" }} formatter={(value) => `${value}jt`} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3">
                <div className="text-sm font-semibold text-slate-800">Status per Departemen</div>
                <div className="text-xs text-slate-400">Count status Done untuk opname, BAPP, submit invoice, correct invoice, dan piutang usaha.</div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={statusByDept} margin={{ left: -12, right: 8 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="departemen" tick={{ fontSize: 11, fill: "#475569" }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                  <Tooltip cursor={{ fill: "#f8fafc" }} />
                  <Bar dataKey="opname" stackId="a" fill={stageColors.opname} />
                  <Bar dataKey="bapp" stackId="a" fill={stageColors.bapp} />
                  <Bar dataKey="submit_invoice" stackId="a" fill={stageColors.submit_invoice} />
                  <Bar dataKey="correct_invoice" stackId="a" fill={stageColors.correct_invoice} />
                  <Bar dataKey="piutang_usaha" stackId="a" fill={stageColors.piutang_usaha} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                {STAGES.map((stage) => (
                  <span key={stage.key} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: stageColors[stage.key] }} />
                    {stage.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3">
                <div className="text-sm font-semibold text-slate-800">Watchlist Overdue</div>
                <div className="text-xs text-slate-400">Target konversi piutang / cash in yang terlewat.</div>
              </div>
              {overdueRows.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">Tidak ada proyek overdue</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {overdueRows.map((row) => (
                    <li key={row.id} className="flex items-start gap-3 py-2.5">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-500" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-sm">
                          <span className="font-medium text-slate-800">{row.no_project}</span>
                          {row.no_termin && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">{row.no_termin}</span>}
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-600">{row.nama_project}</span>
                          {row.nilai_progress ? <span className="ml-auto text-xs text-slate-400">{formatIDR(row.nilai_progress)}</span> : null}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {row.target_konversi_pu && row.target_konversi_pu < new Date().toISOString().slice(0, 10) && row.piutang_usaha !== D ? <>Konversi PU jatuh tempo {formatDateID(row.target_konversi_pu)}. </> : null}
                          {row.target_cash_in && row.target_cash_in < new Date().toISOString().slice(0, 10) ? <>Cash in target {formatDateID(row.target_cash_in)}.</> : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === "input" && (
          <div className="space-y-4">
            {/* Create Modal */}
            {isCreateModalOpen && (
              <div className="fixed inset-0 z-40 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.45)" }}>
                <div className="relative w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white shadow-xl mx-4" onKeyDown={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">Tambah Row Manual</div>
                      <div className="text-xs text-slate-400">Buat billing event baru untuk periode aktif</div>
                    </div>
                    <button onClick={closeCreateModal} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div className="space-y-3 px-5 py-4">
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                      Pilih Proyek <span className="text-rose-500">*</span>
                      <select value={newRow.no_project} onChange={(e) => {
                        const selectedProject = selectableProjects.find(p => p.no_project === e.target.value);
                        setNewRow((prev) => ({
                          ...prev,
                          no_project: e.target.value,
                          event_type: selectedProject?.payment_type || "",
                          event_type_locked: Boolean(selectedProject),
                        }));
                      }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800">
                        <option value="">Pilih proyek...</option>
                        {selectableProjects.map((project) => (
                          <option key={project.no_project} value={project.no_project}>{project.no_project} — {project.nama_project}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                      Event Type <span className="text-rose-500">*</span>
                      {newRow.event_type_locked && newRow.event_type ? (
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PAYMENT_TYPE_COLORS[newRow.event_type] || "bg-slate-100 text-slate-600"}`}>
                            {PAYMENT_TYPE_LABELS[newRow.event_type] || newRow.event_type}
                          </span>
                          <span className="text-xs text-slate-400">Tipe dikunci sesuai proyek</span>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">Pilih proyek dahulu</div>
                      )}
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                      Invoice Label <span className="text-rose-500">*</span>
                      <input value={newRow.invoice_label} onChange={(e) => setNewRow((prev) => ({ ...prev, invoice_label: e.target.value }))} placeholder="Wajib diisi" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                        Progress (%) <span className="text-rose-500">*</span>
                        <input value={newRow.pct_termin} onChange={(e) => setNewRow((prev) => ({ ...prev, pct_termin: e.target.value }))} placeholder="Wajib diisi (1–100)" type="number" min="1" max="100" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800" />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                        Nilai Progress <span className="text-rose-500">*</span>
                        <input value={newRow.nilai_progress} onChange={(e) => setNewRow((prev) => ({ ...prev, nilai_progress: e.target.value }))} placeholder="Wajib diisi" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300" />
                      </label>
                    </div>
                    {createModalError && (
                      <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">{createModalError}</div>
                    )}
                    {createModalSuccess && (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Row invoice berhasil dibuat.</div>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                    <button onClick={closeCreateModal} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                    {!createModalSuccess && (
                      <button onClick={createManualRow} disabled={!canEdit} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"><Plus size={14} /> Create</button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Edit Modal */}
            {editModalOpen && editingRow && (
              <div className="fixed inset-0 z-40 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.45)" }}>
                <div className="relative w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white shadow-xl mx-4">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">Edit Nilai Progress</div>
                      <div className="text-xs text-slate-400">{editingRow.no_project} — {editingRow.nama_project}</div>
                    </div>
                    <button onClick={closeEditModal} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div className="space-y-3 px-5 py-4">
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <div className="font-medium text-slate-700">{PAYMENT_TYPE_LABELS[editingRow.event_type]}</div>
                      {editingRow.invoice_label && <div className="text-xs text-slate-500">{editingRow.invoice_label}</div>}
                    </div>
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                      Progress (%) <span className="text-rose-500">*</span>
                      <input value={editFormData.pct_termin} onChange={(e) => setEditFormData(prev => ({ ...prev, pct_termin: e.target.value }))} placeholder="Wajib diisi (1–100)" type="number" min="1" max="100" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800" />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                      Nilai Progress <span className="text-rose-500">*</span>
                      <input value={editFormData.nilai_progress} onChange={(e) => setEditFormData(prev => ({ ...prev, nilai_progress: e.target.value }))} placeholder="Wajib diisi" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800" />
                    </label>
                    {editModalError && (
                      <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">{editModalError}</div>
                    )}
                    {editModalSuccess && (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Nilai progress submitted untuk approval.</div>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                    <button onClick={closeEditModal} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                    {!editModalSuccess && (
                      <button onClick={submitEditModal} disabled={!canEdit || busy === `edit:${editingRow.id}`} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Submit</button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Input & Edit</div>
                  <div className="text-xs text-slate-400">Semua proyek tersedia untuk periode aktif. Klik proyek tanpa data untuk membuat row baru.</div>
                </div>
                {canEdit && (
                  <button onClick={openCreateModal} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"><Plus size={15} /> Create</button>
                )}
              </div>
            </div>

            {rows.length === 0 ? <EmptyState title="Belum ada data" subtitle="Tidak ada proyek untuk filter departemen yang dipilih." /> : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-[1280px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Project</th><th className="px-3 py-3">Periode</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Nilai Progress</th><th className="px-3 py-3">Progress (%)</th>{STAGES.map((stage) => <th key={stage.key} className="px-3 py-3">{stage.label}</th>)}<th className="px-3 py-3">Target Konversi Piutang Usaha</th><th className="px-3 py-3">Target Cash In</th><th className="px-3 py-3">Action</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedRows.map((row) => {
                      if (row.id === null && row.month_group === "previous") {
                        return (
                          <tr key={row.no_project} className="align-top">
                            <td className="px-3 py-3"><div className="font-medium text-slate-800">{row.no_project} · {row.profit_center || "-"}</div><div className="text-xs text-slate-400">{row.nama_project} · {row.departemen || "-"}</div></td>
                          <td className="px-3 py-3 text-slate-600">
                            <div className="flex items-center gap-2">
                              <span>{formatPeriodWithContext(row.periode || applied.periode, applied.periode)}</span>
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Incomplete</span>
                            </div>
                          </td>
                            <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${PAYMENT_TYPE_COLORS[row.payment_type] || "bg-slate-50 text-slate-700"}`}>{PAYMENT_TYPE_LABELS[row.payment_type] || row.payment_type}</span></td>
                            <td colSpan={row.nilai_progress ? 1 : 8} className="px-3 py-3"><div className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3"><span className="text-sm text-slate-500">No Data - Click to create</span><button onClick={() => handleCreateForProject(row)} disabled={!canEdit} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Create</button></div></td>
                          </tr>
                        );
                      }
                      if (row.id === null) return null;
                      const lockedNilai = row.nilai_progress_submitted && !isAdmin;
                      return (
                        <tr key={row.id} className="align-top">
                          <td className="px-3 py-3"><div className="font-medium text-slate-800">{row.no_project} · {row.profit_center || "-"}</div><div className="text-xs text-slate-400">{row.nama_project} · {row.departemen || "-"}</div></td>
                          <td className="px-3 py-3 text-slate-600">
                            <div className="flex items-center gap-2">
                              <span>{formatPeriodWithContext(row.periode, applied.periode)}</span>
                              {row.month_group === "previous" && row.done_count < STAGES.length && (
                                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Incomplete</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${PAYMENT_TYPE_COLORS[row.event_type] || "bg-slate-50 text-slate-700"}`}>{PAYMENT_TYPE_LABELS[row.event_type] || row.event_type}</span>{row.invoice_label && <div className="mt-1 text-xs text-slate-500">{row.invoice_label}</div>}<div className="mt-1"><StatusBadge row={row} /></div></td>
                          <td colSpan={row.nilai_progress ? 1 : 8} className="px-3 py-3">
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3">
                              <div className={row.nilai_progress ? "flex-1 min-w-0" : ""}>
                                {row.nilai_progress ? (
                                  <>
                                    <div className={row.month_group === "previous" ? "text-sm text-slate-400" : "text-sm"}>{row.nilai_progress}</div>
                                    <div className="mt-1"><StatusBadge row={row} /></div>
                                  </>
                                ) : (
                                  <span className="text-sm text-slate-500">No Data - Click to create</span>
                                )}
                              </div>
                              {canEdit && row.month_group !== "previous" && <button onClick={() => handleCreateForProject(row)} className="flex-shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Create</button>}
                            </div>
                            {row.nilai_progress && isAdmin && row.nilai_progress_submitted && !row.nilai_progress_approved && row.month_group !== "previous" && (
                              <div className="mt-2 flex gap-1">
                                <button onClick={() => approveNilai(row, true)} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white">Approve</button>
                                <button onClick={() => approveNilai(row, false)} className="rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white">Reject</button>
                              </div>
                            )}
                          </td>
                          {row.nilai_progress && <td className="px-3 py-3"><div className={row.month_group === "previous" ? "text-sm text-slate-400" : "text-sm"}>{row.pct_termin || "-"}</div>{row.pct_termin_cumul ? <div className="mt-1 text-xs text-slate-400">Cumul {row.pct_termin_cumul}%</div> : null}</td>}
                          {row.nilai_progress && STAGES.map((stage, stageIndex) => {
                            const validation = canToggleStage(row, stageIndex);
                            return (
                              <td key={stage.key} className="px-3 py-3">
                                <Pill
                                  value={row[stage.key]}
                                  editable={canEdit && row.month_group !== "previous" && busy !== `${row.id}:${stage.key}`}
                                  disabled={!validation.allowed}
                                  title={validation.reason}
                                  onClick={() => {
                                    if (!validation.allowed) {
                                      flash(validation.reason);
                                      return;
                                    }
                                    toggleStage(row, stage.key);
                                  }}
                                />
                              </td>
                            );
                          })}
                          {row.nilai_progress && <td className="px-3 py-3"><div className="space-y-1.5"><input value={getTargetDraftValue(row, "target_konversi_pu")} onChange={(e) => setTargetDraftState((prev) => ({ ...prev, [`${row.id}-target_konversi_pu`]: e.target.value }))} onBlur={(e) => { const nextValue = e.target.value || null; if ((row.target_konversi_pu || null) === nextValue) { setTargetDraftState((prev) => { const next = { ...prev }; delete next[`${row.id}-target_konversi_pu`]; return next; }); return; } changeTarget(row, { target_konversi_pu: nextValue }); }} disabled={!canEdit || row.month_group === "previous"} type="date" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50" /><input value={(ketState[`${row.id}-ket_konversi_pu`] ?? row.ket_konversi_pu) || ""} onChange={(e) => setKetState((prev) => ({ ...prev, [`${row.id}-ket_konversi_pu`]: e.target.value }))} disabled={!canEdit || isKeteranganLocked(row, "ket_konversi_pu")} placeholder="Keterangan konversi PU" className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-100 disabled:text-slate-500" />{!isKeteranganLocked(row, "ket_konversi_pu") && <button onClick={() => saveKeterangan(row, "ket_konversi_pu")} disabled={!canEdit || busy === `ket:${row.id}:ket_konversi_pu`} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">Simpan Keterangan</button>}</div></td>}
                          {row.nilai_progress && <td className="px-3 py-3"><div className="space-y-1.5"><input value={getTargetDraftValue(row, "target_cash_in")} onChange={(e) => setTargetDraftState((prev) => ({ ...prev, [`${row.id}-target_cash_in`]: e.target.value }))} onBlur={(e) => { const nextValue = e.target.value || null; if ((row.target_cash_in || null) === nextValue) { setTargetDraftState((prev) => { const next = { ...prev }; delete next[`${row.id}-target_cash_in`]; return next; }); return; } changeTarget(row, { target_cash_in: nextValue }); }} disabled={!canEdit || row.month_group === "previous"} type="date" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50" /><input value={(ketState[`${row.id}-ket_cash_in`] ?? row.ket_cash_in) || ""} onChange={(e) => setKetState((prev) => ({ ...prev, [`${row.id}-ket_cash_in`]: e.target.value }))} disabled={!canEdit || isKeteranganLocked(row, "ket_cash_in")} placeholder="Keterangan cash in" className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-100 disabled:text-slate-500" />{!isKeteranganLocked(row, "ket_cash_in") && <button onClick={() => saveKeterangan(row, "ket_cash_in")} disabled={!canEdit || busy === `ket:${row.id}:ket_cash_in`} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">Simpan Keterangan</button>}</div></td>}
                          {row.nilai_progress && <td className="px-3 py-3"><button onClick={async () => { const result = await deleteInvoice(row.id); flash(result.success ? "Row dihapus" : result.error || "Gagal hapus"); }} disabled={!canEdit || row.month_group === "previous"} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><Trash2 size={16} /></button></td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
                  <div>Page {currentPage} of {totalPages} · {filteredRows.length} total projects{previousMonthFilteredRows.length > 0 ? ` including ${previousMonthFilteredRows.length} previous month rows` : ""}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 disabled:opacity-50"><ChevronLeft size={14} /> Prev</button>
                    <button onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 disabled:opacity-50">Next <ChevronRight size={14} /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "statistics" && isAdmin && (
          <UserStatistics sessions={userSessions.activeSessions} loading={userSessions.loading} onRefresh={userSessions.fetchActiveSessions} formatTimeOnline={userSessions.formatTimeOnline} />
        )}

        {tab === "users" && isAdmin && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-slate-800">Kelola User</div>
            {profilesLoading ? <div className="text-sm text-slate-400">Loading users...</div> : <div className="space-y-2">{profiles.map((user) => <div key={user.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><div><div className="text-sm font-medium text-slate-700">{user.email}</div><div className="text-xs text-slate-400">{user.departemen || "All departments"}</div></div><select value={user.role} onChange={(e) => updateRole(user.id, e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">{Object.keys(ROLE_LABELS).map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></div>)}</div>}
          </div>
        )}
      </main>
    </div>
  );
}
