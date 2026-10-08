import { execFileSync, spawn } from "child_process";
import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { upsertOperatorJob, type OperatorJob } from "@/lib/operator-jobs";
import { extractWebsiteClaims } from "@/lib/gemini-extract";
import { crawlSchoolWebsite } from "@/lib/website-crawl";
import { saveSchoolLogo } from "@/lib/save-school-logo";
import { writeClaimOverlay } from "@/lib/write-claim-overlay";

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
  return [];
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

function resolvePython() {
  const names = process.platform === "win32" ? ["python", "py"] : ["python3", "python"];
  for (const name of names) {
    try {
      execFileSync(name, ["-c", "import sys"], { stdio: "ignore", timeout: 2500, windowsHide: true });
      return name;
    } catch {
      continue;
    }
  }
  return null;
}

function startPythonCrawl(pythonBin: string, schoolId: string, schoolName: string) {
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
  const child = spawn(pythonBin, [pythonScriptPath(), job.id, schoolId], {
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
  const result = await crawlSchoolWebsite(website, { maxPages: 6, maxMs: 15000 });
  const host = new URL(website).hostname;
  let extractError: string | undefined;
  let claimCount = 0;
  if (result.withText > 0) {
    const extracted = await extractWebsiteClaims(result.pages);
    extractError = extracted.error;
    claimCount = writeClaimOverlay(schoolId, extracted.claims);
    if (claimCount > 0 && result.homeHtml) {
      await saveSchoolLogo(schoolId, result.homeHtml, result.homeUrl);
    }
  }
  const ok = result.withText > 0 && (claimCount > 0 || !extractError);
  const reason = !result.withText
    ? "The website did not return extractable page text."
    : claimCount
      ? `Crawled ${result.withText} pages from ${host} and extracted ${claimCount} claims.`
      : extractError || `Crawled ${result.withText} pages from ${host}. Extract did not write claims.`;
  const job: OperatorJob = {
    id: randomUUID(),
    school_id: schoolId,
    source_type: "website",
    status: ok ? "success" : "error",
    started_at: started,
    finished_at: new Date().toISOString(),
    rows_ingested: claimCount || result.withText,
    errors: {
      school_id: schoolId,
      page_count: result.pages.length,
      claims: claimCount,
      crawled_pages: result.pages.map((page) => ({
        url: page.url,
        title: page.page_title,
        status: page.crawl_status,
        chars: page.extracted_text.length,
        snippet: page.extracted_text.slice(0, 220),
      })),
      reason,
    },
  };
  upsertOperatorJob(job);
  return {
    ok,
    job,
    job_id: job.id,
    status: job.status,
    claims: claimCount,
    pages: result.pages.map((page) => ({ url: page.url, title: page.page_title, status: page.crawl_status })),
    message: reason,
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

  const pythonBin =
    !process.env.VERCEL && process.env.USE_PYTHON_CRAWL && existsSync(pythonScriptPath())
      ? resolvePython()
      : null;
  if (pythonBin) {
    return NextResponse.json(startPythonCrawl(pythonBin, body.school_id, school?.name || "this school"));
  }

  const payload = await runInlineWebsiteCrawl(body.school_id, school?.name || "this school", website);
  return NextResponse.json(payload, { status: payload.ok ? 200 : 502 });
}
