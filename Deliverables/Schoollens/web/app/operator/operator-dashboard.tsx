"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_SCHEDULES, type ScheduleRow } from "@/lib/operator-schedule";
import { CrawlTargets, jobSchoolId, type Job, type LastCrawl, type SchoolRow } from "./crawl-targets";

type Mention = {
  id: string;
  raw_source_id: string;
  school_id: string;
  confidence: string | null;
};

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
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setState("denied");
      return;
    }
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "platform_operator") {
      setState("denied");
      return;
    }

    const { data: schoolRows, error: schoolError } = await supabase
      .from("schools")
      .select("id, name, official_website_url, official_facebook_url, address, location, geocode_confidence")
      .order("name");
    const { data: sources } = await supabase
      .from("raw_sources")
      .select("school_id, crawled_at, crawl_status")
      .order("crawled_at", { ascending: false })
      .limit(4000);
    const { data: jobRows } = await supabase
      .from("sync_jobs")
      .select("id, source_type, started_at, finished_at, status, rows_ingested, errors")
      .order("started_at", { ascending: false })
      .limit(40);
    const { data: mentionRows } = await supabase
      .from("raw_source_school_mentions")
      .select("id, raw_source_id, school_id, confidence")
      .in("confidence", ["low", "unknown"]);
    const { data: scheduleRows } = await supabase.from("operator_schedules").select("pipeline, cron_expr, timezone");

    if (schoolError) {
      setError(schoolError.message);
    } else {
      setError(null);
    }
    const list = schoolRows ?? [];
    setSchools(list);
    setSchoolById(Object.fromEntries(list.map((row) => [row.id, row.name])));
    const latest: Record<string, LastCrawl> = {};
    for (const row of sources ?? []) {
      if (!row.school_id || latest[row.school_id]) continue;
      latest[row.school_id] = { crawled_at: row.crawled_at, crawl_status: row.crawl_status };
    }
    setLastBySchool(latest);
    setJobs(jobRows ?? []);
    setMentions(mentionRows ?? []);
    if (scheduleRows?.length) {
      setSchedules(scheduleRows);
    }
    setState("ready");
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
      body: JSON.stringify({ school_id: school.id, source_type: sourceType }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setNotice(
        sourceType === "website"
          ? `${payload.message || "Website recrawl queued."} The profile fills after extract finishes — watch Run history.`
          : payload.message || "Queued Facebook recrawl.",
      )
      setBusyKey(null);
      void load();
      return;
    }

    const supabase = createClient();
    const { error: insertError } = await supabase.from("sync_jobs").insert({
      source_type: sourceType,
      started_at: new Date().toISOString(),
      status: "queued",
      rows_ingested: 0,
      errors: { school_id: school.id, reason: "manual recrawl from operator dashboard" },
    });
    setBusyKey(null);
    if (!insertError) {
      setNotice(`Queued ${sourceType === "website" ? "website" : "Facebook"} recrawl for ${school.name}.`);
      void load();
      return;
    }
    setError(payload.error || insertError.message);
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
        <p className="operator-kicker">Platform</p>
        <h1>Operator</h1>
        <p>Loading…</p>
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main className="operator-page">
        <p className="operator-kicker">Platform</p>
        <h1>Operator</h1>
        <p>This dashboard is limited to platform operators.</p>
        <p>Click Sign in, choose Operator, then open this page again.</p>
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
      <header className="operator-hero">
        <p className="operator-kicker">
          <Link href="/">Home</Link>
        </p>
        <h1>Platform operator</h1>
        <p className="operator-lead">
          Crawl infrastructure only — URLs, schedules, run history, and mention review. Claim content stays on the
          moderator desk.
        </p>
      </header>

      {error ? <p className="error operator-error">{error}</p> : null}

      <div className="operator-stats">
        <div className="operator-stat">
          <p className="operator-stat-value">{stats.total}</p>
          <p className="operator-stat-label">Schools</p>
        </div>
        <div className="operator-stat">
          <p className="operator-stat-value">{stats.withWebsite}</p>
          <p className="operator-stat-label">With website</p>
        </div>
        <div className="operator-stat">
          <p className="operator-stat-value">{stats.neverCrawled}</p>
          <p className="operator-stat-label">Never crawled</p>
        </div>
        <div className="operator-stat">
          <p className="operator-stat-value">{stats.queued}</p>
          <p className="operator-stat-label">In queue</p>
        </div>
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

      <section className="operator-panel">
        <h2>Schedules</h2>
        <p className="operator-lead">Intended cron in Asia/Yangon. Live runs start in n8n, not from this page.</p>
        <div className="schedule-grid">
          {DEFAULT_SCHEDULES.map((meta) => {
            const row = schedules.find((item) => item.pipeline === meta.pipeline) ?? meta;
            return (
              <form
                key={meta.pipeline}
                className="schedule-card"
                onSubmit={(event) => void saveSchedule(event, meta.pipeline)}
              >
                <h3>
                  {meta.label}
                  <span className="schedule-cadence">{meta.cadence}</span>
                </h3>
                <label htmlFor={`cron-${meta.pipeline}`}>
                  Cron
                  <input id={`cron-${meta.pipeline}`} name="cron" defaultValue={row.cron_expr} />
                </label>
                <label htmlFor={`tz-${meta.pipeline}`}>
                  Timezone
                  <input id={`tz-${meta.pipeline}`} name="timezone" defaultValue={row.timezone} />
                </label>
                <button type="submit" className="op-btn">
                  Save schedule
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="operator-panel">
        <h2>Run history</h2>
        {jobs.length === 0 ? (
          <p className="operator-empty">No sync jobs yet. Queue a recrawl to see the first row.</p>
        ) : (
          <div className="operator-table-wrap">
            <table className="operator-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Rows</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const schoolId = jobSchoolId(job);
                  return (
                    <tr key={job.id}>
                      <td>{schoolId ? (schoolById[schoolId] ?? schoolId) : "—"}</td>
                      <td>{job.source_type === "fb_page" ? "Facebook" : job.source_type ?? "—"}</td>
                      <td>
                        <span className={`crawl-status crawl-status-${job.status === "success" ? "success" : job.status === "error" ? "blocked" : "queued"}`}>
                          {job.status ?? "—"}
                        </span>
                      </td>
                      <td>{job.rows_ingested ?? "—"}</td>
                      <td>{job.started_at?.replace("T", " ").slice(0, 16) ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="operator-panel">
        <h2>Group-mention review</h2>
        {mentions.length === 0 ? (
          <p className="operator-empty">No low-confidence group mentions.</p>
        ) : (
          <ul className="mention-list">
            {mentions.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{schoolById[row.school_id] ?? row.school_id}</strong>
                  <p className="directory-meta">{row.confidence}</p>
                </div>
                <div className="crawl-actions">
                  <button type="button" className="op-btn" onClick={() => void decideMention(row.id, "confirmed")}>
                    Confirm
                  </button>
                  <button type="button" className="op-btn danger" onClick={() => void decideMention(row.id, "rejected")}>
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="operator-panel">
        <h2>Geocode manual-fix queue</h2>
        <p className="operator-lead">
          Batch job: <code>python scrapers/geocode_schools.py</code>. Low or failed results land here.
        </p>
        {geocodeQueue.length === 0 ? (
          <p className="operator-empty">No addresses waiting for a pin.</p>
        ) : (
          <div className="geocode-list">
            {geocodeQueue.map((school) => (
              <form key={school.id} className="schedule-card" onSubmit={(event) => void savePin(event, school.id)}>
                <h3>
                  <Link href={`/schools/${school.id}`}>{school.name}</Link>
                </h3>
                <p className="directory-meta">{school.address}</p>
                <p className="directory-meta">Current confidence: {school.geocode_confidence || "none"}</p>
                <label htmlFor={`lat-${school.id}`}>
                  Latitude
                  <input id={`lat-${school.id}`} name="lat" required />
                </label>
                <label htmlFor={`lng-${school.id}`}>
                  Longitude
                  <input id={`lng-${school.id}`} name="lng" required />
                </label>
                <button type="submit" className="op-btn">
                  Save pin
                </button>
              </form>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
