"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

export type SchoolRow = {
  id: string;
  name: string;
  official_website_url: string | null;
  official_facebook_url: string | null;
  address: string | null;
  location: unknown;
  geocode_confidence: string | null;
};

export type LastCrawl = { crawled_at: string | null; crawl_status: string | null };

export type Job = {
  id: string;
  source_type: string | null;
  started_at: string | null;
  finished_at: string | null;
  status: string | null;
  rows_ingested: number | null;
  errors: unknown;
};

type Filter = "all" | "website" | "facebook" | "never" | "queued" | "blocked";

const PAGE_SIZE = 20;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "website", label: "Has website" },
  { id: "facebook", label: "Has Facebook" },
  { id: "never", label: "Never crawled" },
  { id: "queued", label: "In queue" },
  { id: "blocked", label: "Blocked" },
];

export function jobSchoolId(job: Job): string | null {
  const errors = job.errors;
  if (errors && typeof errors === "object" && !Array.isArray(errors) && "school_id" in errors) {
    const value = (errors as { school_id?: unknown }).school_id;
    return value ? String(value) : null;
  }
  return null;
}

function hostLabel(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] || url;
  }
}

function isActiveJob(job: Job) {
  return job.status === "queued" || job.status === "running";
}

export function CrawlTargets({
  schools,
  lastBySchool,
  jobs,
  busyKey,
  notice,
  onSaveUrls,
  onQueue,
}: {
  schools: SchoolRow[];
  lastBySchool: Record<string, LastCrawl>;
  jobs: Job[];
  busyKey: string | null;
  notice: string | null;
  onSaveUrls: (event: FormEvent<HTMLFormElement>, school: SchoolRow) => void;
  onQueue: (school: SchoolRow, sourceType: "website" | "fb_page") => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const activeBySchool = useMemo(() => {
    const map: Record<string, { sources: string[]; running: boolean }> = {};
    for (const job of jobs) {
      const schoolId = jobSchoolId(job);
      if (!schoolId || !isActiveJob(job) || !job.source_type) continue;
      const current = map[schoolId] ?? { sources: [], running: false };
      current.sources.push(job.source_type);
      current.running = current.running || job.status === "running";
      map[schoolId] = current;
    }
    return map;
  }, [jobs]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return schools.filter((school) => {
      if (needle && !school.name.toLowerCase().includes(needle)) return false;
      const last = lastBySchool[school.id];
      const queued = (activeBySchool[school.id]?.sources.length ?? 0) > 0;
      if (filter === "website") return Boolean(school.official_website_url);
      if (filter === "facebook") return Boolean(school.official_facebook_url);
      if (filter === "never") return !last?.crawled_at;
      if (filter === "queued") return queued;
      if (filter === "blocked") return last?.crawl_status === "blocked" || last?.crawl_status === "disallowed";
      return true;
    });
  }, [activeBySchool, filter, lastBySchool, query, schools]);

  const shown = filtered.slice(0, visible);

  return (
    <section className="operator-panel" aria-labelledby="crawl-targets-heading">
      <div className="operator-panel-head">
        <div>
          <h2 id="crawl-targets-heading">Crawl targets</h2>
          <p className="operator-lead">
            Edit official URLs, see last crawl status, and queue a recrawl. Website jobs start immediately. Facebook
            jobs wait for the Apify pipeline.
          </p>
        </div>
        <p className="operator-count">
          {filtered.length} of {schools.length}
        </p>
      </div>

      {notice ? <p className="operator-notice">{notice}</p> : null}

      <div className="crawl-toolbar">
        <label className="crawl-search">
          Search schools
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Search by name"
          />
        </label>
        <div className="crawl-filters" role="group" aria-label="Filter crawl targets">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={filter === item.id ? "op-chip op-chip-active" : "op-chip"}
              onClick={() => {
                setFilter(item.id);
                setVisible(PAGE_SIZE);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="operator-empty">No schools match this filter.</p>
      ) : (
        <ul className="crawl-list">
          {shown.map((school) => {
            const last = lastBySchool[school.id];
            const queued = activeBySchool[school.id]?.sources ?? [];
            const websiteBusy = busyKey === `${school.id}:website`;
            const facebookBusy = busyKey === `${school.id}:fb_page`;
            const status = queued.length
              ? { tone: "queued", text: activeBySchool[school.id]?.running ? "Running" : "Queued" }
              : !last?.crawled_at
                ? { tone: "unknown", text: "Never crawled" }
                : last.crawl_status === "blocked" || last.crawl_status === "disallowed"
                  ? { tone: "blocked", text: `${last.crawl_status} · ${last.crawled_at.slice(0, 10)}` }
                  : { tone: "success", text: `Success · ${last.crawled_at.slice(0, 10)}` };
            const website = hostLabel(school.official_website_url);
            const facebook = hostLabel(school.official_facebook_url);
            const open = openId === school.id;

            return (
              <li key={school.id} className={open ? "crawl-row crawl-row-open" : "crawl-row"}>
                <div className="crawl-main">
                  <div className="crawl-identity">
                    <Link href={`/schools/${school.id}`}>{school.name}</Link>
                    <p className="crawl-urls">
                      <span>{website ?? "No website"}</span>
                      <span aria-hidden="true">·</span>
                      <span>{facebook ?? "No Facebook"}</span>
                    </p>
                  </div>
                  <span className={`crawl-status crawl-status-${status.tone}`}>{status.text}</span>
                  <div className="crawl-actions">
                    <button type="button" className="op-btn ghost" onClick={() => setOpenId(open ? null : school.id)}>
                      {open ? "Close" : "Edit URLs"}
                    </button>
                    <button
                      type="button"
                      className="op-btn"
                      disabled={!school.official_website_url || websiteBusy}
                      onClick={() => onQueue(school, "website")}
                    >
                      {websiteBusy ? "Queueing…" : queued.includes("website") ? "Website queued" : "Queue website"}
                    </button>
                    <button
                      type="button"
                      className="op-btn ghost"
                      disabled={!school.official_facebook_url || facebookBusy}
                      onClick={() => onQueue(school, "fb_page")}
                    >
                      {facebookBusy ? "Queueing…" : queued.includes("fb_page") ? "Facebook queued" : "Queue Facebook"}
                    </button>
                  </div>
                </div>
                {open ? (
                  <form className="crawl-edit" onSubmit={(event) => onSaveUrls(event, school)}>
                    <label htmlFor={`web-${school.id}`}>
                      Website
                      <input
                        id={`web-${school.id}`}
                        name="website"
                        defaultValue={school.official_website_url ?? ""}
                        placeholder="https://"
                      />
                    </label>
                    <label htmlFor={`fb-${school.id}`}>
                      Facebook
                      <input
                        id={`fb-${school.id}`}
                        name="facebook"
                        defaultValue={school.official_facebook_url ?? ""}
                        placeholder="https://facebook.com/…"
                      />
                    </label>
                    <button type="submit" className="op-btn">
                      Save URLs
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > visible ? (
        <button type="button" className="op-btn ghost crawl-more" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
          Show more ({filtered.length - visible} left)
        </button>
      ) : null}
    </section>
  );
}
