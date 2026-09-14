"use server";

import { DEMO_ACCOUNTS, type DemoRole } from "@/lib/demo-accounts";
import { isDemoModeServer } from "@/lib/demo-mode";

export async function assertDemoLogin(role: DemoRole) {
  if (!isDemoModeServer()) {
    throw new Error("DEMO_MODE is off");
  }
  const account = DEMO_ACCOUNTS.find((item) => item.role === role);
  if (!account) {
    throw new Error("unknown demo role");
  }
  return { email: account.email };
}
