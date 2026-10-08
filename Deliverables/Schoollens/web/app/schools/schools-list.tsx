"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CONFIDENCE_LABELS, type ConfidenceLabel } from "@/lib/confidence";
import { isRegisterUnreachable, loadLocalSchools, withTimeout } from "@/lib/public-register";
import { loadKnownClaimOverlays, overlayLabels } from "@/lib/claim-overlay";
import { headlineConfidence } from "@/lib/row-confidence";
import { ConfidenceChip } from "./[id]/confidence-chip";
import { SchoolMark } from "../components/school-mark";
import { SchoolCardSkeleton } from "../components/ui/skeleton";
import { placeMatchesAddress } from "@/lib/places";
import { collapseDirectorySchools } from "@/lib/school-network";
import { schoolMatchesQuery } from "@/lib/school-search";
import { type MoeRecord } from "@/lib/moe-register";

type School = {
  id: string;
  name: string;
  address: string | null;
  curriculum_type: string | null;
  school_group_id: string | null;
  moe_approved_from: string | null;
  campusCount?: number;
};

type SortKey = "name" | "concern" | "supported";

const CONFIDENCE_TITLES: Record<ConfidenceLabel, string> = {
  supported: "Supported",
  likely: "Likely",
  conflicting: "Conflicting",
  outdated: "Outdated",
  unknown: "Unknown",
};

function placeLabel(address: string | null) {
  if (!address) return "";
  const parts = address.split(/[,/]/).map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] || "";
}

