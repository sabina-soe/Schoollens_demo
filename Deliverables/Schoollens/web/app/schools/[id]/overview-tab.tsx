"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

function fallbackSummary(texts: string[]) {
  const unique = [...new Set(texts.map((text) => text.trim()).filter(Boolean))];
  if (!unique.length) return "";
  return unique.slice(0, 3).join(" ");
}

export function OverviewTab({ schoolId }: { schoolId: string }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [stored, setStored] = useState<StoredSummary | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: groups, error: groupError } = await supabase
        .from("claim_groups")
        .select("id, category, confidence_label, last_updated")
        .eq("school_id", schoolId);
      if (groupError) {
        setError(groupError.message);
        setLoading(false);
        return;
      }
      if (!groups?.length) {
        setSections([]);
        setLoading(false);
        return;
      }

      const groupIds = groups.map((group) => group.id);
      const { data: members } = await supabase
        .from("claim_group_members")
        .select("claim_group_id, claim_id")
        .in("claim_group_id", groupIds);
      const claimIds = [...new Set((members ?? []).map((member) => member.claim_id))];
      const { data: claims } = claimIds.length
        ? await supabase.from("claims").select("id, claim_text, category, source_type, source_trust_tier").in("id", claimIds)
        : { data: [] };
      const { data: evidence } = claimIds.length
        ? await supabase.from("evidence").select("claim_id, source_excerpt").in("claim_id", claimIds)
        : { data: [] };

      const claimById = Object.fromEntries((claims ?? []).map((claim) => [claim.id, claim]));
      const excerptByClaim = new Map<string, string>();
      for (const row of evidence ?? []) {
        if (row.source_excerpt && !excerptByClaim.has(row.claim_id)) {
          excerptByClaim.set(row.claim_id, row.source_excerpt);
        }
      }

      const { data: storedRow } = await supabase
        .from("school_summaries")
        .select("summary_text, key_stats, things_to_verify")
        .eq("school_id", schoolId)
        .maybeSingle();
      if (storedRow) {
        setStored(storedRow);
      } else {
        try {
          const response = await fetch(`/api/schools/${schoolId}/summarize`);
          const payload = await response.json();
          if (payload?.summary_text || (payload?.things_to_verify || []).length) {
            setStored(payload);
          }
        } catch {
          setStored(null);
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

      try {
        const response = await fetch(`/api/schools/${schoolId}/media`);
        const payload = await response.json();
        setMedia(payload.items ?? []);
      } catch {
        setMedia([]);
      }
      setLoading(false);
    })();
  }, [schoolId]);

  if (loading) {
    return (
      <div className="tab-loading-state" aria-hidden="true">
        <Skeleton style={{ width: "100%", height: "80px", marginBottom: "16px", borderRadius: "12px" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
          <Skeleton style={{ height: "64px", borderRadius: "8px" }} />
          <Skeleton style={{ height: "64px", borderRadius: "8px" }} />
          <Skeleton style={{ height: "64px", borderRadius: "8px" }} />
        </div>
      </div>
    );
  }
  if (error) return <div className="error-banner">{error}</div>;
  if (sections.length === 0 && !stored?.summary_text) {
    return (
      <div className="empty-state-card">
        <div className="empty-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
          </svg>
        </div>
        <h2>No verified evidence on file yet</h2>
        <p>This campus is registered, but no reconciled claims have been recorded. Ask AI will also report that sources are currently silent.</p>
      </div>
    );
  }

  const stats = (stored?.key_stats ?? []).filter((item) => item.label && item.value);
  const verify = stored?.things_to_verify ?? [];

  return (
    <div className="overview-tab-content">
      {stored?.summary_text ? (
        <div className="executive-summary-card">
          <div className="summary-card-badge">
            <svg viewBox="0 0 16 16" fill="currentColor" className="summary-icon">
              <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.5 6.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM8 12a3.5 3.5 0 0 1-3.26-2.22.5.5 0 0 1 .92-.38A2.5 2.5 0 0 0 8 11a2.5 2.5 0 0 0 2.34-1.6.5.5 0 0 1 .92.38A3.5 3.5 0 0 1 8 12z" />
            </svg>
            <span>Verified Overview Summary</span>
          </div>
          <p className="executive-summary-text">{stored.summary_text}</p>
        </div>
      ) : null}

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

      {verify.length ? (
        <section className="verify-alert-panel" aria-labelledby="things-to-verify">
          <div className="verify-panel-header">
            <svg className="verify-alert-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h2 id="things-to-verify" className="verify-title">Items Requiring Parent Verification</h2>
              <p className="verify-lead">
                The following areas contain conflicting records between official registry, school websites, and Facebook publications.
              </p>
            </div>
          </div>
          <div className="verify-items-list">
            {verify.map((item, index) => (
              <div key={item.claim_group_id || `${item.category}-${index}`} className="verify-item-card">
                <div className="verify-item-top">
                  <span className="verify-category-tag">{categoryTitle(item.category)}</span>
                  <ConfidenceChip label={normalizeConfidence(item.confidence_label)} size="sm" />
                </div>
                <p className="verify-note">{item.reconciliation_note || "Conflicting records stored across sources."}</p>
                {item.confidence_label === "conflicting" && item.claim_group_id ? (
                  <Link href={`/schools/${schoolId}/conflict/${item.claim_group_id}`} className="verify-inspect-link">
                    Inspect source contradiction diff →
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <MediaGallery items={media} />

      <nav className="section-jump-nav" aria-label="Section shortcuts">
        <span className="jump-title">Jump to section:</span>
        <div className="jump-pills">
          {sections.map((section) => (
            <a key={section.key} href={`#${categoryId(section.key)}`} className="jump-pill">
              {categoryTitle(section.key)}
            </a>
          ))}
        </div>
      </nav>

      <div className="category-sections-stack">
        {sections.map((section) => (
          <article key={section.key} id={categoryId(section.key)} className="category-section-card">
            <div className="section-card-header">
              <div className="section-title-wrap">
                <h3 className="section-card-title">{categoryTitle(section.key)}</h3>
                {freshnessLabel(section.updated) ? (
                  <span className="section-freshness">{freshnessLabel(section.updated)}</span>
                ) : null}
              </div>
              <ConfidenceChip label={section.confidence} size="sm" />
            </div>

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
                              ⚠ Disputed in records
                            </Link>
                          ) : null}
                        </div>
                        <blockquote className="source-blockquote">
                          “{source.excerpt}”
                        </blockquote>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
