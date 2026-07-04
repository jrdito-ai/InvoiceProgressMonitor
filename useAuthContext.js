import { useEffect, useState, useCallback, useContext, createContext } from "react";
import { supabase, getCurrentAuth, onAuthStateChange } from "../lib/supabaseClient";

/**
 * AuthContext — session + user + profile
 */
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth on mount
  useEffect(() => {
    (async () => {
      try {
        const auth = await getCurrentAuth();
        setSession(auth.session);
        setUser(auth.user);
        setProfile(auth.profile);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();

    // Listen to auth changes
    const unsubscribe = onAuthStateChange(async (sess) => {
      if (sess) {
        const auth = await getCurrentAuth();
        setSession(auth.session);
        setUser(auth.user);
        setProfile(auth.profile);
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
      }
    });

    return () => unsubscribe?.();
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      // Fetch profile
      const { data: prof, error: profError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (profError) throw profError;

      setSession(data.session);
      setUser(data.user);
      setProfile(prof);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        error,
        login,
        logout,
        isAuthenticated: !!session,
        isAdmin: profile?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook: useAuth — access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
