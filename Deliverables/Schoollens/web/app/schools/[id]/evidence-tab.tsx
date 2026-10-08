"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isRegisterUnreachable } from "@/lib/public-register";
import { loadClaimOverlay, type OverlayGroup } from "@/lib/claim-overlay";
import {
  CATEGORY_SECTIONS,
  categoryId,
  categoryTitle,
  extractNumericStat,
  freshnessLabel,
  normalizeConfidence,
  sourceTag,
  type ConfidenceLabel,
} from "@/lib/confidence";
import { isParentDecisionTopic } from "@/lib/parent-claims";
import { feePostersToLedgerRows } from "@/lib/fee-claims";
import { pickBySchoolIds } from "@/lib/school-network";
import type { FeePoster } from "@/lib/school-branches";
import { ConfidenceChip } from "./confidence-chip";
import { Skeleton } from "../../components/ui/skeleton";

type EvidenceRow = {
  source_excerpt: string | null;
  evidence_type: string | null;
  uploaded_at: string | null;
  original_url: string | null;
  source_type: string | null;
  source_trust_tier: string | null;
};

type LedgerRow = {
  id: string;
  category: string | null;
  confidence_label: string | null;
  reconciliation_note: string | null;
  last_updated: string | null;
  claim_texts: string[];
  evidence: EvidenceRow[];
};

