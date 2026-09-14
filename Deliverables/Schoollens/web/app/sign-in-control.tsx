"use client";

import { useState } from "react";
import Link from "next/link";
import { RoleSwitcher } from "./demo/role-switcher";
import { isDemoModeClient } from "@/lib/demo-mode";
import { roleLabel, useSession } from "./session-context";

export function SignInControl() {
  const { status, role, logOut } = useSession();
  const [open, setOpen] = useState(false);

  if (status === "loading") {
    return <span className="account-slot">…</span>;
  }

  if (status === "in") {
    return (
      <div className="account-slot">
        <span className="account-role">{roleLabel(role)}</span>
        <button type="button" className="site-nav-button" onClick={() => void logOut()}>
          Log out
        </button>
      </div>
    );
  }

  if (!isDemoModeClient()) {
    return (
      <Link href="/login" className="site-nav-link site-nav-cta">
        Sign in
      </Link>
    );
  }

  return (
    <>
      <button type="button" className="site-nav-button site-nav-cta" onClick={() => setOpen(true)}>
        Sign in
      </button>
      <RoleSwitcher open={open} onClose={() => setOpen(false)} />
    </>
  );
}
