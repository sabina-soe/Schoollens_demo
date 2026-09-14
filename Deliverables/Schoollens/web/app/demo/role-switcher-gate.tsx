import { isDemoModeServer } from "@/lib/demo-mode";

export function RoleSwitcherGate() {
  if (!isDemoModeServer()) {
    return null;
  }
  return null;
}
