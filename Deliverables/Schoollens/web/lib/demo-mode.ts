export function isDemoModeServer() {
  return process.env.DEMO_MODE === "true";
}

export function isDemoModeClient() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
