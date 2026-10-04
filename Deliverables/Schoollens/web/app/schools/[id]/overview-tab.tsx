"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { withTimeout, isRegisterUnreachable } from "@/lib/public-register";
import {
  CATEGORY_SECTIONS,
  categoryId,
  categoryTitle,
  freshnessLabel,
  normalizeConfidence,
  sourceTag,
} from "@/lib/confidence";
import { headlineConfidence } from "@/lib/row-confidence";
import { ConfidenceChip } from "./confidence-chip";
import { MediaGallery, type MediaItem } from "./media-gallery";
import { Skeleton } from "../../components/ui/skeleton";

type Source = {
  tag: string;
  excerpt: string;
  groupId: string;
  conflicting: boolean;
};

type Section = {
  key: string;
  summary: string;
  confidence: string;
  updated: string | null;
  sources: Source[];
};

type StoredSummary = {
  summary_text: string | null;
  key_stats: { label?: string; value?: string }[] | null;
  things_to_verify: {
    claim_group_id?: string;
    category?: string | null;
    confidence_label?: string | null;
    reconciliation_note?: string | null;
  }[] | null;
};

type FeePoster = {
  file: string;
  label?: string;
  claims: string[];
};

function fallbackSummary(texts: string[]) {
  const unique = [...new Set(texts.map((text) => text.trim()).filter(Boolean))];
  if (!unique.length) return "";
  return unique.slice(0, 3).join(" ");
}

