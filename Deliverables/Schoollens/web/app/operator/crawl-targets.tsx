"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { SchoolMark } from "../components/school-mark";

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
  { id: "all", label: "All schools" },
  { id: "website", label: "Has website" },
  { id: "facebook", label: "Has Facebook" },
  { id: "never", label: "Never crawled" },
  { id: "queued", label: "In queue" },
  { id: "blocked", label: "Blocked" },
];

const DEMO_FIRST = new Set([
  "b0595924-73f7-49c4-94b0-b05017d77ef8",
  "f6c7b97d-8959-4d0c-841f-8148d10dcd4d",
  "d1e8deee-ed2c-43fb-a382-c3adb5d06861",
  "ba3c6f02-961b-42e1-8ef9-21d872abbda7",
  "5d88ea9c-c422-4696-88f3-5f2afb315530",
]);

export function jobSchoolId(job: Job): string | null {
  const errors = job.errors;
  if (errors && typeof errors === "object" && !Array.isArray(errors) && "school_id" in errors) {
    const value = (errors as { school_id?: unknown }).school_id;
    return value ? String(value) : null;
  }
  return null;
}

export type CrawledPageRow = {
  url: string;
  title: string | null;
  status?: string;
  chars?: number;
  snippet?: string;
};

export function jobCrawledPages(job: Job): CrawledPageRow[] {
  const errors = job.errors;
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) return [];
  const pages = (errors as { crawled_pages?: unknown }).crawled_pages;
  if (!Array.isArray(pages)) return [];
  return pages.filter((row): row is CrawledPageRow => Boolean(row && typeof row === "object" && "url" in row));
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
  const [filter, setFilter] = useState<Filter>("website");
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
    const rows = schools.filter((school) => {
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
    return rows.sort((a, b) => {
      const aFirst = DEMO_FIRST.has(a.id) ? 0 : 1;
      const bFirst = DEMO_FIRST.has(b.id) ? 0 : 1;
      if (aFirst !== bFirst) return aFirst - bFirst;
      return a.name.localeCompare(b.name);
    });
  }, [activeBySchool, filter, lastBySchool, query, schools]);

  const shown = filtered.slice(0, visible);

  return (
    <section className="op-card" id="collect" aria-labelledby="crawl-targets-heading">
      <div className="op-card-head">
        <div>
          <p className="op-kicker">Live collection</p>
          <h2 id="crawl-targets-heading">Crawl official websites</h2>
          <p className="op-lead">
            Queue a school website. The crawler reads public pages; extract then writes evidence on the profile.
          </p>
        </div>
        <p className="op-count">
          <strong>{filtered.length}</strong>
          <span>of {schools.length} schools</span>
        </p>
      </div>

      {notice ? <p className="op-notice">{notice}</p> : null}

      <div className="op-toolbar">
        <label className="op-search">
          <span className="visually-hidden">Search schools</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Search ILBC, ISY, Kings…"
          />
        </label>
        <div className="op-filters" role="group" aria-label="Filter crawl targets">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={filter === item.id ? "op-pill op-pill-active" : "op-pill"}
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
        <p className="op-empty">No schools match this filter.</p>
      ) : (
        <ul className="op-crawl-list">
          {shown.map((school) => {
            const last = lastBySchool[school.id];
            const queued = activeBySchool[school.id]?.sources ?? [];
            const websiteBusy = busyKey === `${school.id}:website`;
            const facebookBusy = busyKey === `${school.id}:fb_page`;
            const status = queued.length
              ? { tone: "queued", text: activeBySchool[school.id]?.running ? "Running" : "Queued" }
              : !last?.crawled_at
                ? { tone: "unknown", text: "Ready to crawl" }
                : last.crawl_status === "blocked" || last.crawl_status === "disallowed"
                  ? { tone: "blocked", text: last.crawl_status }
                  : { tone: "success", text: "Crawled" };
            const website = hostLabel(school.official_website_url);
            const facebook = hostLabel(school.official_facebook_url);
            const open = openId === school.id;
            const when = last?.crawled_at ? last.crawled_at.slice(0, 10) : null;

            return (
              <li key={school.id} className={open ? "op-crawl-row is-open" : "op-crawl-row"}>
                <div className="op-crawl-main">
                  <SchoolMark name={school.name} schoolId={school.id} groupId={null} size="md" />
                  <div className="op-crawl-copy">
                    <div className="op-crawl-title-row">
                      <Link href={`/schools/${school.id}`} className="op-crawl-name">
                        {school.name}
                      </Link>
                      <span className={`op-status op-status-${status.tone}`}>{status.text}</span>
                    </div>
                    <p className="op-crawl-meta">
                      <span className={website ? "op-source-ok" : "op-source-missing"}>
                        {website ?? "No website"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className={facebook ? "op-source-ok" : "op-source-missing"}>
                        {facebook ?? "No Facebook"}
                      </span>
                      {when ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Last {when}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="op-crawl-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!school.official_website_url || websiteBusy}
                      onClick={() => onQueue(school, "website")}
                    >
                      {websiteBusy ? "Queueing…" : queued.includes("website") ? "Website queued" : "Crawl website"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={!school.official_facebook_url || facebookBusy}
                      onClick={() => onQueue(school, "fb_page")}
                    >
                      {facebookBusy ? "Queueing…" : queued.includes("fb_page") ? "Facebook queued" : "Queue Facebook"}
                    </button>
                    <button type="button" className="op-text-btn" onClick={() => setOpenId(open ? null : school.id)}>
                      {open ? "Close" : "Edit sources"}
                    </button>
                  </div>
                </div>
                {open ? (
                  <form className="op-crawl-edit" onSubmit={(event) => onSaveUrls(event, school)}>
                    <label htmlFor={`web-${school.id}`}>
                      Official website
                      <input
                        id={`web-${school.id}`}
                        name="website"
                        defaultValue={school.official_website_url ?? ""}
                        placeholder="https://"
                      />
                    </label>
                    <label htmlFor={`fb-${school.id}`}>
                      Official Facebook
                      <input
                        id={`fb-${school.id}`}
                        name="facebook"
                        defaultValue={school.official_facebook_url ?? ""}
                        placeholder="https://facebook.com/…"
                      />
                    </label>
                    <button type="submit" className="btn btn-primary">
                      Save sources
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > visible ? (
        <button type="button" className="btn btn-secondary op-more" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
          Show more ({filtered.length - visible} left)
        </button>
      ) : null}
    </section>
  );
}
