"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeConfidence, type ConfidenceLabel } from "@/lib/confidence";
import { isRegisterUnreachable, loadLocalSchools, withTimeout } from "@/lib/public-register";
import { loadClaimOverlay, localNetworkIds } from "@/lib/claim-overlay";
import { networkIds, pickBySchoolIds } from "@/lib/school-network";
import { moeBadgeLabel, moeRangeLabel, type MoeRecord } from "@/lib/moe-register";
import { DeferredSection } from "../../components/deferred-section";
import { AskTab } from "./ask-tab";
import { BranchesMap } from "./branches-map";
import { ChangesTab } from "./changes-tab";
import { ClaimForm } from "./claim-form";
import { ConfidenceChip } from "./confidence-chip";
import { OverviewTab } from "./overview-tab";
import { ReviewsTab } from "./reviews-tab";
import { ProfileHeaderSkeleton, Skeleton } from "../../components/ui/skeleton";

const PROFILE_NAV = [
  { id: "overview", label: "Overview" },
  { id: "directory-listing", label: "Directory listing" },
  { id: "verification-hub", label: "Evidence" },
  { id: "fees", label: "Fees" },
  { id: "educational-stages", label: "Curriculum" },
  { id: "cca", label: "CCA" },
  { id: "facilities", label: "Facilities" },
  { id: "changes", label: "What's changed" },
  { id: "reviews", label: "Reviews" },
  { id: "ask", label: "Ask" },
] as const;

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

function schoolMonogram(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3)
    .toUpperCase();
  return letters || name.slice(0, 3).toUpperCase();
}

