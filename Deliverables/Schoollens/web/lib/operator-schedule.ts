export const DEFAULT_SCHEDULES = [
  {
    pipeline: "website",
    label: "Official websites",
    cron_expr: "0 9 1 * *",
    timezone: "Asia/Yangon",
    cadence: "Monthly",
  },
  {
    pipeline: "fb_page",
    label: "Official Facebook pages",
    cron_expr: "0 9 * * 1",
    timezone: "Asia/Yangon",
    cadence: "Weekly",
  },
  {
    pipeline: "fb_group",
    label: "Facebook groups",
    cron_expr: "0 10 * * 1",
    timezone: "Asia/Yangon",
    cadence: "Weekly",
  },
] as const;

export type ScheduleRow = {
  pipeline: string;
  cron_expr: string;
  timezone: string;
};
