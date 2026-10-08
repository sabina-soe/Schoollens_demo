"use client";

import Link from "next/link";
import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { readLocalDemoSession, withDeadline } from "@/lib/demo-session";
import { loadLocalSchools } from "@/lib/public-register";
import { DEFAULT_SCHEDULES, type ScheduleRow } from "@/lib/operator-schedule";
import { readClientJobs, saveClientJob } from "@/lib/operator-job-store";
import type { OperatorJob } from "@/lib/operator-jobs";
import { CrawlTargets, jobCrawledPages, jobSchoolId, type Job, type LastCrawl, type SchoolRow } from "./crawl-targets";

type Mention = {
  id: string;
  raw_source_id: string;
  school_id: string;
  confidence: string | null;
};

async function loadLocalJobs(): Promise<Job[]> {
  const stored = readClientJobs() as Job[];
  try {
    const response = await fetch("/api/operator/jobs", { cache: "no-store" });
    if (!response.ok) return stored;
    const payload = (await response.json()) as { jobs?: Job[] };
    return mergeJobs(payload.jobs ?? [], stored);
  } catch {
    return stored;
  }
}

function mergeJobs(live: Job[], local: Job[]) {
  const seen = new Set(live.map((job) => job.id));
  return [...local.filter((job) => !seen.has(job.id)), ...live];
}

function applyLocalCrawlStatus(latest: Record<string, LastCrawl>, jobs: Job[]) {
  for (const job of jobs) {
    const schoolId = jobSchoolId(job);
    if (!schoolId || job.source_type !== "website") continue;
    if (job.status === "success") {
      latest[schoolId] = {
        crawled_at: job.finished_at || job.started_at,
        crawl_status: "success",
      };
    }
  }
}