export function EvidenceTab({ schoolId, networkIds }: { schoolId: string; networkIds?: string[] }) {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const ledgerIds = networkIds?.length ? networkIds : [schoolId];
      function rowsFromOverlay(overlay: OverlayGroup[]) {
        return overlay
          .map((group) => ({
            id: group.id,
            category: group.category,
            confidence_label: group.confidence_label,
            reconciliation_note: group.reconciliation_note,
            last_updated: group.last_updated,
            claim_texts: [...new Set(group.claims.map((claim) => claim.claim_text).filter(Boolean))] as string[],
            evidence: group.evidence.map((item) => {
              const claim = group.claims.find((row) => row.id === item.claim_id);
              return {
                source_excerpt: item.source_excerpt,
                evidence_type: item.evidence_type ?? null,
                uploaded_at: item.uploaded_at ?? null,
                original_url: item.original_url ?? null,
                source_type: claim?.source_type ?? null,
                source_trust_tier: claim?.source_trust_tier ?? null,
              };
            }),
          }))
          .filter((row) =>
            isParentDecisionTopic({
              category: row.category,
              confidence_label: row.confidence_label,
              reconciliation_note: row.reconciliation_note,
              claim_texts: row.claim_texts,
            }),
          );
      }
      async function withFeeOverlay(base: LedgerRow[]) {
        try {
          const response = await fetch("/school-fees/by-school.json", { cache: "no-store" });
          if (!response.ok) return base;
          const payload = (await response.json()) as Record<string, { posters?: FeePoster[] }>;
          const record = pickBySchoolIds(payload, ledgerIds);
          const posters = record?.posters ?? [];
          const hasFeeClaimGroups = base.some((row) => String(row.category || "").toLowerCase() === "fees");
          const extra = feePostersToLedgerRows(schoolId, posters, hasFeeClaimGroups);
          const seen = new Set(base.map((row) => row.id));
          return [...extra.filter((row) => !seen.has(row.id)), ...base];
        } catch {
          return base;
        }
      }
      try {
      const { data: groups, error: groupError } = await supabase
        .from("claim_groups")
        .select("id, category, confidence_label, reconciliation_note, last_updated")
        .in("school_id", ledgerIds)
        .order("category");
      if (groupError && !isRegisterUnreachable(groupError)) setError(groupError.message);

      if (!groups?.length) {
        setRows(await withFeeOverlay(rowsFromOverlay(await loadClaimOverlay(ledgerIds))));
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
        ? await supabase
            .from("claims")
            .select("id, claim_text, source_type, source_trust_tier, created_at")
            .in("id", claimIds)
        : { data: [] };
      const { data: evidence } = claimIds.length
        ? await supabase
            .from("evidence")
            .select("claim_id, source_excerpt, evidence_type, uploaded_at, original_url")
            .in("claim_id", claimIds)
        : { data: [] };

      const claimById = Object.fromEntries((claims ?? []).map((claim) => [claim.id, claim]));
      const evidenceByClaim = new Map<string, typeof evidence>();
      for (const row of evidence ?? []) {
        const list = evidenceByClaim.get(row.claim_id) ?? [];
        list.push(row);
        evidenceByClaim.set(row.claim_id, list);
      }
      const membersByGroup = new Map<string, string[]>();
      for (const member of members ?? []) {
        const list = membersByGroup.get(member.claim_group_id) ?? [];
        list.push(member.claim_id);
        membersByGroup.set(member.claim_group_id, list);
      }

      setRows(
        await withFeeOverlay(
          groups
            .map((group) => {
              const ids = membersByGroup.get(group.id) ?? [];
              const claimTexts: string[] = [];
              const excerpts: EvidenceRow[] = [];
              for (const claimId of ids) {
                const claim = claimById[claimId];
                if (claim?.claim_text && !claimTexts.includes(claim.claim_text)) {
                  claimTexts.push(claim.claim_text);
                }
                for (const item of evidenceByClaim.get(claimId) ?? []) {
                  excerpts.push({
                    source_excerpt: item.source_excerpt,
                    evidence_type: item.evidence_type,
                    uploaded_at: item.uploaded_at,
                    original_url: item.original_url,
                    source_type: claim?.source_type ?? null,
                    source_trust_tier: claim?.source_trust_tier ?? null,
                  });
                }
              }
              return {
                id: group.id,
                category: group.category,
                confidence_label: group.confidence_label,
                reconciliation_note: group.reconciliation_note,
                last_updated: group.last_updated,
                claim_texts: claimTexts,
                evidence: excerpts,
              };
            })
            .filter((row) =>
              isParentDecisionTopic({
                category: row.category,
                confidence_label: row.confidence_label,
                reconciliation_note: row.reconciliation_note,
                claim_texts: row.claim_texts,
              }),
            ),
        ),
      );
      setLoading(false);
      } catch {
        setRows(await withFeeOverlay(rowsFromOverlay(await loadClaimOverlay(ledgerIds))));
        setLoading(false);
      }
    })();
  }, [schoolId, networkIds?.join("|")]);

  const [focusLabel, setFocusLabel] = useState<ConfidenceLabel | null>(null);

  useEffect(() => {
    function readHash() {
      const match = window.location.hash.replace("#", "").match(/^claim-(supported|likely|conflicting|outdated|unknown)$/);
      setFocusLabel(match ? (match[1] as ConfidenceLabel) : null);
    }
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  useEffect(() => {
    if (loading) return;
    const id = window.location.hash.replace("#", "");
    if (!id.startsWith("claim-")) return;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [loading, rows, focusLabel]);

  if (loading) {
    return (
      <div className="tab-loading-state" aria-hidden="true">
        <Skeleton style={{ width: "100%", height: "120px", marginBottom: "16px", borderRadius: "12px" }} />
        <Skeleton style={{ width: "100%", height: "120px", marginBottom: "16px", borderRadius: "12px" }} />
      </div>
    );
  }
  if (error) return <div className="error-banner">{error}</div>;
  if (rows.length === 0) {
    return (
      <div className="empty-state-card">
        <h2>No evidence on file</h2>
        <p>No claim groups have been recorded yet.</p>
      </div>
    );
  }

  const visibleRows = focusLabel
    ? rows.filter((row) => normalizeConfidence(row.confidence_label) === focusLabel)
    : rows;
  const grouped = new Map<string, LedgerRow[]>();
  for (const row of visibleRows) {
    const key = String(row.category || "other").toLowerCase();
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  const orderedKeys = [
    ...CATEGORY_SECTIONS.map((section) => section.key),
    ...[...grouped.keys()].filter((key) => !CATEGORY_SECTIONS.some((section) => section.key === key)),
  ].filter((key) => grouped.has(key));
  const usedFocusIds = new Set<string>();

  return (
    <div className="evidence-ledger-container">
      {focusLabel ? (
        <div className="evidence-filter-banner">
          <p>
            Showing {visibleRows.length} {focusLabel} claim{visibleRows.length === 1 ? "" : "s"}.
          </p>
          <a href="#verification-hub" className="evidence-filter-clear" onClick={() => setFocusLabel(null)}>
            Show all
          </a>
        </div>
      ) : null}
      <nav className="section-jump-nav" aria-label="Evidence categories">
        <span className="jump-title">Categories:</span>
        <div className="jump-pills">
          {orderedKeys.map((key) => (
            <a key={key} href={`#evidence-${categoryId(key)}`} className="jump-pill">
              {categoryTitle(key)} ({grouped.get(key)?.length || 0})
            </a>
          ))}
        </div>
      </nav>

      <div className="evidence-sections-stack">
        {orderedKeys.map((key) => {
          const sectionRows = grouped.get(key) ?? [];
          const stats = sectionRows.flatMap((row) =>
            normalizeConfidence(row.confidence_label) === "supported"
              ? row.claim_texts.map(extractNumericStat).filter((stat): stat is NonNullable<typeof stat> => Boolean(stat))
              : [],
          );
          return (
            <section key={key} id={`evidence-${categoryId(key)}`} className="evidence-section-group">
              <div className="section-group-header">
                <h3 className="section-group-title">{categoryTitle(key)}</h3>
                <span className="section-group-count">{sectionRows.length} verified item{sectionRows.length === 1 ? "" : "s"}</span>
              </div>

              {stats.length ? (
                <div className="stats-metric-grid" style={{ marginBottom: "16px" }}>
                  {stats.map((stat) => (
                    <div key={`${stat.value}-${stat.label}`} className="stat-metric-card">
                      <span className="metric-label">{stat.label}</span>
                      <strong className="metric-value">{stat.value}</strong>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="evidence-cards-list">
                {sectionRows.map((row) => {
                  const label = normalizeConfidence(row.confidence_label);
                  const focusId = `claim-${label}`;
                  const takeFocusId = !usedFocusIds.has(focusId);
                  if (takeFocusId) usedFocusIds.add(focusId);
                  return (
                  <article
                    key={row.id}
                    id={takeFocusId ? focusId : `claim-group-${row.id}`}
                    className={`evidence-item-card${focusLabel === label ? " evidence-item-card-focus" : ""}`}
                  >
                    <div className="evidence-item-header">
                      <div className="evidence-header-left">
                        <ConfidenceChip label={row.confidence_label} size="sm" />
                        {freshnessLabel(row.last_updated) ? (
                          <span className="evidence-freshness-tag">{freshnessLabel(row.last_updated)}</span>
                        ) : null}
                      </div>
                      {normalizeConfidence(row.confidence_label) === "conflicting" ? (
                        <Link href={`/schools/${schoolId}/conflict/${row.id}`} className="conflict-action-badge">
                          Compare sources
                        </Link>
                      ) : null}
                    </div>

                    <div className="evidence-claims-body">
                      {row.claim_texts.map((text) => {
                        const href =
                          row.evidence.find((item) => item.original_url)?.original_url || null;
                        return href ? (
                          <a
                            key={text}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="evidence-claim-statement evidence-claim-link"
                          >
                            {text}
                            <span className="evidence-claim-link-mark" aria-hidden="true">
                              ↗
                            </span>
                          </a>
                        ) : (
                          <p key={text} className="evidence-claim-statement">
                            {text}
                          </p>
                        );
                      })}
                    </div>

                    {row.reconciliation_note ? (
                      <div className="evidence-reconciliation-box">
                        <svg className="recon-icon" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                          <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
                        </svg>
                        <p className="recon-text">{row.reconciliation_note}</p>
                      </div>
                    ) : null}

                    {row.evidence.filter((item) => item.source_excerpt).length > 0 ? (
                      <div className="evidence-sources-drawer">
                        <span className="sources-label">Citing Sources:</span>
                        {row.evidence
                          .filter((item) => item.source_excerpt)
                          .map((item, index) => (
                            <blockquote key={`${row.id}-${index}`} className="evidence-source-quote">
                              <div className="source-quote-header">
                                <span className="source-tag-pill">
                                  {sourceTag(item.source_type, item.source_trust_tier)}
                                </span>
                                {item.original_url ? (
                                  <a
                                    href={item.original_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="source-open-link"
                                  >
                                    Open source
                                  </a>
                                ) : null}
                              </div>
                              {item.original_url ? (
                                <a
                                  href={item.original_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="source-quote-text source-quote-link"
                                >
                                  “{item.source_excerpt}”
                                </a>
                              ) : (
                                <p className="source-quote-text">“{item.source_excerpt}”</p>
                              )}
                            </blockquote>
                          ))}
                      </div>
                    ) : null}
                  </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
