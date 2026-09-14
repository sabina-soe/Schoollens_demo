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
      <div className="empty-state">
        <p>Loading summary…</p>
      </div>
    );
  }
  if (error) return <p className="error">{error}</p>;
  if (sections.length === 0 && !stored?.summary_text) {
    return (
      <div className="empty-state">
        <h2>No verified evidence yet</h2>
        <p>This campus is in the register, but no reconciled claims are stored. Ask will also report that sources are silent.</p>
      </div>
    );
  }

  const stats = (stored?.key_stats ?? []).filter((item) => item.label && item.value);
  const verify = stored?.things_to_verify ?? [];

  return (
    <div>
      {stored?.summary_text ? <p className="overview-summary">{stored.summary_text}</p> : null}
      {stats.length ? (
        <ul className="summary-stats">
          {stats.map((item) => (
            <li key={`${item.label}-${item.value}`}>
              <p className="stat-value">{item.value}</p>
              <p className="stat-label">{item.label}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {verify.length ? (
        <section className="verify-panel" aria-labelledby="things-to-verify">
          <h2 id="things-to-verify">Things to verify</h2>
          <p className="operator-lead">
            Conflicting, unknown, and outdated groups are listed as recorded. This list is not rewritten into the
            summary above.
          </p>
          <ul className="verify-list">
            {verify.map((item, index) => (
              <li key={item.claim_group_id || `${item.category}-${index}`}>
                <div className="profile-section-head">
                  <h3>{categoryTitle(item.category)}</h3>
                  <ConfidenceChip label={normalizeConfidence(item.confidence_label)} />
                </div>
                <p className="overview-summary">{item.reconciliation_note || "No reconciliation note stored."}</p>
                {item.confidence_label === "conflicting" && item.claim_group_id ? (
                  <p>
                    <Link href={`/schools/${schoolId}/conflict/${item.claim_group_id}`}>Inspect contradiction</Link>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <MediaGallery items={media} />
      <nav className="section-jump" aria-label="Summary sections">
        {sections.map((section) => (
          <a key={section.key} href={`#${categoryId(section.key)}`}>
            {categoryTitle(section.key)}
          </a>
        ))}
      </nav>
      {sections.map((section) => (
        <section key={section.key} id={categoryId(section.key)} className="profile-section">
          <div className="profile-section-head">
            <h2>{categoryTitle(section.key)}</h2>
            <ConfidenceChip label={section.confidence} />
          </div>
          <p className="overview-summary">{section.summary}</p>
          {freshnessLabel(section.updated) ? <p className="evidence-freshness">{freshnessLabel(section.updated)}</p> : null}
          <button
            type="button"
            className="secondary source-toggle"
            aria-expanded={openKey === section.key}
            onClick={() => setOpenKey(openKey === section.key ? null : section.key)}
          >
            {openKey === section.key ? "Hide sources" : "Where does this come from?"}
          </button>
          {openKey === section.key ? (
            <ul className="source-list">
              {section.sources.length === 0 ? (
                <li>No source excerpt stored for this summary.</li>
              ) : (
                section.sources.map((source, index) => (
                  <li key={`${source.groupId}-${index}`}>
                    <span className="evidence-source-tag">{source.tag}</span>
                    <span className="evidence-excerpt-text">{source.excerpt}</span>
                    {source.conflicting ? (
                      <p>
                        <Link href={`/schools/${schoolId}/conflict/${source.groupId}`}>Inspect contradiction</Link>
                      </p>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}
