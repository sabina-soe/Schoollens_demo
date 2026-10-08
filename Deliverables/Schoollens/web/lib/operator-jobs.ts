import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export type OperatorJob = {
  id: string;
  school_id: string;
  source_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  rows_ingested: number | null;
  errors: Record<string, unknown> | null;
};

export function operatorJobsPath() {
  return path.resolve(process.cwd(), "..", "raw-crawls", "operator-jobs.json");
}

export function readOperatorJobs(): OperatorJob[] {
  const file = operatorJobsPath();
  if (!existsSync(file)) return [];
  try {
    const payload = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

export function upsertOperatorJob(job: OperatorJob) {
  const file = operatorJobsPath();
  mkdirSync(path.dirname(file), { recursive: true });
  const next = readOperatorJobs().filter((row) => row.id !== job.id);
  next.unshift(job);
  writeFileSync(file, JSON.stringify(next.slice(0, 80), null, 2), "utf8");
}
