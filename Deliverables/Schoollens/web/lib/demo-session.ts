import { DEMO_ACCOUNTS, type DemoRole } from "@/lib/demo-accounts";
import { isDemoModeClient } from "@/lib/demo-mode";

const STORAGE_KEY = "schoollens.demo-session";

export type LocalDemoSession = {
  role: DemoRole;
  email: string;
};

function isDemoRole(value: string): value is DemoRole {
  return DEMO_ACCOUNTS.some((account) => account.role === value);
}

export function writeLocalDemoSession(role: DemoRole) {
  if (typeof window === "undefined") return;
  const account = DEMO_ACCOUNTS.find((item) => item.role === role);
  if (!account) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ role: account.role, email: account.email }));
}

export function readLocalDemoSession(): LocalDemoSession | null {
  if (typeof window === "undefined" || !isDemoModeClient()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { role?: string; email?: string };
    if (!parsed.role || !isDemoRole(parsed.role) || !parsed.email) return null;
    return { role: parsed.role, email: parsed.email };
  } catch {
    return null;
  }
}

export function clearLocalDemoSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export async function withDeadline<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("auth timeout")), ms);
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
