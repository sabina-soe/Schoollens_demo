import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { upsertOperatorJob } from "@/lib/operator-jobs";

function localSchool(schoolId: string) {
  const file = path.resolve(process.cwd(), "public", "demo-register", "schools.json");
  if (!existsSync(file)) return null;
  const payload = JSON.parse(readFileSync(file, "utf8")) as {
    schools?: { id: string; name: string; official_website_url?: string | null }[];
  };
  return payload.schools?.find((row) => row.id === schoolId) ?? null;
}

async function queueOnRag(schoolId: string, sourceType: string) {
  const bases = [
    ...new Set(
      [process.env.RAG_SERVICE_URL, "http://127.0.0.1:8000", "http://127.0.0.1:8001"].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ];
  for (const base of bases) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const response = await fetch(`${base.replace(/\/$/, "")}/rag/queue-recrawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school_id: schoolId, source_type: sourceType }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const payload = await response.json().catch(() => ({}));
      if (response.status === 404) continue;
      if (!response.ok) {
        const detail = payload.detail ?? payload.error ?? "Queue failed.";
        return { ok: false as const, status: response.status, error: typeof detail === "string" ? detail : "Queue failed." };
      }
      return { ok: true as const, payload };
    } catch {
      continue;
    }
  }
  return null;
}

function startLocalWebsiteCrawl(schoolId: string, schoolName: string) {
  const job = {
    id: randomUUID(),
    school_id: schoolId,
    source_type: "website",
    status: "queued",
    started_at: new Date().toISOString(),
    finished_at: null,
    rows_ingested: 0,
    errors: { school_id: schoolId, reason: "local website crawl from operator desk" },
  };
  upsertOperatorJob(job);
  const script = path.resolve(process.cwd(), "..", "scrapers", "operator_local_crawl.py");
  const child = spawn("python", [script, job.id, schoolId], {
    cwd: path.resolve(process.cwd(), ".."),
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return {
    ok: true,
    job_id: job.id,
    status: "queued",
    message: `Website crawl started locally for ${schoolName}. Watch Run history.`,
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body.school_id || !body.source_type) {
    return NextResponse.json({ error: "school_id and source_type are required" }, { status: 400 });
  }

  const rag = await queueOnRag(body.school_id, body.source_type);
  if (rag?.ok) return NextResponse.json(rag.payload);
  if (rag && !rag.ok && rag.status !== 502) {
    return NextResponse.json({ error: rag.error }, { status: rag.status });
  }

  if (body.source_type !== "website") {
    return NextResponse.json(
      { error: "The crawl service is offline. Facebook queue needs the RAG service." },
      { status: 502 },
    );
  }

  const school = localSchool(body.school_id);
  if (!school?.official_website_url) {
    return NextResponse.json(
      { error: "This school is not in the local register with a website URL." },
      { status: 400 },
    );
  }

  return NextResponse.json(startLocalWebsiteCrawl(school.id, school.name));
}
