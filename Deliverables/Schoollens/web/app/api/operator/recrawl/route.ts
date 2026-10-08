import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { upsertOperatorJob, type OperatorJob } from "@/lib/operator-jobs";
import { crawlSchoolWebsite } from "@/lib/website-crawl";

export const runtime = "nodejs";
export const maxDuration = 60;

function localSchool(schoolId: string) {
  const file = path.resolve(process.cwd(), "public", "demo-register", "schools.json");
  if (!existsSync(file)) return null;
  const payload = JSON.parse(readFileSync(file, "utf8")) as {
    schools?: { id: string; name: string; official_website_url?: string | null }[];
  };
  return payload.schools?.find((row) => row.id === schoolId) ?? null;
}

function ragBases() {
  if (process.env.RAG_SERVICE_URL) return [process.env.RAG_SERVICE_URL];
  if (process.env.VERCEL) return [];
  return ["http://127.0.0.1:8000", "http://127.0.0.1:8001"];
}

async function queueOnRag(schoolId: string, sourceType: string) {
  for (const base of ragBases()) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const response = await fetch(`${base.replace(/\/$/, "")}/rag/queue-recrawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_id: schoolId,
          source_type: sourceType,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const payload = await response.json().catch(() => ({}));
      if (response.status === 404) continue;
      if (!response.ok) {
        const detail = payload.detail ?? payload.error ?? "Queue failed.";
        return {
          ok: false as const,
          status: response.status,
          error: typeof detail === "string" ? detail : "Queue failed.",
        };
      }
      return { ok: true as const, payload };
    } catch {
      continue;
    }
  }
  return null;
}

function pythonScriptPath() {
  return path.resolve(process.cwd(), "..", "scrapers", "operator_local_crawl.py");
}

function startPythonCrawl(schoolId: string, schoolName: string) {
  const job: OperatorJob = {
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
  const child = spawn("python", [pythonScriptPath(), job.id, schoolId], {
    cwd: path.resolve(process.cwd(), ".."),
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return {
    ok: true,
    job,
    job_id: job.id,
    status: "queued",
    message: `Website crawl started locally for ${schoolName}. Watch Run history.`,
  };
}

async function runInlineWebsiteCrawl(schoolId: string, schoolName: string, website: string) {
  const started = new Date().toISOString();
  const result = await crawlSchoolWebsite(website, { maxPages: 6, maxMs: 8000 });
  const job: OperatorJob = {
    id: randomUUID(),
    school_id: schoolId,
    source_type: "website",
    status: result.withText > 0 ? "success" : "error",
    started_at: started,
    finished_at: new Date().toISOString(),
    rows_ingested: result.withText,
    errors: {
      school_id: schoolId,
      page_count: result.pages.length,
      crawled_pages: result.pages.map((page) => ({
        url: page.url,
        title: page.page_title,
        status: page.crawl_status,
        chars: page.extracted_text.length,
        snippet: page.extracted_text.slice(0, 220),
      })),
      reason:
        result.withText > 0
          ? `Crawled ${result.withText} page${result.withText === 1 ? "" : "s"} from ${new URL(website).hostname}`
          : "The website did not return extractable page text.",
    },
  };
  upsertOperatorJob(job);
  return {
    ok: result.withText > 0,
    job,
    job_id: job.id,
    status: job.status,
    pages: result.pages.map((page) => ({ url: page.url, title: page.page_title, status: page.crawl_status })),
    message:
      result.withText > 0
        ? `Crawled ${result.withText} pages from ${schoolName} (${new URL(website).hostname}).`
        : `Could not read page text from ${schoolName}.`,
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
      { error: "Facebook crawl is not available on this host. Use a local SchoolLens with RAG for Facebook." },
      { status: 502 },
    );
  }

  const school = localSchool(body.school_id);
  const website = String(body.website_url || school?.official_website_url || "").trim();
  if (!website) {
    return NextResponse.json(
      { error: "This school is not in the local register with a website URL." },
      { status: 400 },
    );
  }

  const onVercel = Boolean(process.env.VERCEL);
  if (!onVercel && existsSync(pythonScriptPath())) {
    return NextResponse.json(startPythonCrawl(body.school_id, school?.name || "this school"));
  }

  const payload = await runInlineWebsiteCrawl(body.school_id, school?.name || "this school", website);
  return NextResponse.json(payload, { status: payload.ok ? 200 : 502 });
}
