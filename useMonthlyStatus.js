import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./useAuthContext";

/**
 * Hook: useMonthlyStatus
 * Fetch v_monthly_progress filtered by periode + departemen
 * @param {string} periode - MM-YYYY format
 * @returns {object} { data, loading, error, refetch, updateStatus, deleteInvoice, generatePeriod, setupTermins }
 */
export function useMonthlyStatus(periode) {
  const { profile } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!periode || !profile) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("v_monthly_progress")
        .select("*")
        .eq("periode", `${periode.slice(0, 2)}-01-${periode.slice(3)}`);

      // Filter by departemen (admin dapat semua, editor/viewer hanya dept mereka)
      if (profile.role !== "admin" && profile.departemen) {
        query = query.eq("departemen", profile.departemen);
      }

      const { data: result, error: queryError } = await query;

      if (queryError) throw queryError;
      setData(result || []);
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
    async (id, fieldKey, newValue, currentVersion) => {
      try {
        const { error: updateError } = await supabase
          .from("monthly_status")
          .update({
            [fieldKey]: newValue,
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
      const [mm, yyyy] = targetPeriode.split("-");
      const dateStr = `${yyyy}-${mm}-01`;

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
   * Call RPC: setup_termins — pre-load jadwal termin dari kontrak
   * @param {string} noProject - nomor proyek
   * @param {array} termins - [{ no_termin, periode, nilai_invoice, pct_termin }]
   */
  const setupTermins = useCallback(async (noProject, termins) => {
    try {
      // Ubah periode dari MM-YYYY ke YYYY-MM-01
      const formattedTermins = termins.map((t) => {
        const [mm, yyyy] = t.periode.split("-");
        return {
          ...t,
          periode: `${yyyy}-${mm}-01`,
        };
      });

      const { data: result, error: rpcError } = await supabase.rpc(
        "setup_termins",
        {
          p_no_project: noProject,
          p_termins: formattedTermins,
        }
      );

      if (rpcError) throw rpcError;
      await fetchData();
      return { success: true, inserted: result };
    } catch (err) {
      setError(err.message);
      console.error("Setup termins error:", err);
      return { success: false, error: err.message };
    }
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    updateStatus,
    updateTargets,
    deleteInvoice,
    generatePeriod,
    setupTermins,
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
