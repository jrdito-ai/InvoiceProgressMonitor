import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./useAuthContext";

const SUPER_VIEWERS = ["dept.oc@adhi.co.id"];

/**
 * Hook: useMonthlyStatus
 * Fetch all projects and selected-period monthly_status rows, then combine them.
 * @param {string} periode - MM-YYYY format
 * @returns {object} { data, loading, error, refetch, updateStatus, updateTargets, updateInvoiceFields, createInvoice, deleteInvoice, generatePeriod }
 */
export function useMonthlyStatus(periode) {
  const { profile } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const deptOrder = {
    INF1: 1,
    INF2: 2,
    GED: 3,
    "E&I": 4,
    PKA: 5,
  };

  const fetchData = useCallback(async () => {
    if (!periode || !profile) return;

    setLoading(true);
    setError(null);

    try {
      const isSuperViewer = SUPER_VIEWERS.includes(profile.email);
      const [year, month] = periode.split("-");
      const dateValue = `${year}-${month}-01`;
      const currentDate = new Date(`${dateValue}T00:00:00`);
      const previousDate = new Date(currentDate);
      previousDate.setMonth(previousDate.getMonth() - 1);
      const previousDateValue = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}-01`;
      let projectQuery = supabase
        .from("projects")
        .select("no_project, nama_project, departemen, profit_center, payment_type, contract_value")
        .order("no_project");

      if (profile.role !== "admin" && profile.departemen && !isSuperViewer) {
        projectQuery = projectQuery.eq("departemen", profile.departemen);
      }

      const { data: projects, error: projectsError } = await projectQuery;
      if (projectsError) throw projectsError;

      const projectIds = (projects || []).map((project) => project.no_project);
      let currentStatusRows = [];
      let previousStatusRows = [];

      if (projectIds.length > 0) {
        const [currentResult, previousResult] = await Promise.all([
          supabase
            .from("monthly_status")
            .select("*")
            .eq("periode", dateValue)
            .in("no_project", projectIds),
          supabase
            .from("monthly_status")
            .select("*")
            .eq("periode", previousDateValue)
            .in("no_project", projectIds),
        ]);

        if (currentResult.error) throw currentResult.error;
        if (previousResult.error) throw previousResult.error;

        currentStatusRows = currentResult.data || [];
        previousStatusRows = previousResult.data || [];
      }

      const rowMap = new Map();
      currentStatusRows.forEach((row) => {
        const doneCount = [row.opname, row.bapp, row.submit_invoice, row.correct_invoice, row.piutang_usaha]
          .filter((value) => value === "Done").length;
        const normalized = {
          ...row,
          month_group: "current",
          done_count: doneCount,
          progress_pct: Math.round((doneCount * 100) / 5),
          overdue_konversi_pu: Boolean(row.target_konversi_pu && row.piutang_usaha === "Not Done" && row.target_konversi_pu < new Date().toISOString().slice(0, 10)),
          overdue_cash_in: Boolean(row.target_cash_in && row.target_cash_in < new Date().toISOString().slice(0, 10)),
        };
        if (!rowMap.has(row.no_project)) rowMap.set(row.no_project, []);
        rowMap.get(row.no_project).push(normalized);
      });

      const isIncomplete = (row) => [row.opname, row.bapp, row.submit_invoice, row.correct_invoice, row.piutang_usaha].some((value) => value !== "Done");
      previousStatusRows.filter(isIncomplete).forEach((row) => {
        const doneCount = [row.opname, row.bapp, row.submit_invoice, row.correct_invoice, row.piutang_usaha]
          .filter((value) => value === "Done").length;
        const normalized = {
          ...row,
          month_group: "previous",
          done_count: doneCount,
          progress_pct: Math.round((doneCount * 100) / 5),
          overdue_konversi_pu: Boolean(row.target_konversi_pu && row.piutang_usaha === "Not Done" && row.target_konversi_pu < new Date().toISOString().slice(0, 10)),
          overdue_cash_in: Boolean(row.target_cash_in && row.target_cash_in < new Date().toISOString().slice(0, 10)),
        };
        if (!rowMap.has(row.no_project)) rowMap.set(row.no_project, []);
        rowMap.get(row.no_project).push(normalized);
      });

      const combined = [];
      (projects || []).forEach((project) => {
        const existingRows = rowMap.get(project.no_project) || [];
        if (existingRows.length === 0) {
          combined.push({
            id: null,
            no_project: project.no_project,
            nama_project: project.nama_project,
            departemen: project.departemen,
            profit_center: project.profit_center,
            payment_type: project.payment_type,
            event_type: project.payment_type,
            contract_value: project.contract_value,
            periode: dateValue,
            month_group: "current",
            invoice_label: null,
            invoice_seq: null,
            nilai_progress: null,
            nilai_progress_submitted: false,
            nilai_progress_approved: false,
            pct_termin: null,
            pct_termin_cumul: null,
            opname: null,
            bapp: null,
            submit_invoice: null,
            correct_invoice: null,
            piutang_usaha: null,
            target_konversi_pu: null,
            ket_konversi_pu: null,
            target_cash_in: null,
            ket_cash_in: null,
            updated_by: null,
            updated_at: null,
            version: null,
            done_count: 0,
            progress_pct: 0,
            overdue_konversi_pu: false,
            overdue_cash_in: false,
          });
          return;
        }

        existingRows.forEach((row) => {
          combined.push({
            ...row,
            nama_project: project.nama_project,
            departemen: project.departemen,
            profit_center: project.profit_center,
            payment_type: project.payment_type,
            contract_value: project.contract_value,
            event_type: row.event_type || project.payment_type,
          });
        });
      });

      combined.sort((a, b) => {
        const deptCompare = (deptOrder[a.departemen] || 999) - (deptOrder[b.departemen] || 999);
        if (deptCompare !== 0) return deptCompare;
        return a.no_project.localeCompare(b.no_project);
      });

      setData(combined);
    } catch (err) {
      setError(err.message);
      console.error("Fetch data error:", err);
    } finally {
      setLoading(false);
    }
  }, [periode, profile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Update billing event status (toggle Done/Not Done)
   * @param {number} id - row id
   * @param {string} fieldKey - opname, bapp, submit_invoice, correct_invoice, piutang_usaha
   * @param {string} newValue - "Done" atau "Not Done"
   * @param {number} currentVersion - current version untuk optimistic lock
   */
  const updateStatus = useCallback(
    async (id, fieldOrUpdates, newValue, currentVersion) => {
      try {
        const updates = typeof fieldOrUpdates === "string" ? { [fieldOrUpdates]: newValue } : fieldOrUpdates;
        const { error: updateError } = await supabase
          .from("monthly_status")
          .update({
            ...updates,
            version: currentVersion + 1, // Increment version
          })
          .eq("id", id)
          .eq("version", currentVersion); // Optimistic lock

        if (updateError) throw updateError;

        // Refetch to get latest data
        await fetchData();
        return { success: true };
      } catch (err) {
        setError(err.message);
        console.error("Update status error:", err);
        return { success: false, error: err.message };
      }
    },
    [fetchData]
  );

  /**
   * Update target dates + keterangan
   */
  const updateTargets = useCallback(
    async (id, updates, currentVersion) => {
      try {
        const { error: updateError } = await supabase
          .from("monthly_status")
          .update({
            ...updates,
            version: currentVersion + 1,
          })
          .eq("id", id)
          .eq("version", currentVersion);

        if (updateError) throw updateError;
        await fetchData();
        return { success: true };
      } catch (err) {
        setError(err.message);
        return { success: false, error: err.message };
      }
    },
    [fetchData]
  );

  /**
   * Update invoice metadata, including pct_termin and no_termin.
   */
  const updateInvoiceFields = useCallback(
    async (id, updates, currentVersion) => {
      try {
        const { error: updateError } = await supabase
          .from("monthly_status")
          .update({
            ...updates,
            version: currentVersion + 1,
          })
          .eq("id", id)
          .eq("version", currentVersion);

        if (updateError) throw updateError;
        await fetchData();
        return { success: true };
      } catch (err) {
        setError(err.message);
        console.error("Update invoice fields error:", err);
        return { success: false, error: err.message };
      }
    },
    [fetchData]
  );

  /**
   * Create manual monthly/termin billing event in selected period.
   */
  const createInvoice = useCallback(async (payload) => {
    try {
      const { data: existing } = await supabase
        .from("monthly_status")
        .select("invoice_seq")
        .eq("no_project", payload.no_project)
        .eq("periode", payload.periode)
        .eq("event_type", payload.event_type)
        .order("invoice_seq", { ascending: false })
        .limit(1);

      const nextSeq = (existing?.[0]?.invoice_seq || 0) + 1;
      const { error: insertError } = await supabase
        .from("monthly_status")
        .insert({
          no_project: payload.no_project,
          periode: payload.periode,
          event_type: payload.event_type,
          invoice_seq: nextSeq,
          invoice_label: payload.invoice_label || null,
          pct_termin: payload.pct_termin,
          nilai_progress: payload.nilai_progress,
          nilai_progress_submitted: Boolean(payload.nilai_progress),
          nilai_progress_submitted_by: payload.nilai_progress ? profile?.email : null,
          nilai_progress_submitted_at: payload.nilai_progress ? new Date().toISOString() : null,
          nilai_progress_approved: false,
        });

      if (insertError) throw insertError;
      await fetchData();
      return { success: true };
    } catch (err) {
      setError(err.message);
      console.error("Create invoice error:", err);
      return { success: false, error: err.message };
    }
  }, [fetchData, profile]);

  /**
   * Delete invoice row (soft or hard — tergantung schema)
   */
  const deleteInvoice = useCallback(async (id) => {
    try {
      const { error: deleteError } = await supabase
        .from("monthly_status")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      await fetchData();
      return { success: true };
    } catch (err) {
      setError(err.message);
      console.error("Delete invoice error:", err);
      return { success: false, error: err.message };
    }
  }, [fetchData]);

  /**
   * Call RPC: generate_period — buat monthly invoice buat bulan tertentu
   */
  const generatePeriod = useCallback(async (targetPeriode) => {
    try {
      const [year, month] = targetPeriode.split("-");
      const dateStr = `${year}-${month}-01`;

      const { data: result, error: rpcError } = await supabase.rpc(
        "generate_period",
        {
          p_periode: dateStr,
          p_carry_targets: true,
        }
      );

      if (rpcError) throw rpcError;
      await fetchData();
      return { success: true, inserted: result };
    } catch (err) {
      setError(err.message);
      console.error("Generate period error:", err);
      return { success: false, error: err.message };
    }
  }, [fetchData]);

  /**
   * Submit nilai_progress — editor submit nilai untuk approval admin
   * Setelah submit, field lock sampai admin approve/reject
   * @param {number} id - row id
   * @param {number} nilai - nilai progress baru
   * @param {number} currentVersion - current version untuk optimistic lock
   */
  const submitNilaiProgress = useCallback(async (id, nilai, currentVersion, extraUpdates = {}) => {
    try {
      const actor = profile?.email || "unknown";
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("monthly_status")
        .update({
          ...extraUpdates,
          nilai_progress: nilai,
          nilai_progress_submitted: true,
          nilai_progress_submitted_by: actor,
          nilai_progress_submitted_at: now,
          nilai_progress_approved: false,
          nilai_progress_approved_by: null,
          nilai_progress_approved_at: null,
          version: currentVersion + 1,
        })
        .eq("id", id)
        .eq("version", currentVersion);

      if (updateError) throw updateError;
      await fetchData();
      return { success: true };
    } catch (err) {
      setError(err.message);
      console.error("Submit nilai_progress error:", err);
      return { success: false, error: err.message };
    }
  }, [fetchData, profile]);

  /**
   * Approve / reject nilai_progress — hanya admin
   * approved=true  → nilai final, tidak bisa diubah lagi
   * approved=false → reset submitted flag, editor bisa input ulang
   * @param {number} id - row id
   * @param {boolean} approved - true=approve, false=reject
   * @param {number} currentVersion - current version untuk optimistic lock
   */
  const approveNilaiProgress = useCallback(async (id, approved, currentVersion) => {
    try {
      const actor = profile?.email || "unknown";
      const now = new Date().toISOString();
      const updates = {
        nilai_progress_approved: approved,
        nilai_progress_approved_by: actor,
        nilai_progress_approved_at: approved ? now : null,
        version: currentVersion + 1,
      };
      // Jika reject, reset submitted flag agar editor bisa input ulang
      if (!approved) {
        updates.nilai_progress_submitted = false;
        updates.nilai_progress_submitted_by = null;
        updates.nilai_progress_submitted_at = null;
      }

      const { error: updateError } = await supabase
        .from("monthly_status")
        .update(updates)
        .eq("id", id)
        .eq("version", currentVersion);

      if (updateError) throw updateError;
      await fetchData();
      return { success: true };
    } catch (err) {
      setError(err.message);
      console.error("Approve nilai_progress error:", err);
      return { success: false, error: err.message };
    }
  }, [fetchData, profile]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    updateStatus,
    updateTargets,
    updateInvoiceFields,
    createInvoice,
    deleteInvoice,
    generatePeriod,
    submitNilaiProgress,
    approveNilaiProgress,
  };
}

/**
 * Hook: useProfiles — fetch daftar user (untuk tab Kelola User)
 */
export function useProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (queryError) throw queryError;
        setProfiles(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /**
   * Update user role
   */
  const updateRole = async (userId, newRole) => {
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (updateError) throw updateError;

      // Update local state
      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, role: newRole } : p))
      );
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  return { profiles, loading, error, updateRole };
}