export function OverviewTab({
  schoolId,
  schoolName,
  moeRange,
  supportedShare,
  totalGroups,
}: {
  schoolId: string;
  schoolName: string;
  moeRange: string;
  supportedShare: number | null;
  totalGroups: number;
}) {
  const [sections, setSections] = useState<Section[]>([]);
  const [stored, setStored] = useState<StoredSummary | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [feePosters, setFeePosters] = useState<FeePoster[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const extras = new AbortController();

    function loadExtras(hasStored: boolean) {
      if (!hasStored) {
        fetch(`/api/schools/${schoolId}/summarize`, { signal: extras.signal })
          .then((response) => response.json())
          .then((payload) => {
            if (cancelled) return;
            if (payload?.summary_text || (payload?.things_to_verify || []).length) {
              setStored(payload);
            }
          })
          .catch(() => {});
      }
      fetch(`/api/schools/${schoolId}/media`, { signal: extras.signal })
        .then((response) => response.json())
        .then((payload) => {
          if (!cancelled) setMedia(payload.items ?? []);
        })
        .catch(() => {
          if (!cancelled) setMedia([]);
        });
      fetch("/school-fees/by-school.json", { signal: extras.signal })
        .then((response) => response.json())
        .then((payload) => {
          if (!cancelled) setFeePosters(payload[schoolId]?.posters ?? []);
        })
        .catch(() => {
          if (!cancelled) setFeePosters([]);
        });
    }

    (async () => {
      loadExtras(false);
      setLoading(false);
      try {
      const [groupsRes, storedRes] = await Promise.all([
        withTimeout(
          supabase.from("claim_groups").select("id, category, confidence_label, last_updated").eq("school_id", schoolId),
        ),
        withTimeout(
          supabase
            .from("school_summaries")
            .select("summary_text, key_stats, things_to_verify")
            .eq("school_id", schoolId)
            .maybeSingle(),
        ),
      ]);
      if (cancelled) return;
      if (storedRes.data) setStored(storedRes.data);
      if (groupsRes.error) {
        if (!isRegisterUnreachable(groupsRes.error)) {
          setError(groupsRes.error.message);
        }
        setSections([]);
        setLoading(false);
        loadExtras(Boolean(storedRes.data));
        return;
      }

      const groups = groupsRes.data ?? [];
      if (!groups.length) {
        setSections([]);
        setLoading(false);
        loadExtras(Boolean(storedRes.data));
        return;
      }

      const groupIds = groups.map((group) => group.id);
      const { data: members } = await supabase
        .from("claim_group_members")
        .select("claim_group_id, claim_id")
        .in("claim_group_id", groupIds);
      if (cancelled) return;
      const claimIds = [...new Set((members ?? []).map((member) => member.claim_id))];
      const [claimsRes, evidenceRes] = await Promise.all([
        claimIds.length
          ? supabase.from("claims").select("id, claim_text, category, source_type, source_trust_tier").in("id", claimIds)
          : Promise.resolve({ data: [] as { id: string; claim_text: string | null; category: string | null; source_type: string | null; source_trust_tier: string | null }[] }),
        claimIds.length
          ? supabase.from("evidence").select("claim_id, source_excerpt").in("claim_id", claimIds)
          : Promise.resolve({ data: [] as { claim_id: string; source_excerpt: string | null }[] }),
      ]);
      if (cancelled) return;

      const claimById = Object.fromEntries((claimsRes.data ?? []).map((claim) => [claim.id, claim]));
      const excerptByClaim = new Map<string, string>();
      for (const row of evidenceRes.data ?? []) {
        if (row.source_excerpt && !excerptByClaim.has(row.claim_id)) {
          excerptByClaim.set(row.claim_id, row.source_excerpt);
        }
      }

      const byCategory = new Map<string, { texts: string[]; labels: string[]; updated: string | null; sources: Source[] }>();
      for (const group of groups) {
        const key = String(group.category || "other").toLowerCase();
        const bucket = byCategory.get(key) ?? { texts: [], labels: [], updated: null, sources: [] };
        bucket.labels.push(group.confidence_label ?? "unknown");
        if (!bucket.updated || (group.last_updated && group.last_updated > bucket.updated)) {
          bucket.updated = group.last_updated;
        }
        for (const member of members ?? []) {
          if (member.claim_group_id !== group.id) continue;
          const claim = claimById[member.claim_id];
          if (claim?.claim_text) bucket.texts.push(claim.claim_text);
          const excerpt = excerptByClaim.get(member.claim_id);
          if (excerpt) {
            bucket.sources.push({
              tag: sourceTag(claim?.source_type, claim?.source_trust_tier),
              excerpt,
              groupId: group.id,
              conflicting: normalizeConfidence(group.confidence_label) === "conflicting",
            });
          }
        }
        byCategory.set(key, bucket);
      }

      const ordered = [
        ...CATEGORY_SECTIONS.map((section) => section.key),
        ...[...byCategory.keys()].filter((key) => !CATEGORY_SECTIONS.some((section) => section.key === key)),
      ].filter((key) => byCategory.has(key));

      setSections(
        ordered.map((key) => {
          const bucket = byCategory.get(key)!;
          const uniqueSources = bucket.sources.filter(
            (item, index, list) => list.findIndex((other) => other.excerpt === item.excerpt) === index,
          );
          return {
            key,
            summary: fallbackSummary(bucket.texts),
            confidence: headlineConfidence(bucket.labels),
            updated: bucket.updated,
            sources: uniqueSources.slice(0, 8),
          };
        }),
      );
      setLoading(false);
      loadExtras(Boolean(storedRes.data));
      } catch {
        if (cancelled) return;
        setSections([]);
        setLoading(false);
        loadExtras(false);
      }
    })();

    return () => {
      cancelled = true;
      extras.abort();
    };
  }, [schoolId]);

  if (loading) {
    return (
      <div className="overview-tab-content" aria-hidden="true">
        <section className="profile-section" id="overview">
          <Skeleton style={{ width: "40%", height: "28px", marginBottom: "16px", borderRadius: "8px" }} />
          <Skeleton style={{ width: "100%", height: "80px", borderRadius: "8px" }} />
        </section>
        <section className="profile-section" id="verification-hub">
          <Skeleton style={{ width: "50%", height: "28px", marginBottom: "16px", borderRadius: "8px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Skeleton style={{ height: "72px", borderRadius: "8px" }} />
            <Skeleton style={{ height: "72px", borderRadius: "8px" }} />
          </div>
        </section>
        <section className="profile-section" id="educational-stages">
          <Skeleton style={{ width: "45%", height: "28px", borderRadius: "8px" }} />
        </section>
        <section className="profile-section" id="facilities">
          <Skeleton style={{ width: "45%", height: "28px", borderRadius: "8px" }} />
        </section>
      </div>
    );
  }
  if (error) return <div className="error-banner">{error}</div>;

  const stats = (stored?.key_stats ?? []).filter((item) => item.label && item.value);
  const verify = stored?.things_to_verify ?? [];
  const curriculum = sections.find((section) => section.key === "curriculum");
  const facilities = sections.find((section) => section.key === "facilities");
  const languages = sections.find((section) => /language|diploma/.test(section.key));
  const rest = sections.filter(
    (section) =>
      section.key !== "curriculum" &&
      section.key !== "facilities" &&
      section !== languages &&
      !(feePosters.length && section.key === "fees"),
  );
  const summaryParagraphs = (stored?.summary_text || "")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <div className="overview-tab-content">
      <section className="profile-section" id="overview">
        <div className="profile-section-head">
          <h2 className="profile-section-title">Institutional profile</h2>
          {curriculum?.updated && freshnessLabel(curriculum.updated) ? (
            <span className="profile-section-meta">{freshnessLabel(curriculum.updated)}</span>
          ) : null}
        </div>
        {summaryParagraphs.length ? (
          summaryParagraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="executive-summary-text">
              {paragraph}
            </p>
          ))
        ) : (
          <p className="executive-summary-text">
            <strong className="profile-school-name">{schoolName}</strong> is listed in the public register.
            No reconciled institutional summary is on file yet.
          </p>
        )}
        {stats.length ? (
          <div className="stats-metric-grid">
            {stats.map((item) => (
              <div key={`${item.label}-${item.value}`} className="stat-metric-card">
                <span className="metric-label">{item.label}</span>
                <strong className="metric-value">{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="profile-section profile-section-trust" id="verification-hub">
        <div className="profile-section-head">
          <div>
            <span className="profile-section-kicker">Public records</span>
            <h2 className="profile-section-title">Data source and trust</h2>
          </div>
          {supportedShare != null ? (
            <span className="trust-overall-badge">{supportedShare}% supported</span>
          ) : (
            <span className="trust-overall-badge trust-overall-muted">No claim groups yet</span>
          )}
        </div>
        <p className="profile-section-lead">
          Confidence comes from claim groups on file. SchoolLens does not rank this campus.
        </p>
        <div className="trust-score-grid">
          <div className="trust-score-item">
            <div className="trust-score-copy">
              <h3>Ministry of Education</h3>
              <p>{moeRange ? "Registered dates on file" : "No MOE dates on file"}</p>
            </div>
            <span className="trust-score-value">{moeRange || "Not listed"}</span>
          </div>
          <div className="trust-score-item">
            <div className="trust-score-copy">
              <h3>Claim groups</h3>
              <p>Reconciled records from public sources</p>
            </div>
            <span className="trust-score-value">{totalGroups}</span>
          </div>
          {sections.map((section) => (
            <div key={section.key} className="trust-score-item">
              <div className="trust-score-copy">
                <h3>{categoryTitle(section.key)}</h3>
                <p>{freshnessLabel(section.updated) || "From public sources"}</p>
              </div>
              <ConfidenceChip label={section.confidence} size="sm" />
            </div>
          ))}
        </div>
        {verify.length ? (
          <div className="verify-items-list">
            {verify.map((item, index) => (
              <div key={item.claim_group_id || `${item.category}-${index}`} className="verify-item-card">
                <div className="verify-item-top">
                  <span className="verify-category-tag">{categoryTitle(item.category)}</span>
                  <ConfidenceChip label={normalizeConfidence(item.confidence_label)} size="sm" />
                </div>
                <p className="verify-note">{item.reconciliation_note || "Sources disagree."}</p>
                {item.confidence_label === "conflicting" && item.claim_group_id ? (
                  <Link href={`/schools/${schoolId}/conflict/${item.claim_group_id}`} className="verify-inspect-link">
                    Compare sources
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {feePosters.length ? (
        <section className="profile-section" id="fees">
          <div className="profile-section-head">
            <div>
              <span className="profile-section-kicker">Posted announcement</span>
              <h2 className="profile-section-title">Fees</h2>
            </div>
            <ConfidenceChip label="likely" size="sm" />
          </div>
          <p className="profile-section-lead">
            Read from a school fee poster. This is one source, so the label is likely until another independent record agrees.
          </p>
          {feePosters.map((poster) => (
            <article key={poster.file} className="fee-poster-block">
              <h3 className="fee-poster-title">{poster.label || "Fee announcement"}</h3>
              <ul className="fee-poster-claims">
                {poster.claims.map((claim) => (
                  <li key={claim}>{claim}</li>
                ))}
              </ul>
              <a className="fee-poster-link" href={`/school-fees/${encodeURIComponent(poster.file)}`} target="_blank" rel="noreferrer">
                View the posted announcement
              </a>
            </article>
          ))}
        </section>
      ) : null}

      <section className="profile-section" id="educational-stages">
        <div className="profile-section-head">
          <h2 className="profile-section-title">Educational stages</h2>
          {curriculum ? <ConfidenceChip label={curriculum.confidence} size="sm" /> : null}
        </div>
        {curriculum ? (
          <CategoryEvidence
            schoolId={schoolId}
            section={curriculum}
            openKey={openKey}
            setOpenKey={setOpenKey}
          />
        ) : (
          <p className="profile-empty-copy">No curriculum evidence on file yet.</p>
        )}
      </section>

      {languages ? (
        <section className="profile-section" id="languages-programs">
          <div className="profile-section-head">
            <h2 className="profile-section-title">Languages and programmes</h2>
            <ConfidenceChip label={languages.confidence} size="sm" />
          </div>
          <CategoryEvidence
            schoolId={schoolId}
            section={languages}
            openKey={openKey}
            setOpenKey={setOpenKey}
          />
        </section>
      ) : null}

      <section className="profile-section" id="facilities">
        <div className="profile-section-head">
          <h2 className="profile-section-title">Campus and facilities</h2>
          {facilities ? <ConfidenceChip label={facilities.confidence} size="sm" /> : null}
        </div>
        {facilities ? (
          <CategoryEvidence
            schoolId={schoolId}
            section={facilities}
            openKey={openKey}
            setOpenKey={setOpenKey}
          />
        ) : (
          <p className="profile-empty-copy">No facilities evidence on file yet.</p>
        )}
        <MediaGallery items={media} />
      </section>

      {rest.map((section) => (
        <section key={section.key} className="profile-section" id={categoryId(section.key)}>
          <div className="profile-section-head">
            <div>
              <h2 className="profile-section-title">{categoryTitle(section.key)}</h2>
              {freshnessLabel(section.updated) ? (
                <span className="profile-section-meta">{freshnessLabel(section.updated)}</span>
              ) : null}
            </div>
            <ConfidenceChip label={section.confidence} size="sm" />
          </div>
          <CategoryEvidence
            schoolId={schoolId}
            section={section}
            openKey={openKey}
            setOpenKey={setOpenKey}
          />
        </section>
      ))}
    </div>
  );
}

function CategoryEvidence({
  schoolId,
  section,
  openKey,
  setOpenKey,
}: {
  schoolId: string;
  section: Section;
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
}) {
  return (
    <>
      <p className="section-summary-text">{section.summary}</p>
      <div className="section-sources-toggle">
        <button
          type="button"
          className="btn-sources-toggle"
          aria-expanded={openKey === section.key}
          onClick={() => setOpenKey(openKey === section.key ? null : section.key)}
        >
          <svg className={`toggle-chevron ${openKey === section.key ? "toggle-chevron-open" : ""}`} viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" clipRule="evenodd" />
          </svg>
          <span>{openKey === section.key ? "Hide source documentation" : `Inspect sources (${section.sources.length})`}</span>
        </button>
      </div>
      {openKey === section.key ? (
        <div className="source-drawer">
          {section.sources.length === 0 ? (
            <p className="source-empty-msg">No direct source excerpts attached to this section.</p>
          ) : (
            <ul className="source-items-list">
              {section.sources.map((source, index) => (
                <li key={`${source.groupId}-${index}`} className="source-item-row">
                  <div className="source-row-top">
                    <span className="source-badge">{source.tag}</span>
                    {source.conflicting ? (
                      <Link href={`/schools/${schoolId}/conflict/${source.groupId}`} className="conflict-badge-link">
                        Disputed in records
                      </Link>
                    ) : null}
                  </div>
                  <blockquote className="source-blockquote">“{source.excerpt}”</blockquote>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </>
  );
}
