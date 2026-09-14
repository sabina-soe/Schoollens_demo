"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeConfidence, type ConfidenceLabel } from "@/lib/confidence";
import { AskTab } from "./ask-tab";
import { BranchesMap } from "./branches-map";
import { ChangesTab } from "./changes-tab";
import { ClaimForm } from "./claim-form";
import { ConfidenceChip } from "./confidence-chip";
import { OverviewTab } from "./overview-tab";
import { ReviewsTab } from "./reviews-tab";

type ProfileTab = "evidence" | "changes" | "ask" | "reviews";

type School = {
  id: string;
  name: string;
  address: string | null;
  school_group_id: string | null;
  official_website_url: string | null;
  official_facebook_url: string | null;
  curriculum_type: string | null;
  moe_approved_from: string | null;
  moe_approved_to: string | null;
  location: unknown;
  geocode_confidence: string | null;
};

const EMPTY_COUNTS: Record<ConfidenceLabel, number> = {
  supported: 0,
  likely: 0,
  conflicting: 0,
  outdated: 0,
  unknown: 0,
};

export function SchoolProfile({ id }: { id: string }) {
  const [school, setSchool] = useState<School | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [ownStatus, setOwnStatus] = useState<string | null>(null);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [branches, setBranches] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ProfileTab>("evidence");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#culture-safety") setTab("evidence");
  }, []);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data, error: schoolError } = await supabase
        .from("schools")
        .select(
          "id, name, address, school_group_id, official_website_url, official_facebook_url, curriculum_type, moe_approved_from, moe_approved_to, location, geocode_confidence",
        )
        .eq("id", id)
        .maybeSingle();
      if (schoolError) {
        setError(schoolError.message);
        setLoading(false);
        return;
      }
      setSchool(data);
      if (data?.school_group_id) {
        const { data: network } = await supabase
          .from("schools")
          .select(
            "id, name, address, school_group_id, official_website_url, official_facebook_url, curriculum_type, moe_approved_from, moe_approved_to, location, geocode_confidence",
          )
          .eq("school_group_id", data.school_group_id)
          .order("name");
        setBranches(network ?? []);
      } else {
        setBranches(data ? [data] : []);
      }
      const { data: groups } = await supabase
        .from("claim_groups")
        .select("confidence_label")
        .eq("school_id", id);
      const next = { ...EMPTY_COUNTS };
      for (const group of groups ?? []) {
        next[normalizeConfidence(group.confidence_label)] += 1;
      }
      setCounts(next);
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      setSignedIn(Boolean(user));
      if (user) {
        const { data: own } = await supabase
          .from("school_claim_requests")
          .select("status")
          .eq("school_id", id)
          .eq("requested_by", user.id)
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();
        setOwnStatus(own?.status ?? null);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <main className="profile-page">
        <p>Loading…</p>
      </main>
    );
  }

  if (!school) {
    return (
      <main className="profile-page">
        <p>{error || "School not found."}</p>
      </main>
    );
  }

  const meta = [school.curriculum_type, school.address].filter(Boolean).join(" · ");
  const moeRange = [school.moe_approved_from, school.moe_approved_to].filter(Boolean).join(" – ");
  const totalGroups = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <main className="profile-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/schools">Schools</Link>
        <span aria-hidden="true"> / </span>
        <span>{school.name}</span>
      </nav>

      <header className="profile-hero">
        <div>
          <h1>{school.name}</h1>
          {meta ? <p className="profile-meta">{meta}</p> : null}
          {school.school_group_id ? (
            <p className="profile-meta">
              Part of a multi-branch network.{" "}
              <Link href={`/schools/network/${school.school_group_id}`}>Open network map</Link>
            </p>
          ) : null}
          {ownStatus === "pending" ? <p>Your claim is pending moderator review.</p> : null}
          {ownStatus === "approved" ? <p>You are the verified school admin for this school.</p> : null}
        </div>
        <div className="profile-summary" aria-label="Evidence summary">
          {totalGroups === 0 ? (
            <ConfidenceChip label="unknown" />
          ) : (
            (["supported", "likely", "conflicting", "outdated", "unknown"] as ConfidenceLabel[])
              .filter((label) => counts[label] > 0)
              .map((label) => (
                <span key={label} className="profile-summary-item">
                  <ConfidenceChip label={label} />
                  <span className="profile-summary-count">{counts[label]}</span>
                </span>
              ))
          )}
        </div>
      </header>

      <div className="stat-strip">
        {school.curriculum_type ? (
          <div className="stat-block">
            <p className="stat-value">{school.curriculum_type}</p>
            <p className="stat-label">Curriculum</p>
          </div>
        ) : null}
        {moeRange ? (
          <div className="stat-block">
            <p className="stat-value">{moeRange}</p>
            <p className="stat-label">MOE approved</p>
          </div>
        ) : null}
        <div className="stat-block">
          <p className="stat-value">{branches.length || 1}</p>
          <p className="stat-label">{branches.length > 1 ? "Branches" : "Campus"}</p>
        </div>
      </div>

      <BranchesMap branches={branches} activeId={school.id} />

      <div className="profile-layout">
        <div className="profile-main">
          <nav className="profile-tabs" aria-label="School profile">
            <button
              type="button"
              className={tab === "evidence" ? "profile-tab profile-tab-active" : "profile-tab"}
              aria-current={tab === "evidence" ? "page" : undefined}
              onClick={() => setTab("evidence")}
            >
              Overview
            </button>
            <button
              type="button"
              className={tab === "changes" ? "profile-tab profile-tab-active" : "profile-tab"}
              aria-current={tab === "changes" ? "page" : undefined}
              onClick={() => setTab("changes")}
            >
              What’s Changed
            </button>
            <button
              type="button"
              className={tab === "ask" ? "profile-tab profile-tab-active" : "profile-tab"}
              aria-current={tab === "ask" ? "page" : undefined}
              onClick={() => setTab("ask")}
            >
              Ask a Question
            </button>
            <button
              type="button"
              className={tab === "reviews" ? "profile-tab profile-tab-active" : "profile-tab"}
              aria-current={tab === "reviews" ? "page" : undefined}
              onClick={() => setTab("reviews")}
            >
              Reviews
            </button>
          </nav>
          {tab === "evidence" ? (
            <OverviewTab schoolId={school.id} />
          ) : tab === "changes" ? (
            <ChangesTab schoolId={school.id} />
          ) : tab === "ask" ? (
            <AskTab schoolId={school.id} />
          ) : (
            <ReviewsTab schoolId={school.id} />
          )}
        </div>

        <aside className="profile-aside">
          <section className="aside-panel">
            <h2>Official sources</h2>
            {school.official_website_url ? (
              <p>
                <a href={school.official_website_url} target="_blank" rel="noreferrer">
                  Official website
                </a>
              </p>
            ) : (
              <p>No official website on file.</p>
            )}
            {school.official_facebook_url ? (
              <p>
                <a href={school.official_facebook_url} target="_blank" rel="noreferrer">
                  Official Facebook
                </a>
              </p>
            ) : (
              <p>No official Facebook on file.</p>
            )}
          </section>
          <section className="aside-panel">
            <h2>Ask this school</h2>
            <p>Grounded answers only. No ranking.</p>
            <button type="button" className="aside-ask" onClick={() => setTab("ask")}>
              Ask a question
            </button>
          </section>
          <section className="aside-panel">
            <h2>School admin</h2>
            {ownStatus === "rejected" || ownStatus === null ? (
              <ClaimForm schoolId={school.id} signedIn={signedIn} />
            ) : ownStatus === "pending" ? (
              <p>Your claim is pending review.</p>
            ) : (
              <p>You administer this profile.</p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
