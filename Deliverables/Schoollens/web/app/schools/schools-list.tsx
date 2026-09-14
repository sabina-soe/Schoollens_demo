"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { headlineConfidence } from "@/lib/row-confidence";
import { ConfidenceChip } from "./[id]/confidence-chip";

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

  return (
    <main className="wide directory-page">
      <header className="page-intro">
        <h1>Schools</h1>
        <p className="page-lead">
          A public register of evidence, not a league table. Filter by name, curriculum, or conflicting sources.
        </p>
      </header>
      <form className="filter-bar" onSubmit={(event) => event.preventDefault()}>
        <div className="filter-field filter-search">
          <label htmlFor="q">Search</label>
          <input
            id="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or address"
            autoComplete="off"
          />
        </div>
        <div className="filter-field">
          <label htmlFor="curriculum">Curriculum</label>
          <select id="curriculum" value={curriculum} onChange={(event) => setCurriculum(event.target.value)}>
            <option value="">All</option>
            {curricula.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor="sort">Sort</label>
          <select id="sort" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="name">Name</option>
            <option value="concern">Most concerning evidence first</option>
            <option value="supported">Most supported groups</option>
          </select>
        </div>
        <label className="check-row filter-check">
          <input
            type="checkbox"
            checked={onlyConflicts}
            onChange={(event) => setOnlyConflicts(event.target.checked)}
          />
          Conflicts only
        </label>
      </form>
      <p className="result-count" aria-live="polite">
        {loading ? "Loading schools…" : `${filtered.length.toLocaleString()} school${filtered.length === 1 ? "" : "s"}`}
      </p>
      {error ? <p className="error">{error}</p> : null}
      {loading ? (
        <ul className="ledger directory-skeleton" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index} className="directory-row skeleton-row" />
          ))}
        </ul>
      ) : null}
      {!loading && !error && filtered.length === 0 ? (
        <div className="empty-state">
          <h2>No schools match</h2>
          <p>Clear the search or turn off “Conflicts only” to see the full register.</p>
        </div>
      ) : null}
      {!loading ? (
        <ul className="ledger directory-list">
          {filtered.map((school) => {
            const labels = labelsBySchool[school.id] ?? [];
            const meta = [school.curriculum_type, school.address].filter(Boolean).join(" · ");
            return (
              <li key={school.id}>
                <Link href={`/schools/${school.id}`} className="directory-row">
                  <div>
                    <span className="directory-name">{school.name}</span>
                    {meta ? <span className="directory-meta">{meta}</span> : null}
                  </div>
                  <ConfidenceChip label={labels.length ? headlineConfidence(labels) : "unknown"} />
                </Link>
                {school.school_group_id ? (
                  <Link href={`/schools/network/${school.school_group_id}`} className="directory-network">
                    Network map
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </main>
  );
}
