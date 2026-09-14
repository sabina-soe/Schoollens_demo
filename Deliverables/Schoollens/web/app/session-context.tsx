"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

  const loadUser = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      setEmail(null);
      setRole(null);
      setStatus("out");
      return;
    }
    const user = data.session.user;
    setEmail(user.email ?? user.phone ?? user.id);
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
    setRole(profile?.role ?? "parent");
    setStatus("in");
  }, []);

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
    const supabase = createClient();
    await supabase.auth.signOut();
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