export function SchoolProfile({ id }: { id: string }) {
  const [school, setSchool] = useState<School | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [ownStatus, setOwnStatus] = useState<string | null>(null);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [branches, setBranches] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [moeRecord, setMoeRecord] = useState<MoeRecord | null>(null);
  const [ledgerIds, setLedgerIds] = useState<string[]>([id]);

  function goToSection(id: string) {
    setActiveSection(id);
    const node = document.getElementById(id);
    if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const mapped = hash === "culture-safety" ? "overview" : hash;
    setActiveSection(mapped);
    const timer = window.setTimeout(() => {
      document.getElementById(mapped)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const schoolSelect =
      "id, name, address, school_group_id, official_website_url, official_facebook_url, curriculum_type, moe_approved_from, moe_approved_to, location, geocode_confidence";
    (async () => {
      const localAll = await loadLocalSchools();
      const local = localAll.find((row) => row.id === id) ?? null;
      const seededIds = localNetworkIds(id, localAll, local?.name);
      if (cancelled) return;
      setLedgerIds(seededIds);
      fetch("/moe-register/by-school.json")
        .then((response) => response.json())
        .then((payload) => {
          if (!cancelled) setMoeRecord(pickBySchoolIds(payload, seededIds) ?? payload[id] ?? null);
        })
        .catch(() => {
          if (!cancelled) setMoeRecord(null);
        });
      if (local) {
        setSchool(local);
        const localBranches = localAll.filter((row) => row.school_group_id && row.school_group_id === local.school_group_id);
        setBranches(localBranches.length ? localBranches : [local]);
        setLoading(false);
      }
      try {
        const { data, error: schoolError } = await withTimeout(
          supabase.from("schools").select(schoolSelect).eq("id", id).maybeSingle(),
        );
        if (cancelled) return;
        if (schoolError) throw new Error(schoolError.message);
        if (data) {
          setSchool(data);
          setLoading(false);
        } else if (!local) {
          setSchool(null);
          setLoading(false);
          return;
        }

        const schoolRow = data ?? local;
        if (!schoolRow) return;

        const [sessionRes, networkRes] = await Promise.all([
          supabase.auth.getSession(),
          schoolRow.school_group_id
            ? supabase.from("schools").select(schoolSelect).eq("school_group_id", schoolRow.school_group_id).order("name")
            : Promise.resolve({ data: [schoolRow] }),
        ]);
        if (cancelled) return;
        const ids = localNetworkIds(schoolRow.id, [...localAll, ...((networkRes.data ?? []) as typeof localAll)], schoolRow.name);
        const liveIds = networkIds(schoolRow.id, networkRes.data ?? [schoolRow]);
        const mergedIds = [...new Set([...ids, ...liveIds])];
        setLedgerIds(mergedIds);
        setBranches(networkRes.data?.length ? networkRes.data : localAll.filter((row) => mergedIds.includes(row.id)));
        fetch("/moe-register/by-school.json")
          .then((response) => response.json())
          .then((payload) => {
            if (!cancelled) setMoeRecord(pickBySchoolIds(payload, mergedIds));
          })
          .catch(() => {});
        const groupsRes = await supabase.from("claim_groups").select("confidence_label").in("school_id", mergedIds);
        if (cancelled) return;
        let labels = groupsRes.data ?? [];
        if (!labels.length) {
          const overlay = await loadClaimOverlay(mergedIds);
          labels = overlay.map((group) => ({ confidence_label: group.confidence_label }));
        }
        const next = { ...EMPTY_COUNTS };
        for (const group of labels) {
          next[normalizeConfidence(group.confidence_label)] += 1;
        }
        setCounts(next);
        const user = sessionRes.data.session?.user;
        setSignedIn(Boolean(user));
        if (!user) return;
        const { data: own } = await supabase
          .from("school_claim_requests")
          .select("status")
          .eq("school_id", id)
          .eq("requested_by", user.id)
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled) setOwnStatus(own?.status ?? null);
      } catch (caught) {
        if (cancelled) return;
        const overlay = await loadClaimOverlay(seededIds);
        if (overlay.length) {
          const next = { ...EMPTY_COUNTS };
          for (const group of overlay) {
            next[normalizeConfidence(group.confidence_label)] += 1;
          }
          setCounts(next);
        }
        if (!local) {
          setError(isRegisterUnreachable(caught) ? null : caught instanceof Error ? caught.message : "Failed to fetch");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="profile-page">
        <div className="profile-hero-inner">
          <ProfileHeaderSkeleton />
        </div>
      </main>
    );
  }

  if (!school) {
    return (
      <main className="profile-page">
        <div className="profile-hero-inner">
          <div className="empty-state-card">
            <h2>School not found</h2>
            <p>{error || "This school does not exist in the public register."}</p>
            <Link href="/schools" className="btn btn-secondary">
              Return to directory
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const fallbackRange = [school.moe_approved_from, school.moe_approved_to].filter(Boolean).join(" – ");
  const moeRange = moeRangeLabel(moeRecord, fallbackRange);
  const moeBadge = moeBadgeLabel(moeRecord, fallbackRange);
  const totalGroups = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const supportedShare =
    totalGroups > 0 ? Math.round((counts.supported / totalGroups) * 100) : null;

  return (
    <main className="profile-page">
      <section className="profile-band">
        <div className="profile-band-inner">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/schools" className="breadcrumb-link">
              Directory
            </Link>
            <span className="breadcrumb-separator" aria-hidden="true">
              /
            </span>
            <span className="breadcrumb-current">{school.name}</span>
          </nav>
          <div className="profile-ticker">
            <span className="profile-ticker-dot" aria-hidden="true" />
            <span className="profile-ticker-text">Public records · not a ranking</span>
          </div>
        </div>
      </section>

      <header className="profile-hero">
        <div className="profile-hero-inner">
          <div className="profile-hero-main">
            <div className="profile-crest" aria-hidden="true">
              <svg className="profile-crest-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3 2 8l10 5 8-4.1V17h2V8L12 3zm-7 9.2V14c0 2.5 3.1 4.5 7 4.5s7-2 7-4.5v-1.8l-7 3.5-7-3.5z" />
              </svg>
              <span className="profile-crest-letters">{schoolMonogram(school.name)}</span>
            </div>
            <div className="profile-hero-copy">
              <div className="profile-badges-row">
                {moeBadge ? <span className="badge-moe-verified">{moeBadge}</span> : null}
                {school.curriculum_type ? (
                  <span className="meta-badge meta-badge-curriculum">{school.curriculum_type}</span>
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
                  <Link href={`/schools/network/${school.school_group_id}`} className="network-action-link">
                    Network map ({branches.length} campuses)
                  </Link>
                </p>
              ) : null}
              {ownStatus === "pending" ? (
                <div className="admin-status-banner admin-status-pending">
                  Your claim is waiting for moderator review.
                </div>
              ) : null}
              {ownStatus === "approved" ? (
                <div className="admin-status-banner admin-status-approved">You administer this school.</div>
              ) : null}
            </div>
          </div>

          <div className="profile-hero-actions">
            <div className="profile-action-row">
              <a href="#ask" className="btn btn-primary" onClick={() => setActiveSection("ask")}>
                Ask a question
              </a>
            </div>
            <div className="profile-confidence-panel" aria-label="Evidence confidence">
              <div className="confidence-panel-icon">
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M10 1.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM9 6a1 1 0 112 0v4a1 1 0 11-2 0V6zm1 8a1.25 1.25 0 100-2.5A1.25 1.25 0 0010 14z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="confidence-panel-copy">
                <span className="confidence-panel-label">
                  {supportedShare != null ? `${supportedShare}% supported` : "No claim groups yet"}
                </span>
                <span className="confidence-panel-meta">
                  {totalGroups} claim group{totalGroups === 1 ? "" : "s"} from public sources
                </span>
                <div className="confidence-summary-chips">
                  {totalGroups === 0 ? (
                    <ConfidenceChip label="unknown" size="sm" />
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
          </div>
        </div>
      </header>

      <div className="profile-tabs-wrap">
        <div className="profile-tabs-inner">
          <nav className="profile-tabs-nav" aria-label="School profile sections">
            {PROFILE_NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`profile-tab-btn ${activeSection === item.id ? "profile-tab-active" : ""}`}
                aria-current={activeSection === item.id ? "location" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  goToSection(item.id);
                }}
              >
                {item.label}
                {item.id === "overview" && totalGroups > 0 ? <span className="tab-badge">{totalGroups}</span> : null}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className="profile-body">
        <div className="profile-layout">
          <div className="profile-main">
            <OverviewTab
              schoolId={school.id}
              networkIds={ledgerIds}
              schoolName={school.name}
              schoolAddress={school.address}
              moeRange={moeRange}
              moeRecord={moeRecord}
              supportedShare={supportedShare}
              totalGroups={totalGroups}
            />
            <section className="profile-section" id="changes">
              <DeferredSection
                force={activeSection === "changes"}
                placeholder={<Skeleton style={{ width: "100%", height: "96px", borderRadius: "8px" }} />}
              >
                <ChangesTab schoolId={school.id} networkIds={ledgerIds} />
              </DeferredSection>
            </section>
            <section className="profile-section" id="reviews">
              <DeferredSection
                force={activeSection === "reviews"}
                placeholder={<Skeleton style={{ width: "100%", height: "96px", borderRadius: "8px" }} />}
              >
                <ReviewsTab schoolId={school.id} networkIds={ledgerIds} />
              </DeferredSection>
            </section>
            <section className="profile-section" id="ask">
              <DeferredSection
                force={activeSection === "ask"}
                placeholder={<Skeleton style={{ width: "100%", height: "96px", borderRadius: "8px" }} />}
              >
                <AskTab schoolId={school.id} networkIds={ledgerIds} />
              </DeferredSection>
            </section>
          </div>

          <aside className="profile-aside">
            <section className="aside-card">
              <div className="aside-card-kicker">Factsheet</div>
              <h3 className="aside-card-title">Institutional summary</h3>
              <dl className="aside-fact-list">
                {school.curriculum_type ? (
                  <div>
                    <dt className="aside-fact-label">Curriculum</dt>
                    <dd className="aside-fact-value">{school.curriculum_type}</dd>
                  </div>
                ) : null}
                {moeRange ? (
                  <div>
                    <dt className="aside-fact-label">MOE approval</dt>
                    <dd className="aside-fact-value">{moeRange}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="aside-fact-label">Campuses</dt>
                  <dd className="aside-fact-value">{branches.length || 1}</dd>
                </div>
                <div>
                  <dt className="aside-fact-label">Claim groups</dt>
                  <dd className="aside-fact-value">{totalGroups}</dd>
                </div>
              </dl>
            </section>

            <section className="aside-card aside-card-cta">
              <h3 className="aside-card-title">Ask about this school</h3>
              <p className="aside-card-desc">
                Questions about fees, class size, or facilities. Answers use retrieved evidence only.
              </p>
              <a href="#ask" className="btn btn-primary btn-full" onClick={() => setActiveSection("ask")}>
                Ask a question
              </a>
            </section>

            <section className="aside-card">
              <h3 className="aside-card-title">Official sources</h3>
              <ul className="aside-links-list">
                {school.official_website_url ? (
                  <li>
                    <a href={school.official_website_url} target="_blank" rel="noreferrer" className="aside-link">
                      <span>Website</span>
                      <span className="aside-ext-arrow">↗</span>
                    </a>
                  </li>
                ) : (
                  <li className="aside-empty-item">No website on file</li>
                )}
                {school.official_facebook_url ? (
                  <li>
                    <a href={school.official_facebook_url} target="_blank" rel="noreferrer" className="aside-link">
                      <span>Facebook</span>
                      <span className="aside-ext-arrow">↗</span>
                    </a>
                  </li>
                ) : (
                  <li className="aside-empty-item">No Facebook page on file</li>
                )}
              </ul>
            </section>

            {branches.length ? (
              <section className="aside-card aside-map-card">
                <h3 className="aside-card-title">Campus location</h3>
                <BranchesMap branches={branches} activeId={school.id} compact />
              </section>
            ) : null}

            <section className="aside-card">
              <h3 className="aside-card-title">School administrator</h3>
              {ownStatus === "rejected" || ownStatus === null ? (
                <ClaimForm schoolId={school.id} signedIn={signedIn} />
              ) : ownStatus === "pending" ? (
                <p className="aside-status-msg">Waiting for moderator review.</p>
              ) : (
                <p className="aside-status-msg aside-status-active">You administer this school.</p>
              )}
            </section>

            <section className="aside-card aside-promo">
              <div className="aside-card-kicker">Priorities</div>
              <h3 className="aside-card-title">Record what matters</h3>
              <p className="aside-card-desc">
                Set budget, township, and needs. SchoolLens uses this to organize evidence, not to rank schools.
              </p>
              <Link href="/questionnaire" className="btn btn-full">
                Set your priorities
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
