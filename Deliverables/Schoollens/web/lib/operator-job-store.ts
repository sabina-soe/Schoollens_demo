import type { OperatorJob } from "@/lib/operator-jobs";

const KEY = "schoollens.operator-jobs";

export function readClientJobs(): OperatorJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OperatorJob[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveClientJob(job: OperatorJob) {
  if (typeof window === "undefined") return;
  const next = [job, ...readClientJobs().filter((row) => row.id !== job.id)].slice(0, 40);
  window.sessionStorage.setItem(KEY, JSON.stringify(next));
}
