import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./useAuthContext";

const HEARTBEAT_MS = 30_000;
const INACTIVE_TIMEOUT_MS = 30 * 60 * 1000;

const SESSION_KEY = "invoice_progress_monitor_session_token";

const makeToken = () => {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const formatTimeOnline = (startedAt) => {
  if (!startedAt) return "-";
  const diff = Date.now() - new Date(startedAt).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs > 0) return `${hrs}h ${rem}m`;
  return `${rem}m`;
};

export function useUserSessions(currentPage) {
  const { user, profile, isAuthenticated } = useAuth();
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem(SESSION_KEY) || "");
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const lastPageRef = useRef(currentPage);

  const sessionRow = useMemo(() => activeSessions.find((row) => row.session_token === sessionToken) || null, [activeSessions, sessionToken]);

  const syncSession = async (pageName) => {
    if (!isAuthenticated || !user || !profile) return null;
    let token = sessionStorage.getItem(SESSION_KEY);
    if (!token) {
      token = makeToken();
      sessionStorage.setItem(SESSION_KEY, token);
    }

    const existing = sessionRow;
    const loggedInAt = existing?.logged_in_at || new Date().toISOString();

    const payload = {
      user_id: user.id,
      email: profile.email || user.email,
      role: profile.role,
      departemen: profile.departemen || null,
      current_page: pageName || currentPage || null,
      session_token: token,
      last_activity: new Date().toISOString(),
      logged_in_at: loggedInAt,
    };

    const { error } = await supabase.from("user_sessions").upsert(payload, { onConflict: "session_token" });
    if (!error) {
      setSessionToken(token);
      return token;
    }
    return null;
  };

  const updateSession = async (pageName) => {
    if (!sessionToken) return;
    await supabase
      .from("user_sessions")
      .update({ current_page: pageName || currentPage || null, last_activity: new Date().toISOString() })
      .eq("session_token", sessionToken);
  };

  const touch = async () => {
    if (!sessionToken) return;
    await supabase.from("user_sessions").update({ last_activity: new Date().toISOString() }).eq("session_token", sessionToken);
  };

  const deleteSession = async () => {
    if (!sessionToken) return;
    await supabase.from("user_sessions").delete().eq("session_token", sessionToken);
    sessionStorage.removeItem(SESSION_KEY);
    setSessionToken("");
  };

  const fetchActiveSessions = async () => {
    setLoading(true);
    try {
      const threshold = new Date(Date.now() - INACTIVE_TIMEOUT_MS).toISOString();
      const { data, error } = await supabase
        .from("user_sessions")
        .select("*")
        .gte("last_activity", threshold)
        .order("last_activity", { ascending: false });
      if (error) throw error;
      setActiveSessions(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    syncSession(currentPage);
  }, [isAuthenticated, currentPage]);

  useEffect(() => {
    if (!isAuthenticated && sessionToken) {
      setSessionToken("");
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, [isAuthenticated, sessionToken]);

  useEffect(() => {
    if (!sessionToken) return;
    if (lastPageRef.current !== currentPage) {
      lastPageRef.current = currentPage;
      updateSession(currentPage);
    }
  }, [currentPage, sessionToken]);

  useEffect(() => {
    if (!sessionToken) return undefined;
    const onActivity = () => touch();
    const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    const interval = setInterval(touch, HEARTBEAT_MS);
    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity));
      clearInterval(interval);
    };
  }, [sessionToken]);

  useEffect(() => {
    fetchActiveSessions();
    const channel = supabase
      .channel("user-sessions-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_sessions" }, () => fetchActiveSessions())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    sessionToken,
    sessionRow,
    activeSessions,
    loading,
    syncSession,
    updateSession,
    touch,
    deleteSession,
    fetchActiveSessions,
    formatTimeOnline,
  };
}
