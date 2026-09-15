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
import { ProfileHeaderSkeleton } from "../../components/ui/skeleton";

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
        <ProfileHeaderSkeleton />
      </main>
    );
  }

  if (!school) {
    return (
      <main className="profile-page">
        <div className="empty-state-card">
          <h2>School not found</h2>
          <p>{error || "This school does not exist in the public register."}</p>
          <Link href="/schools" className="btn btn-secondary">
            ← Return to directory
          </Link>
        </div>
      </main>
    );
  }

  const moeRange = [school.moe_approved_from, school.moe_approved_to].filter(Boolean).join(" – ");
  const totalGroups = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <main className="profile-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/schools" className="breadcrumb-link">
          <svg className="breadcrumb-icon" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M9.78 12.78a.75.75 0 01-1.06 0L4.47 8.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L6.06 8l3.72 3.72a.75.75 0 010 1.06z" clipRule="evenodd" />
          </svg>
          <span>Schools</span>
        </Link>
        <span className="breadcrumb-separator" aria-hidden="true">/</span>
        <span className="breadcrumb-current">{school.name}</span>
      </nav>

      <header className="profile-hero-card">
        <div className="profile-hero-top">
          <div className="profile-hero-info">
            <div className="profile-badges-row">
              {moeRange ? (
                <span className="badge-moe-verified" title="Registered with Myanmar Ministry of Education">
                  <svg className="badge-moe-icon" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M8 0c-.69 0-1.843.265-2.928.56-1.11.3-2.229.655-2.887.87a1.54 1.54 0 0 0-1.044 1.262c-.596 4.477.787 7.795 2.464 9.99a11.777 11.777 0 0 0 3.843 3.097c.18.093.364.18.552.221.188-.04.372-.128.552-.22a11.778 11.778 0 0 0 3.843-3.098c1.677-2.195 3.06-5.513 2.464-9.99a1.54 1.54 0 0 0-1.044-1.263 62.467 62.467 0 0 0-2.887-.87C9.843.266 8.69 0 8 0zm2.146 5.854a.5.5 0 0 0-.708-.708L7 7.293 5.56 5.854a.5.5 0 1 0-.708.708l1.793 1.793a.5.5 0 0 0 .708 0l2.793-2.793z" clipRule="evenodd" />
                  </svg>
                  MOE Registered
                </span>
              ) : null}
              {school.curriculum_type ? (
                <span className="meta-badge meta-badge-curriculum">
                  {school.curriculum_type}
                </span>
              ) : null}
            </div>

            <h1 className="profile-hero-title">{school.name}</h1>

            {school.address ? (
              <p className="profile-address">
                <svg className="address-icon" viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="evenodd" d="M8 1a5 5 0 00-5 5c0 3.5 5 9 5 9s5-5.5 5-9a5 5 0 00-5-5zm0 7a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <span>{school.address}</span>
              </p>
            ) : null}

            {school.school_group_id ? (
              <p className="profile-network-notice">
                <span>Multi-branch network: </span>
                <Link href={`/schools/network/${school.school_group_id}`} className="network-action-link">
                  View network map ({branches.length} campuses)
                </Link>
              </p>
            ) : null}

            {ownStatus === "pending" ? (
              <div className="admin-status-banner admin-status-pending">
                Your claim is waiting for moderator review.
              </div>
            ) : null}
            {ownStatus === "approved" ? (
              <div className="admin-status-banner admin-status-approved">
                You administer this school.
              </div>
            ) : null}
          </div>

          <div className="profile-confidence-panel" aria-label="Evidence confidence breakdown">
            <span className="confidence-panel-label">Evidence</span>
            <div className="confidence-summary-chips">
              {totalGroups === 0 ? (
                <ConfidenceChip label="unknown" />
              ) : (
                (["supported", "likely", "conflicting", "outdated", "unknown"] as ConfidenceLabel[])
                  .filter((label) => counts[label] > 0)
                  .map((label) => (
                    <div key={label} className="confidence-summary-item">
                      <ConfidenceChip label={label} size="sm" />
                      <span className="confidence-summary-count">{counts[label]}</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        <div className="profile-stat-bar">
          {school.curriculum_type ? (
            <div className="stat-pill">
              <span className="stat-pill-label">Curriculum</span>
              <strong className="stat-pill-value">{school.curriculum_type}</strong>
            </div>
          ) : null}
          {moeRange ? (
            <div className="stat-pill">
              <span className="stat-pill-label">MOE Approval</span>
              <strong className="stat-pill-value">{moeRange}</strong>
            </div>
          ) : null}
          <div className="stat-pill">
            <span className="stat-pill-label">Campuses</span>
            <strong className="stat-pill-value">{branches.length || 1}</strong>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-label">Claim groups</span>
            <strong className="stat-pill-value">{totalGroups}</strong>
          </div>
        </div>
      </header>

      {branches.length > 1 ? (
        <section className="branches-section">
          <BranchesMap branches={branches} activeId={school.id} />
        </section>
      ) : null}

      <div className="profile-layout">
        <div className="profile-main">
          <nav className="profile-tabs-nav" aria-label="School profile sections">
            <button
              type="button"
              className={`profile-tab-btn ${tab === "evidence" ? "profile-tab-active" : ""}`}
              aria-current={tab === "evidence" ? "page" : undefined}
              onClick={() => setTab("evidence")}
            >
              <svg className="tab-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z" />
                <path d="M4 4h8v2H4V4zm0 3h8v1H4V7zm0 2h5v1H4V9z" />
              </svg>
              <span>Evidence Ledger</span>
              {totalGroups > 0 ? <span className="tab-badge">{totalGroups}</span> : null}
            </button>
            <button
              type="button"
              className={`profile-tab-btn ${tab === "changes" ? "profile-tab-active" : ""}`}
              aria-current={tab === "changes" ? "page" : undefined}
              onClick={() => setTab("changes")}
            >
              <svg className="tab-icon" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
                <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
              </svg>
              <span>What's Changed</span>
            </button>
            <button
              type="button"
              className={`profile-tab-btn ${tab === "ask" ? "profile-tab-active" : ""}`}
              aria-current={tab === "ask" ? "page" : undefined}
              onClick={() => setTab("ask")}
            >
              <svg className="tab-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2.678 11.894a1 1 0 0 1 .287.804 10.766 10.766 0 0 1-.825 2.408c.45-.19.9-.408 1.347-.645a1 1 0 0 1 .843-.075c1.134.453 2.378.714 3.67.714 4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6a1 1 0 0 1 .708.194z" />
              </svg>
              <span>Ask a question</span>
            </button>
            <button
              type="button"
              className={`profile-tab-btn ${tab === "reviews" ? "profile-tab-active" : ""}`}
              aria-current={tab === "reviews" ? "page" : undefined}
              onClick={() => setTab("reviews")}
            >
              <svg className="tab-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216z" />
              </svg>
              <span>Reviews</span>
            </button>
          </nav>

          <div className="tab-content-area">
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
        </div>

        <aside className="profile-aside">
          <section className="aside-card">
            <h3 className="aside-card-title">Official Sources</h3>
            <ul className="aside-links-list">
              {school.official_website_url ? (
                <li>
                  <a href={school.official_website_url} target="_blank" rel="noreferrer" className="aside-link">
                    <svg className="aside-link-icon" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.67A6.958 6.958 0 0 0 1 7.5c0 .354.026.7.077 1.037h2.155c-.015-.178-.024-.356-.024-.537zm.312 3.5c-.174-.782-.282-1.623-.312-2.5H1.67A7.001 7.001 0 0 0 7.5 14.923V12H5.145a7.97 7.97 0 0 1-.482-1zm4.68 0H12v2.923A7.001 7.001 0 0 0 14.33 8.5H12.18c-.03.877-.138 1.718-.312 2.5zm0-3.5H12V5H9.518a7.97 7.97 0 0 1 .482 1zm-.008-3.5V1.077c.67.204 1.335.82 1.887 1.855.224.42.418.887.575 1.391H9.51z" />
                    </svg>
                    <span>Official Website</span>
                    <span className="aside-ext-arrow">↗</span>
                  </a>
                </li>
              ) : (
                <li className="aside-empty-item">No website on file</li>
              )}
              {school.official_facebook_url ? (
                <li>
                  <a href={school.official_facebook_url} target="_blank" rel="noreferrer" className="aside-link">
                    <svg className="aside-link-icon" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951z" />
                    </svg>
                    <span>Official Facebook Page</span>
                    <span className="aside-ext-arrow">↗</span>
                  </a>
                </li>
              ) : (
                <li className="aside-empty-item">No Facebook page on file</li>
              )}
            </ul>
          </section>

          <section className="aside-card aside-card-cta">
            <h3 className="aside-card-title">Ask about this school</h3>
            <p className="aside-card-desc">Questions about fees, class size, or facilities. Answers use retrieved evidence only.</p>
            <button type="button" className="btn btn-primary btn-full" onClick={() => setTab("ask")}>
              Ask a question
            </button>
          </section>

          <section className="aside-card">
            <h3 className="aside-card-title">School Administrator</h3>
            {ownStatus === "rejected" || ownStatus === null ? (
              <ClaimForm schoolId={school.id} signedIn={signedIn} />
            ) : ownStatus === "pending" ? (
              <p className="aside-status-msg">Waiting for moderator review.</p>
            ) : (
              <p className="aside-status-msg aside-status-active">You administer this school.</p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
