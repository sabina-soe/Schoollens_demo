"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearLocalDemoSession, readLocalDemoSession, withDeadline } from "@/lib/demo-session";
import { createClient } from "@/lib/supabase/client";

export type SessionStatus = "loading" | "out" | "in";

export type SessionValue = {
  status: SessionStatus;
  email: string | null;
  role: string | null;
  logOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue>({
  status: "loading",
  email: null,
  role: null,
  logOut: async () => {},
});

export function roleLabel(role: string | null) {
  if (role === "school_admin") return "School Admin";
  if (role === "moderator") return "Moderator";
  if (role === "platform_operator") return "Operator";
  if (role === "parent") return "Parent";
  return role;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const applyLocalDemo = useCallback(() => {
    const demo = readLocalDemoSession();
    if (!demo) {
      setEmail(null);
      setRole(null);
      setStatus("out");
      return false;
    }
    setEmail(demo.email);
    setRole(demo.role);
    setStatus("in");
    return true;
  }, []);

  const loadUser = useCallback(async () => {
    const supabase = createClient();
    try {
      const { data, error } = await withDeadline(supabase.auth.getSession(), 3000);
      if (!error && data.session?.user) {
        const user = data.session.user;
        setEmail(user.email ?? user.phone ?? user.id);
        try {
          const { data: profile } = await withDeadline(
            supabase.from("users").select("role").eq("id", user.id).maybeSingle(),
            3000,
          );
          setRole(profile?.role ?? readLocalDemoSession()?.role ?? "parent");
        } catch {
          setRole(readLocalDemoSession()?.role ?? "parent");
        }
        setStatus("in");
        return;
      }
    } catch {
      // Live auth is offline; fall through to the local demo session.
    }
    applyLocalDemo();
  }, [applyLocalDemo]);

  useEffect(() => {
    void loadUser();
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadUser();
    });
    return () => subscription.unsubscribe();
  }, [loadUser]);

  const logOut = useCallback(async () => {
    clearLocalDemoSession();
    const supabase = createClient();
    try {
      await withDeadline(supabase.auth.signOut(), 2500);
    } catch {
      // Local demo logout still works if Auth is offline.
    }
    window.location.assign("/");
  }, []);

  const value = useMemo(
    () => ({ status, email, role, logOut }),
    [status, email, role, logOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