export function OperatorDashboard() {
  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [lastBySchool, setLastBySchool] = useState<Record<string, LastCrawl>>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [schoolById, setSchoolById] = useState<Record<string, string>>({});
  const [schedules, setSchedules] = useState<ScheduleRow[]>(
    DEFAULT_SCHEDULES.map((row) => ({
      pipeline: row.pipeline,
      cron_expr: row.cron_expr,
      timezone: row.timezone,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    let user = null as { id: string } | null;
    try {
      const { data: sessionData } = await withDeadline(supabase.auth.getSession(), 3000);
      user = sessionData.session?.user ?? null;
    } catch {
      user = null;
    }
    const localOperator = readLocalDemoSession()?.role === "platform_operator";
    if (!user && !localOperator) {
      setState("denied");
      return;
    }
    if (user) {
      try {
        const { data: profile } = await withDeadline(
          supabase.from("users").select("role").eq("id", user.id).maybeSingle(),
          3000,
        );
        if (profile?.role !== "platform_operator" && !localOperator) {
          setState("denied");
          return;
        }
      } catch {
        if (!localOperator) {
          setState("denied");
          return;
        }
      }
    }

    try {
      const [schoolRes, sources, jobRows, mentionRows, scheduleRows] = await withDeadline(
        Promise.all([
          supabase
            .from("schools")
            .select("id, name, official_website_url, official_facebook_url, address, location, geocode_confidence")
            .order("name"),
          supabase
            .from("raw_sources")
            .select("school_id, crawled_at, crawl_status")
            .order("crawled_at", { ascending: false })
            .limit(4000),
          supabase
            .from("sync_jobs")
            .select("id, source_type, started_at, finished_at, status, rows_ingested, errors")
            .order("started_at", { ascending: false })
            .limit(40),
          supabase
            .from("raw_source_school_mentions")
            .select("id, raw_source_id, school_id, confidence")
            .in("confidence", ["low", "unknown"]),
          supabase.from("operator_schedules").select("pipeline, cron_expr, timezone"),
        ]),
        5000,
      );

      if (schoolRes.error) {
        setError(schoolRes.error.message);
      } else {
        setError(null);
      }
      let list = schoolRes.data ?? [];
      if (!list.length) {
        list = await loadLocalSchools();
        if (list.length) {
          setNotice("Live school table was empty. Showing the local register.");
        }
      }
      setSchools(list);
      setSchoolById(Object.fromEntries(list.map((row) => [row.id, row.name])));
      const latest: Record<string, LastCrawl> = {};
      for (const row of sources.data ?? []) {
        if (!row.school_id || latest[row.school_id]) continue;
        latest[row.school_id] = { crawled_at: row.crawled_at, crawl_status: row.crawl_status };
      }
      const localJobs = await loadLocalJobs();
      const mergedJobs = mergeJobs(jobRows.data ?? [], localJobs);
      applyLocalCrawlStatus(latest, localJobs);
      setLastBySchool(latest);
      setJobs(mergedJobs);
      setMentions(mentionRows.data ?? []);
      if (scheduleRows.data?.length) {
        setSchedules(scheduleRows.data);
      }
      setState("ready");
    } catch {
      const list = await loadLocalSchools();
      const localJobs = await loadLocalJobs();
      const latest: Record<string, LastCrawl> = {};
      applyLocalCrawlStatus(latest, localJobs);
      setSchools(list);
      setSchoolById(Object.fromEntries(list.map((row) => [row.id, row.name])));
      setLastBySchool(latest);
      setJobs(localJobs);
      setMentions([]);
      if (!localJobs.length) {
        setNotice("Signed in locally. Website crawls now run on this machine.");
      }
      setError(null);
      setState("ready");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const pending = jobs.some((job) => job.status === "queued" || job.status === "running");
    if (!pending) return;
    const timer = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(timer);
  }, [jobs, load]);

  async function saveUrls(event: FormEvent<HTMLFormElement>, school: SchoolRow) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("schools")
      .update({
        official_website_url: String(form.get("website") || "").trim() || null,
        official_facebook_url: String(form.get("facebook") || "").trim() || null,
      })
      .eq("id", school.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotice(`Saved URLs for ${school.name}.`);
    void load();
  }

  async function savePin(event: FormEvent<HTMLFormElement>, schoolId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lat = Number(form.get("lat"));
    const lng = Number(form.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError("Latitude and longitude are required.");
      return;
    }
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("schools")
      .update({ location: `(${lng},${lat})`, geocode_confidence: "manual" })
      .eq("id", schoolId);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotice("Saved map pin.");
    void load();
  }

  async function queueRecrawl(school: SchoolRow, sourceType: "website" | "fb_page") {
    const key = `${school.id}:${sourceType}`;
    setBusyKey(key);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/operator/recrawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        school_id: school.id,
        source_type: sourceType,
        website_url: school.official_website_url,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      job?: OperatorJob;
    };
    setBusyKey(null);
    if (payload.job) {
      saveClientJob(payload.job);
      setJobs((current) => mergeJobs([payload.job as Job], current));
      setLastBySchool((current) => {
        const next = { ...current };
        applyLocalCrawlStatus(next, [payload.job as Job]);
        return next;
      });
    }
    if (!response.ok) {
      setError(payload.error || payload.message || "The crawl did not start.");
      return;
    }
    setNotice(
      sourceType === "website"
        ? payload.message || "Website crawl finished. Check Run history."
        : payload.message || "Queued Facebook recrawl.",
    );
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>, pipeline: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const cron_expr = String(form.get("cron") || "").trim();
    const timezone = String(form.get("timezone") || "Asia/Yangon").trim();
    const supabase = createClient();
    const { error: upsertError } = await supabase.from("operator_schedules").upsert({
      pipeline,
      cron_expr,
      timezone,
      updated_at: new Date().toISOString(),
    });
    if (upsertError) {
      setError(`${upsertError.message} — n8n still owns live cron. Apply the operator_schedules SQL to persist edits.`);
      return;
    }
    setNotice("Saved schedule.");
    void load();
  }

  async function decideMention(id: string, confidence: "confirmed" | "rejected") {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("raw_source_school_mentions")
      .update({ confidence })
      .eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    void load();
  }

  const stats = useMemo(() => {
    const withWebsite = schools.filter((school) => school.official_website_url).length;
    const neverCrawled = schools.filter((school) => !lastBySchool[school.id]?.crawled_at).length;
    const queued = jobs.filter((job) => job.status === "queued" || job.status === "running").length;
    return { total: schools.length, withWebsite, neverCrawled, queued };
  }, [jobs, lastBySchool, schools]);

  if (state === "loading") {
    return (
      <main className="operator-page">
        <section className="op-band">
          <div className="op-band-inner">
            <p className="op-kicker">Collection desk</p>
            <h1>Operator</h1>
            <p className="op-lead">Loading the crawl console…</p>
          </div>
        </section>
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main className="operator-page">
        <section className="op-band">
          <div className="op-band-inner">
            <p className="op-kicker">Collection desk</p>
            <h1>Operator access only</h1>
            <p className="op-lead">Sign in as Operator, then open this page again.</p>
          </div>
        </section>
      </main>
    );
  }

  const geocodeQueue = schools.filter(
    (school) =>
      school.address &&
      (!school.location || ["low", "failed", null, ""].includes(school.geocode_confidence)),
  );

  return (
    <main className="operator-page">
      <section className="op-band">
        <div className="op-band-inner">
          <p className="op-kicker">
            <Link href="/">Directory</Link>
            <span aria-hidden="true"> / </span>
            Collection desk
          </p>
          <div className="op-hero">
            <div>
              <h1>Collect school evidence</h1>
              <p className="op-lead">
                Queue official websites. SchoolLens crawls public pages, then extract writes fees, curriculum, and
                facilities onto the school profile.
              </p>
            </div>
            <a href="#collect" className="btn op-hero-btn">
              Start a website crawl
            </a>
          </div>
          <ol className="op-steps">
            <li>
              <span>1</span>
              Choose a school with a website
            </li>
            <li>
              <span>2</span>
              Queue the crawl
            </li>
            <li>
              <span>3</span>
              Open the profile after extract
            </li>
          </ol>
        </div>
      </section>

      <div className="op-shell">
        {error ? <p className="op-error">{error}</p> : null}

        <div className="op-stats">
          <article className="op-stat">
            <p className="op-stat-value">{stats.total}</p>
            <p className="op-stat-label">Schools on file</p>
          </article>
          <article className="op-stat">
            <p className="op-stat-value">{stats.withWebsite}</p>
            <p className="op-stat-label">Official websites</p>
          </article>
          <article className="op-stat">
            <p className="op-stat-value">{stats.neverCrawled}</p>
            <p className="op-stat-label">Not crawled yet</p>
          </article>
          <article className="op-stat">
            <p className="op-stat-value">{stats.queued}</p>
            <p className="op-stat-label">In the queue</p>
          </article>
        </div>

        <CrawlTargets
          schools={schools}
          lastBySchool={lastBySchool}
          jobs={jobs}
          busyKey={busyKey}
          notice={notice}
          onSaveUrls={saveUrls}
          onQueue={queueRecrawl}
        />

        <div className="op-grid">
          <section className="op-card" id="history">
            <div className="op-card-head">
              <div>
                <p className="op-kicker">Activity</p>
                <h2>Run history</h2>
                <p className="op-lead">
                  This list is the proof a crawl ran. Page titles and snippets appear here. The public school profile
                  does not change until extract writes claims.
                </p>
              </div>
            </div>
            {jobs.length === 0 ? (
              <p className="op-empty">No runs yet. Queue a website crawl to see the first row.</p>
            ) : (
              <div className="op-table-wrap">
                <table className="op-table">
                  <thead>
                    <tr>
                      <th>School</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Pages</th>
                      <th>Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => {
                      const schoolId = jobSchoolId(job);
                      const tone =
                        job.status === "success" ? "success" : job.status === "error" ? "blocked" : "queued";
                      const pages = jobCrawledPages(job);
                      return (
                        <Fragment key={job.id}>
                          <tr>
                            <td>{schoolId ? (schoolById[schoolId] ?? schoolId) : "—"}</td>
                            <td>{job.source_type === "fb_page" ? "Facebook" : job.source_type ?? "—"}</td>
                            <td>
                              <span className={`op-status op-status-${tone}`}>{job.status ?? "—"}</span>
                            </td>
                            <td>{job.rows_ingested ?? "—"}</td>
                            <td>{job.started_at?.replace("T", " ").slice(0, 16) ?? "—"}</td>
                          </tr>
                          {pages.length ? (
                            <tr className="op-crawl-pages-row">
                              <td colSpan={5}>
                                <ul className="op-crawl-pages">
                                  {pages.map((page) => (
                                    <li key={page.url}>
                                      <a href={page.url} target="_blank" rel="noreferrer">
                                        {page.title || page.url}
                                      </a>
                                      <span>
                                        {page.status ?? "fetched"}
                                        {typeof page.chars === "number" ? ` · ${page.chars} chars` : ""}
                                      </span>
                                      {page.snippet ? <p>{page.snippet}</p> : null}
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="op-card" id="schedules">
            <div className="op-card-head">
              <div>
                <p className="op-kicker">Automation</p>
                <h2>Schedules</h2>
                <p className="op-lead">Intended cron in Asia/Yangon. Live runs start in n8n.</p>
              </div>
            </div>
            <div className="op-schedule-list">
              {DEFAULT_SCHEDULES.map((meta) => {
                const row = schedules.find((item) => item.pipeline === meta.pipeline) ?? meta;
                return (
                  <form
                    key={meta.pipeline}
                    className="op-schedule"
                    onSubmit={(event) => void saveSchedule(event, meta.pipeline)}
                  >
                    <div className="op-schedule-top">
                      <h3>{meta.label}</h3>
                      <span className="op-cadence">{meta.cadence}</span>
                    </div>
                    <label htmlFor={`cron-${meta.pipeline}`}>
                      Cron
                      <input id={`cron-${meta.pipeline}`} name="cron" defaultValue={row.cron_expr} />
                    </label>
                    <label htmlFor={`tz-${meta.pipeline}`}>
                      Timezone
                      <input id={`tz-${meta.pipeline}`} name="timezone" defaultValue={row.timezone} />
                    </label>
                    <button type="submit" className="btn btn-secondary">
                      Save schedule
                    </button>
                  </form>
                );
              })}
            </div>
          </section>
        </div>

        <div className="op-grid">
          <section className="op-card" id="review">
            <div className="op-card-head">
              <div>
                <p className="op-kicker">Review</p>
                <h2>Group mentions</h2>
                <p className="op-lead">Low-confidence Facebook group matches. Confirm or reject the school link.</p>
              </div>
            </div>
            {mentions.length === 0 ? (
              <p className="op-empty">No low-confidence group mentions.</p>
            ) : (
              <ul className="op-mention-list">
                {mentions.map((row) => (
                  <li key={row.id}>
                    <div>
                      <strong>{schoolById[row.school_id] ?? row.school_id}</strong>
                      <p>{row.confidence}</p>
                    </div>
                    <div className="op-mention-actions">
                      <button type="button" className="btn btn-secondary" onClick={() => void decideMention(row.id, "confirmed")}>
                        Confirm
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => void decideMention(row.id, "rejected")}>
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="op-card">
            <div className="op-card-head">
              <div>
                <p className="op-kicker">Maps</p>
                <h2>Geocode queue</h2>
                <p className="op-lead">Low or failed pins. Batch job: python scrapers/geocode_schools.py</p>
              </div>
            </div>
            {geocodeQueue.length === 0 ? (
              <p className="op-empty">No addresses waiting for a pin.</p>
            ) : (
              <div className="op-geo-list">
                {geocodeQueue.map((school) => (
                  <form key={school.id} className="op-schedule" onSubmit={(event) => void savePin(event, school.id)}>
                    <h3>
                      <Link href={`/schools/${school.id}`}>{school.name}</Link>
                    </h3>
                    <p className="op-lead">{school.address}</p>
                    <p className="op-lead">Confidence: {school.geocode_confidence || "none"}</p>
                    <label htmlFor={`lat-${school.id}`}>
                      Latitude
                      <input id={`lat-${school.id}`} name="lat" required />
                    </label>
                    <label htmlFor={`lng-${school.id}`}>
                      Longitude
                      <input id={`lng-${school.id}`} name="lng" required />
                    </label>
                    <button type="submit" className="btn btn-secondary">
                      Save pin
                    </button>
                  </form>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
