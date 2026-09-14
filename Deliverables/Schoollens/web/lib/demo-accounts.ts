export const DEMO_ACCOUNTS = [
  { role: "parent", email: "demo.parent@schoollens.demo", label: "Parent" },
  { role: "school_admin", email: "demo.school_admin@schoollens.demo", label: "School Admin" },
  { role: "moderator", email: "demo.moderator@schoollens.demo", label: "Moderator" },
  { role: "platform_operator", email: "demo.platform_operator@schoollens.demo", label: "Operator" },
] as const;

export type DemoRole = (typeof DEMO_ACCOUNTS)[number]["role"];

export const DEMO_PASSWORD = "demo-mode-only";