export function SchoolsList() {
  const searchParams = useSearchParams();
  const [schools, setSchools] = useState<School[]>([]);
  const [labelsBySchool, setLabelsBySchool] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [location, setLocation] = useState(searchParams.get("location") ?? "");
  const [selectedCurricula, setSelectedCurricula] = useState<string[]>([]);
  const [selectedConfidences, setSelectedConfidences] = useState<ConfidenceLabel[]>([]);
  const [sort, setSort] = useState<SortKey>("name");
  const [moeBySchool, setMoeBySchool] = useState<Record<string, MoeRecord>>({});

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const local = await loadLocalSchools();
      fetch("/moe-register/by-school.json")
        .then((response) => response.json())
        .then((payload) => {
          setMoeBySchool(payload ?? {});
        })
        .catch(() => {
          setMoeBySchool({});
        });
      if (local.length) {
        setSchools(collapseDirectorySchools(local));
        setLoading(false);
        const seeded = await loadKnownClaimOverlays();
        if (seeded.groups.length) {
          const next = overlayLabels(seeded.groups);
          for (const school of local) {
            const aliasId = seeded.index.aliases?.[school.id];
            if ((next[school.id] ?? []).length || !aliasId || !next[aliasId]) continue;
            next[school.id] = next[aliasId];
          }
          setLabelsBySchool(next);
        }
      }
      try {
        const { data, error: queryError } = await withTimeout(
          supabase
            .from("schools")
            .select("id, name, address, curriculum_type, school_group_id, moe_approved_from")
            .order("name"),
        );
        if (queryError) throw new Error(queryError.message);
        const rows = data ?? [];
        if (!rows.length) return;
        setSchools(collapseDirectorySchools(rows));
        const { data: groups } = await supabase.from("claim_groups").select("school_id, confidence_label");
        const next: Record<string, string[]> = {};
        for (const group of groups ?? []) {
          const list = next[group.school_id] ?? [];
          list.push(group.confidence_label ?? "unknown");
          next[group.school_id] = list;
        }
        if (!groups?.length) {
          const overlay = await loadKnownClaimOverlays();
          Object.assign(next, overlayLabels(overlay.groups));
        }
        const byGroup: Record<string, string[]> = {};
        for (const school of rows) {
          if (!school.school_group_id) continue;
          const labels = next[school.id] ?? [];
          if (!labels.length) continue;
          byGroup[school.school_group_id] = labels;
        }
        for (const school of rows) {
          if (!school.school_group_id || (next[school.id] ?? []).length) continue;
          if (byGroup[school.school_group_id]) next[school.id] = byGroup[school.school_group_id];
        }
        setLabelsBySchool(next);
        setError(null);
      } catch (caught) {
        if (!local.length && !isRegisterUnreachable(caught)) {
          setError(caught instanceof Error ? caught.message : "Could not load the register.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    setLocation(searchParams.get("location") ?? "");
  }, [searchParams]);

  const curricula = useMemo(
    () => [...new Set(schools.map((school) => school.curriculum_type).filter((value): value is string => Boolean(value)))].sort(),
    [schools],
  );

  const places = useMemo(() => {
    const counts = new Map<string, number>();
    for (const school of schools) {
      const place = placeLabel(school.address);
      if (!place) continue;
      counts.set(place, (counts.get(place) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [schools]);

  const curriculumCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const school of schools) {
      if (!school.curriculum_type) continue;
      counts.set(school.curriculum_type, (counts.get(school.curriculum_type) ?? 0) + 1);
    }
    return counts;
  }, [schools]);

  const confidenceCounts = useMemo(() => {
    const next: Record<ConfidenceLabel, number> = {
      supported: 0,
      likely: 0,
      conflicting: 0,
      outdated: 0,
      unknown: 0,
    };
    for (const school of schools) {
      const labels = labelsBySchool[school.id] ?? [];
      next[headlineConfidence(labels)] += 1;
    }
    return next;
  }, [schools, labelsBySchool]);

  const topCurricula = useMemo(
    () => [...curriculumCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name]) => name),
    [curriculumCounts],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = schools.filter((school) => {
      const labels = labelsBySchool[school.id] ?? [];
      const headline = headlineConfidence(labels);
      if (selectedCurricula.length && (!school.curriculum_type || !selectedCurricula.includes(school.curriculum_type))) {
        return false;
      }
      if (selectedConfidences.length && !selectedConfidences.includes(headline)) return false;
      if (needle && !schoolMatchesQuery(school, needle)) return false;
      if (location.trim() && !placeMatchesAddress(school.address, location.trim())) return false;
      return true;
    });
    return rows.sort((a, b) => {
      const aLabels = labelsBySchool[a.id] ?? [];
      const bLabels = labelsBySchool[b.id] ?? [];
      if (sort === "concern") {
        const rank = { conflicting: 0, unknown: 1, outdated: 2, likely: 3, supported: 4 } as const;
        return rank[headlineConfidence(aLabels)] - rank[headlineConfidence(bLabels)] || a.name.localeCompare(b.name);
      }
      if (sort === "supported") {
        const aCount = aLabels.filter((label) => label === "supported").length;
        const bCount = bLabels.filter((label) => label === "supported").length;
        return bCount - aCount || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  }, [schools, labelsBySchool, query, location, selectedCurricula, selectedConfidences, sort]);

  function resetFilters() {
    setQuery("");
    setLocation("");
    setSelectedCurricula([]);
    setSelectedConfidences([]);
    setSort("name");
  }

  function toggleCurriculum(value: string) {
    setSelectedCurricula((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function toggleConfidence(value: ConfidenceLabel) {
    setSelectedConfidences((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function onFilterSubmit(event: FormEvent) {
    event.preventDefault();
    document.getElementById("directory-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const hasActiveFilters = Boolean(
    query || location || selectedCurricula.length || selectedConfidences.length || sort !== "name",
  );
  const allActive = selectedCurricula.length === 0 && selectedConfidences.length === 0 && !location;
  const heroCurriculum = selectedCurricula.length === 1 ? selectedCurricula[0] : "";

  return (
    <main className="directory-page">
      <section className="dir-strip">
        <div className="dir-inner">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/" className="breadcrumb-link">
              Home
            </Link>
            <span className="breadcrumb-separator" aria-hidden="true">
              /
            </span>
            <span className="breadcrumb-current">Directory</span>
          </nav>
          <div className="profile-ticker">
            <span className="profile-ticker-dot" aria-hidden="true" />
            <span className="profile-ticker-text">Public records · not a ranking</span>
          </div>
        </div>
      </section>

      <section className="dir-hero">
        <div className="dir-inner">
          <div className="page-intro-badge">Independent evidence ledger</div>
          <h1>Schools in the public register</h1>
          <p className="page-lead">
            {loading
              ? "Search MOE-registered private and international schools. Each campus shows a confidence label, not a ranking."
              : `Search ${schools.length.toLocaleString()} campuses. Claims are reconciled from the MOE register, school websites, and Facebook.`}
          </p>

          <form className="dir-filter-card" onSubmit={onFilterSubmit}>
            <div className="dir-filter-grid">
              <div className="filter-field dir-filter-query">
                <label htmlFor="q">Institution or keyword</label>
                <div className="input-search-wrap">
                  <svg className="input-search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <input
                    id="q"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="e.g. Yangon, Cambridge, International…"
                    autoComplete="off"
                    className="input-search"
                  />
                  {query ? (
                    <button type="button" className="input-clear-btn" onClick={() => setQuery("")} aria-label="Clear search query">
                      ✕
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="filter-field">
                <label htmlFor="curriculum">Curriculum</label>
                <select
                  id="curriculum"
                  value={heroCurriculum}
                  onChange={(event) => setSelectedCurricula(event.target.value ? [event.target.value] : [])}
                  className="select-custom"
                >
                  <option value="">All curricula</option>
                  {curricula.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="dir-filter-actions">
                <button type="submit" className="btn btn-primary">
                  Filter
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetFilters} title="Reset filters">
                  Reset
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      <section className="dir-toolbar">
        <div className="dir-inner dir-toolbar-inner">
          <div className="dir-pills" role="tablist" aria-label="Quick filters">
            <button
              type="button"
              className={`dir-pill ${allActive ? "dir-pill-active" : ""}`}
              onClick={() => {
                setSelectedCurricula([]);
                setSelectedConfidences([]);
                setLocation("");
              }}
            >
              All institutions
              <span className="dir-pill-count">{schools.length}</span>
            </button>
            <button
              type="button"
              className={`dir-pill ${selectedConfidences.length === 1 && selectedConfidences[0] === "conflicting" ? "dir-pill-active" : ""}`}
              onClick={() => setSelectedConfidences(["conflicting"])}
            >
              Conflicting evidence
              <span className="dir-pill-count">{confidenceCounts.conflicting}</span>
            </button>
            {topCurricula.map((item) => (
              <button
                key={item}
                type="button"
                className={`dir-pill ${selectedCurricula.length === 1 && selectedCurricula[0] === item ? "dir-pill-active" : ""}`}
                onClick={() => setSelectedCurricula([item])}
              >
                {item}
                <span className="dir-pill-count">{curriculumCounts.get(item)}</span>
              </button>
            ))}
          </div>
          <label className="dir-sort">
            <span>Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="select-custom">
              <option value="name">Alphabetical (A–Z)</option>
              <option value="concern">Most conflicting first</option>
              <option value="supported">Most supported first</option>
            </select>
          </label>
        </div>
      </section>

      <section className="dir-body" id="directory-results">
        <div className="dir-inner dir-layout">
          <aside className="dir-aside">
            <div className="dir-aside-head">
              <h2>Filters</h2>
              <button type="button" className="btn-text-sm" onClick={resetFilters} disabled={!hasActiveFilters}>
                Reset all
              </button>
            </div>
            <div className="dir-aside-note">
              <strong>Evidence on file</strong>
              <p>Confidence comes from claim groups. SchoolLens does not rank these campuses.</p>
            </div>

            <fieldset className="dir-facet">
              <legend>Confidence</legend>
              {CONFIDENCE_LABELS.map((label) => (
                <label key={label} className="dir-check">
                  <span>
                    <input
                      type="checkbox"
                      checked={selectedConfidences.includes(label)}
                      onChange={() => toggleConfidence(label)}
                    />
                    {CONFIDENCE_TITLES[label]}
                  </span>
                  <span className="dir-check-count">{confidenceCounts[label]}</span>
                </label>
              ))}
            </fieldset>

            {curricula.length ? (
              <fieldset className="dir-facet">
                <legend>Curriculum</legend>
                {curricula.map((item) => (
                  <label key={item} className="dir-check">
                    <span>
                      <input
                        type="checkbox"
                        checked={selectedCurricula.includes(item)}
                        onChange={() => toggleCurriculum(item)}
                      />
                      {item}
                    </span>
                    <span className="dir-check-count">{curriculumCounts.get(item) ?? 0}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}

            {places.length ? (
              <fieldset className="dir-facet">
                <legend>Listed places</legend>
                {places.slice(0, 8).map(([place, count]) => (
                  <label key={place} className="dir-check">
                    <span>
                      <input
                        type="checkbox"
                        checked={location.toLowerCase() === place.toLowerCase()}
                        onChange={() => setLocation(location.toLowerCase() === place.toLowerCase() ? "" : place)}
                      />
                      {place}
                    </span>
                    <span className="dir-check-count">{count}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}
          </aside>

          <div className="dir-results">
            <div className="dir-results-bar">
              <p className="result-count" aria-live="polite">
                {loading
                  ? "Loading…"
                  : `Showing ${filtered.length.toLocaleString()} of ${schools.length.toLocaleString()} schools`}
              </p>
              {hasActiveFilters ? (
                <button type="button" className="btn-text-sm" onClick={resetFilters}>
                  Clear filters
                </button>
              ) : null}
            </div>

            {error ? <div className="error-banner">{error}</div> : null}

            {loading ? (
              <div className="dir-list" aria-hidden="true">
                {Array.from({ length: 4 }, (_, index) => (
                  <SchoolCardSkeleton key={index} />
                ))}
              </div>
            ) : null}

            {!loading && !error && filtered.length === 0 ? (
              <div className="empty-state-card">
                <h2>No schools match these filters</h2>
                <p>Try a different name, curriculum, or place.</p>
                <button type="button" className="btn btn-secondary" onClick={resetFilters}>
                  Clear all filters
                </button>
              </div>
            ) : null}

            {!loading ? (
              <div className="dir-list">
                {filtered.map((school) => {
                  const labels = labelsBySchool[school.id] ?? [];
                  const headline = labels.length ? headlineConfidence(labels) : "unknown";
                  const groupCount = labels.length;
                  return (
                    <article key={school.id} className="dir-card">
                      <div className={`dir-card-accent dir-card-accent-${headline}`} />
                      <div className="dir-card-body">
                        <div className="dir-card-top">
                          <div className="dir-card-identity">
                            <SchoolMark name={school.name} schoolId={school.id} groupId={school.school_group_id} size="md" />
                            <div>
                              <h2 className="dir-card-title">
                                <Link href={`/schools/${school.id}`}>{school.name}</Link>
                              </h2>
                              {school.address ? (
                                <p className="dir-card-address">
                                  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                    <path
                                      fillRule="evenodd"
                                      d="M8 1a5 5 0 00-5 5c0 3.5 5 9 5 9s5-5.5 5-9a5 5 0 00-5-5zm0 7a2 2 0 100-4 2 2 0 000 4z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  <span>{school.address}</span>
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <div className="dir-card-score">
                            <ConfidenceChip label={headline} size="sm" />
                            <span className="dir-card-groups">
                              {groupCount} claim group{groupCount === 1 ? "" : "s"}
                            </span>
                          </div>
                        </div>

                        <div className="dir-card-tags">
                          {school.curriculum_type ? (
                            <span className="meta-badge meta-badge-curriculum">{school.curriculum_type}</span>
                          ) : null}
                          {school.moe_approved_from || moeBySchool[school.id] ? (
                            <span className="meta-badge">
                              {moeBySchool[school.id]?.campus_count > 1
                                ? `MOE · ${moeBySchool[school.id].campus_count} campuses`
                                : "MOE registered"}
                            </span>
                          ) : null}
                          {(school.campusCount ?? 0) > 1 ? (
                            <span className="meta-badge">{school.campusCount} campuses</span>
                          ) : school.school_group_id ? (
                            <span className="meta-badge">Network</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="dir-card-footer">
                        <div className="dir-card-footer-meta">
                          {school.school_group_id ? (
                            <Link href={`/schools/network/${school.school_group_id}`} className="network-link">
                              Network map
                            </Link>
                          ) : (
                            <span>Public register record</span>
                          )}
                        </div>
                        <div className="dir-card-actions">
                          <Link href={`/schools/${school.id}#ask`} className="btn btn-primary btn-sm">
                            Ask
                          </Link>
                          <Link href={`/schools/${school.id}`} className="dir-card-profile">
                            View profile
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
