"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type DemoRole } from "@/lib/demo-accounts";
import { isDemoModeClient } from "@/lib/demo-mode";
import { writeLocalDemoSession, withDeadline } from "@/lib/demo-session";
import { createClient } from "@/lib/supabase/client";
import { assertDemoLogin } from "./actions";

export function RoleSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<DemoRole | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!isDemoModeClient() || !open) {
    return null;
  }

  function finish(role: DemoRole) {
    writeLocalDemoSession(role);
    window.location.assign(role === "platform_operator" ? "/operator" : "/");
  }

  async function loginAs(role: DemoRole) {
    setError(null);
    setPendingRole(role);
    try {
      const { email } = await assertDemoLogin(role);
      const supabase = createClient();
      const { data, error: signInError } = await withDeadline(
        supabase.auth.signInWithPassword({
          email,
          password: DEMO_PASSWORD,
        }),
        4000,
      );
      if (signInError || !data.session) {
        finish(role);
        return;
      }
      writeLocalDemoSession(role);
      window.location.assign(role === "platform_operator" ? "/operator" : "/");
    } catch {
      finish(role);
    }
  }

  return (
    <div className="demo-modal-backdrop" onClick={onClose} role="presentation">
      <aside
        className="demo-switcher demo-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-switcher-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p id="demo-switcher-title" className="demo-switcher-label">
          DEMO ONLY — click a role to sign in
        </p>
        <div className="demo-switcher-buttons">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.role}
              type="button"
              disabled={pendingRole !== null}
              onClick={() => void loginAs(account.role)}
            >
              {pendingRole === account.role ? "Signing in…" : account.label}
            </button>
          ))}
        </div>
        {error ? <p className="error">{error}</p> : null}
        <p>
          <Link href="/login" onClick={onClose}>
            Use email or phone OTP
          </Link>
        </p>
        <button type="button" className="secondary" onClick={onClose}>
          Close
        </button>
      </aside>
    </div>
  );
}
