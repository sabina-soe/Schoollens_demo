"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadLocalSchools, withTimeout } from "@/lib/public-register";
import { headlineConfidence } from "@/lib/row-confidence";
import { ConfidenceChip } from "./schools/[id]/confidence-chip";
import { PlaceCombobox } from "./components/place-combobox";
import { roleLabel, useSession } from "./session-context";

const STEPS = [
  {
    title: "Aggregate",
    body: "MOE filings, official school websites, and public Facebook pages.",
    icon: (
      <svg className="step-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Reconcile",
    body: "Sources are cross-checked. Disagreements stay visible as confidence labels.",
    icon: (
      <svg className="step-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 6h18M12 3v18m-6-5-3-7h6l-3 7zm12 0-3-7h6l-3 7zM7 21h10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Ask",
    body: "Questions cite retrieved records. If sources are silent, SchoolLens says so.",
    icon: (
      <svg className="step-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
];

const LEGEND_ITEMS = [
  {
    label: "supported",
    desc: "Independent sources agree.",
  },
  {
    label: "likely",
    desc: "One reliable official source.",
  },
  {
    label: "conflicting",
    desc: "Sources disagree.",
  },
  {
    label: "outdated",
    desc: "Newer records supersede this.",
  },
  {
    label: "unknown",
    desc: "Not enough public record.",
  },
] as const;

type FeaturedSchool = {
  id: string;
  name: string;
  address: string | null;
  curriculum_type: string | null;
  confidence: string;
};

export function HomeView() {
  const { status, role } = useSession();
  const router = useRouter();
  const [schoolCount, setSchoolCount] = useState<number | null>(null);
  const [featured, setFeatured] = useState<FeaturedSchool[]>([]);
  const [featuredReady, setFeaturedReady] = useState(false);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const local = await loadLocalSchools();
        if (local.length) {
          setSchoolCount(local.length);
          setFeatured(
            local.slice(0, 3).map((school) => ({
              id: school.id,
              name: school.name,
              address: school.address,
              curriculum_type: school.curriculum_type,
              confidence: "unknown",
            })),
          );
          setFeaturedReady(true);
        }
        const { count } = await withTimeout(supabase.from("schools").select("id", { count: "exact", head: true }));
        if (typeof count === "number") setSchoolCount(count);

        const { data: schools } = await withTimeout(
          supabase.from("schools").select("id, name, address, curriculum_type").order("name").limit(24),
        );
        const rows = schools ?? [];
        const ids = rows.map((school) => school.id);
        const { data: groups } = ids.length
          ? await supabase.from("claim_groups").select("school_id, confidence_label").in("school_id", ids)
          : { data: [] };
        const labels: Record<string, string[]> = {};
        for (const group of groups ?? []) {
          const list = labels[group.school_id] ?? [];
          list.push(group.confidence_label ?? "unknown");
          labels[group.school_id] = list;
        }
        const ranked = [...rows].sort((a, b) => (labels[b.id]?.length ?? 0) - (labels[a.id]?.length ?? 0));
        setFeatured(
          ranked.slice(0, 3).map((school) => ({
            ...school,
            confidence: labels[school.id]?.length ? headlineConfidence(labels[school.id]) : "unknown",
          })),
        );
      } catch {
        const local = await loadLocalSchools();
        setSchoolCount(local.length);
        setFeatured(
          local.slice(0, 3).map((school) => ({
            id: school.id,
            name: school.name,
            address: school.address,
            curriculum_type: school.curriculum_type,
            confidence: "unknown",
          })),
        );
      } finally {
        setFeaturedReady(true);
      }
    })();
  }, []);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (location.trim()) params.set("location", location.trim());
    const queryString = params.toString();
    router.push(queryString ? `/schools?${queryString}` : "/schools");
  }

  const directoryLabel =
    schoolCount != null ? `Browse ${schoolCount.toLocaleString()} schools` : "Browse the directory";

  return (
    <main className="home-page">
      <div className="home-wave" aria-hidden="true">
        <svg className="home-wave-svg" fill="none" preserveAspectRatio="none" viewBox="0 0 1440 600">
          <path d="M-100,240 C320,100 680,380 1100,210 C1300,130 1480,260 1600,220" stroke="#7eaec9" strokeOpacity="0.35" strokeWidth="1" />
          <path d="M-100,270 C280,140 650,410 1080,240 C1280,160 1450,290 1600,250" stroke="#8cbcd3" strokeOpacity="0.3" strokeWidth="0.8" />
          <path d="M-100,300 C350,170 720,430 1120,260 C1320,180 1490,310 1600,270" stroke="#a3cddf" strokeOpacity="0.25" strokeWidth="0.75" />
          <path d="M-100,330 C400,200 760,450 1160,280 C1360,200 1520,330 1600,290" stroke="#b9ddeb" strokeOpacity="0.2" strokeWidth="0.6" />
        </svg>
      </div>

      {status === "in" && (role === "school_admin" || role === "moderator" || role === "platform_operator") ? (
        <div className="home-inner">
          <div className="workspace-strip-card">
            <span className="workspace-badge">Signed in</span>
            <span className="workspace-text">
              Working as <strong>{roleLabel(role)}</strong>.
            </span>
            <div className="workspace-actions">
              {role === "school_admin" ? (
                <Link href="/school-admin" className="workspace-link">
                  School admin
                </Link>
              ) : null}
              {role === "moderator" ? (
                <Link href="/moderator" className="workspace-link">
                  Moderator queue
                </Link>
              ) : null}
              {role === "platform_operator" ? (
                <Link href="/operator" className="workspace-link">
                  Operator
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <section className="home-hero">
        <h1 className="home-title">
          The evidence guide to schools <em>in Myanmar</em>
        </h1>
        <p className="home-lead">
          SchoolLens reconciles the MOE register, school websites, and Facebook into evidence-linked claims. No
          sponsored listings. The AI does not pick a school.
        </p>

        <form className="home-search-pill" onSubmit={onSearch} role="search">
          <label className="home-search-field">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Yangon, Mandalay, or school name…"
              aria-label="Search schools"
            />
          </label>
          <span className="home-search-divider" aria-hidden="true" />
          <div className="home-search-field home-search-location">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <PlaceCombobox
              id="home-location"
              value={location}
              onChange={setLocation}
              placeholder="Township or city"
              variant="plain"
              aria-label="Township or city"
            />
          </div>
          <button type="submit" className="home-search-submit">
            Search
          </button>
        </form>
      </section>

      <section className="home-process" aria-label="How SchoolLens works">
        <div className="home-process-wave" aria-hidden="true">
          <svg viewBox="0 0 1000 70" fill="none" preserveAspectRatio="none">
            <path d="M 50,42 C 180,24 320,58 500,40 C 660,25 820,58 950,30" stroke="#38a39a" strokeDasharray="3 3" strokeLinecap="round" strokeWidth="1.75" />
            <circle className="home-process-beacon" cx="705" cy="42" fill="#f59e0b" r="5" />
          </svg>
        </div>
        <div className="home-process-grid">
          {STEPS.map((step) => (
            <article key={step.title} className="home-process-step">
              <div className="home-process-icon">{step.icon}</div>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-featured" aria-labelledby="featured-heading">
        <div className="home-featured-head">
          <div>
            <span className="section-kicker">Public register</span>
            <h2 id="featured-heading">Schools in the directory</h2>
          </div>
          <Link href="/schools" className="home-featured-link">
            <span>{directoryLabel}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {!featuredReady ? (
          <div className="home-featured-grid" aria-hidden="true">
            <article className="featured-school-card featured-school-skeleton" />
            <article className="featured-school-card featured-school-skeleton" />
            <article className="featured-school-card featured-school-skeleton" />
          </div>
        ) : featured.length === 0 ? (
          <p className="home-featured-empty">No campuses are on file yet.</p>
        ) : (
          <div className="home-featured-grid">
            {featured.map((school) => (
              <article key={school.id} className="featured-school-card">
                <div className="featured-school-body">
                  <ConfidenceChip label={school.confidence} size="sm" />
                  <h3>
                    <Link href={`/schools/${school.id}`}>{school.name}</Link>
                  </h3>
                  {school.address ? (
                    <p className="featured-school-address">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>{school.address}</span>
                    </p>
                  ) : null}
                </div>
                <div className="featured-school-footer">
                  <span>{school.curriculum_type || "Curriculum not listed"}</span>
                  <Link href={`/schools/${school.id}`}>View profile →</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="home-legend-section" aria-labelledby="confidence-legend">
        <div className="legend-header-text">
          <span className="section-kicker">Confidence labels</span>
          <h2 id="confidence-legend">Confidence is the product</h2>
          <p>Every claim group gets a label. Color is never the only signal — the icon and word travel with it.</p>
        </div>
        <div className="legend-grid">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.label} className="legend-card">
              <ConfidenceChip label={item.label} size="sm" />
              <p className="legend-card-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
