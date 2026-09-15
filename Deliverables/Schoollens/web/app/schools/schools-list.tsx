"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { headlineConfidence } from "@/lib/row-confidence";
import { ConfidenceChip } from "./[id]/confidence-chip";
import { SchoolCardSkeleton } from "../components/ui/skeleton";

type School = {
  id: string;
  name: string;
  address: string | null;
  curriculum_type: string | null;
  school_group_id: string | null;
};

type SortKey = "name" | "concern" | "supported";

export function SchoolsList() {
  const [schools, setSchools] = useState<School[]>([]);
  const [labelsBySchool, setLabelsBySchool] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [curriculum, setCurriculum] = useState("");
  const [onlyConflicts, setOnlyConflicts] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data, error: queryError } = await supabase
        .from("schools")
        .select("id, name, address, curriculum_type, school_group_id")
        .order("name");
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }
      const rows = data ?? [];
      setSchools(rows);
      const { data: groups } = await supabase.from("claim_groups").select("school_id, confidence_label");
      const next: Record<string, string[]> = {};
      for (const group of groups ?? []) {
        const list = next[group.school_id] ?? [];
        list.push(group.confidence_label ?? "unknown");
        next[group.school_id] = list;
      }
      setLabelsBySchool(next);
      setLoading(false);
    })();
  }, []);

  const curricula = useMemo(
    () => [...new Set(schools.map((school) => school.curriculum_type).filter((value): value is string => Boolean(value)))],
    [schools],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = schools.filter((school) => {
      const labels = labelsBySchool[school.id] ?? [];
      const headline = headlineConfidence(labels);
      if (curriculum && school.curriculum_type !== curriculum) return false;
      if (onlyConflicts && headline !== "conflicting") return false;
      if (!needle) return true;
      return `${school.name} ${school.address ?? ""}`.toLowerCase().includes(needle);
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
  }, [schools, labelsBySchool, query, curriculum, onlyConflicts, sort]);

  function resetFilters() {
    setQuery("");
    setCurriculum("");
    setOnlyConflicts(false);
    setSort("name");
  }

  const hasActiveFilters = Boolean(query || curriculum || onlyConflicts || sort !== "name");

  return (
    <main className="wide directory-page">
      <header className="page-intro">
        <div className="page-intro-badge">Public Database</div>
        <h1>Myanmar School Registry</h1>
        <p className="page-lead">
          An objective, evidence-linked directory of private and international schools. Filter by curriculum, township, or inspection confidence status.
        </p>
      </header>

      <div className="filter-card">
        <form className="filter-bar" onSubmit={(event) => event.preventDefault()}>
          <div className="filter-field filter-search">
            <label htmlFor="q">Search by name or address</label>
            <div className="input-search-wrap">
              <svg className="input-search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
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
                <button
                  type="button"
                  className="input-clear-btn"
                  onClick={() => setQuery("")}
                  aria-label="Clear search query"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>

          <div className="filter-field">
            <label htmlFor="curriculum">Curriculum</label>
            <select
              id="curriculum"
              value={curriculum}
              onChange={(event) => setCurriculum(event.target.value)}
              className="select-custom"
            >
              <option value="">All Curricula</option>
              {curricula.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="sort">Sort by</label>
            <select
              id="sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="select-custom"
            >
              <option value="name">Alphabetical (A–Z)</option>
              <option value="concern">Most conflicting first</option>
              <option value="supported">Most supported first</option>
            </select>
          </div>

          <div className="filter-toggle-wrap">
            <label className={`filter-toggle-pill ${onlyConflicts ? "filter-toggle-pill-active" : ""}`}>
              <input
                type="checkbox"
                checked={onlyConflicts}
                onChange={(event) => setOnlyConflicts(event.target.checked)}
                className="sr-only"
              />
              <span className="toggle-indicator" />
              <span>Conflicts Only</span>
            </label>
          </div>
        </form>

        <div className="filter-status-bar">
          <p className="result-count" aria-live="polite">
            {loading ? "Scanning registry…" : `${filtered.length.toLocaleString()} school${filtered.length === 1 ? "" : "s"} found`}
          </p>
          {hasActiveFilters ? (
            <button type="button" className="btn-text-sm" onClick={resetFilters}>
              Reset all filters
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      {loading ? (
        <div className="schools-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <SchoolCardSkeleton key={index} />
          ))}
        </div>
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <h2>No matching schools found</h2>
          <p>We couldn't find any registered schools matching your filter criteria. Try adjusting your query or resetting filters.</p>
          <button type="button" className="btn btn-secondary" onClick={resetFilters}>
            Clear all filters
          </button>
        </div>
      ) : null}

      {!loading ? (
        <div className="schools-grid">
          {filtered.map((school) => {
            const labels = labelsBySchool[school.id] ?? [];
            const headline = labels.length ? headlineConfidence(labels) : "unknown";
            return (
              <div key={school.id} className="school-card">
                <Link href={`/schools/${school.id}`} className="school-card-link">
                  <div className="school-card-header">
                    <h2 className="school-card-title">{school.name}</h2>
                    <ConfidenceChip label={headline} size="sm" />
                  </div>

                  <div className="school-card-meta">
                    {school.curriculum_type ? (
                      <span className="meta-badge meta-badge-curriculum">
                        <svg className="meta-icon" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm14 0c-.885-.37-2.154-.769-3.388-.893-1.33-.134-2.458.063-3.112.752v9.746c.935-.53 2.12-.603 3.213-.493 1.18.12 2.37.461 3.287.811V2.828z" />
                        </svg>
                        {school.curriculum_type}
                      </span>
                    ) : null}
                    {school.address ? (
                      <span className="meta-badge meta-badge-address">
                        <svg className="meta-icon" viewBox="0 0 16 16" fill="currentColor">
                          <path fillRule="evenodd" d="M8 1a5 5 0 00-5 5c0 3.5 5 9 5 9s5-5.5 5-9a5 5 0 00-5-5zm0 7a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        {school.address}
                      </span>
                    ) : null}
                  </div>
                </Link>

                {school.school_group_id ? (
                  <div className="school-card-footer">
                    <Link href={`/schools/network/${school.school_group_id}`} className="network-link">
                      <span>View campus network map →</span>
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </main>
  );
}
