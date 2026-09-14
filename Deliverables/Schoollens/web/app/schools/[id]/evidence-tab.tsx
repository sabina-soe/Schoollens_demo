"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CATEGORY_SECTIONS,
  categoryId,
  categoryTitle,
  extractNumericStat,
  freshnessLabel,
  normalizeConfidence,
  sourceTag,
} from "@/lib/confidence";
import { ConfidenceChip } from "./confidence-chip";

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

export function EvidenceTab({ schoolId }: { schoolId: string }) {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: groups, error: groupError } = await supabase
        .from("claim_groups")
        .select("id, category, confidence_label, reconciliation_note, last_updated")
        .eq("school_id", schoolId)
        .order("category");
      if (groupError) {
        setError(groupError.message);
        setLoading(false);
        return;
      }
      if (!groups?.length) {
        setRows([]);
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
        groups.map((group) => {
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
        }),
      );
      setLoading(false);
    })();
  }, [schoolId]);

  useEffect(() => {
    if (loading) return;
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading, rows]);

  if (loading) return <p>Loading evidence…</p>;
  if (error) return <p className="error">{error}</p>;
  if (rows.length === 0) {
    return <p>No verified evidence on this school yet.</p>;
  }

  const grouped = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    const key = String(row.category || "other").toLowerCase();
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  const orderedKeys = [
    ...CATEGORY_SECTIONS.map((section) => section.key),
    ...[...grouped.keys()].filter((key) => !CATEGORY_SECTIONS.some((section) => section.key === key)),
  ].filter((key) => grouped.has(key));

  return (
    <div>
      <nav className="section-jump" aria-label="Evidence sections">
        {orderedKeys.map((key) => (
          <a key={key} href={`#${categoryId(key)}`}>
            {categoryTitle(key)}
          </a>
        ))}
      </nav>
      {orderedKeys.map((key) => {
        const sectionRows = grouped.get(key) ?? [];
        const stats = sectionRows.flatMap((row) =>
          normalizeConfidence(row.confidence_label) === "supported"
            ? row.claim_texts.map(extractNumericStat).filter((stat): stat is NonNullable<typeof stat> => Boolean(stat))
            : [],
        );
        return (
          <section key={key} id={categoryId(key)} className="profile-section">
            <div className="profile-section-head">
              <h2>{categoryTitle(key)}</h2>
              <ConfidenceChip label={sectionRows[0]?.confidence_label} />
            </div>
            {stats.length ? (
              <div className="stat-strip">
                {stats.map((stat) => (
                  <div key={`${stat.value}-${stat.label}`} className="stat-block">
                    <p className="stat-value">{stat.value}</p>
                    <p className="stat-label">{stat.label}</p>
                  </div>
                ))}
              </div>
            ) : null}
            <ol className="evidence-ledger">
              {sectionRows.map((row) => (
                <li key={row.id} className="evidence-row">
                  <div className="evidence-row-head">
                    <ConfidenceChip label={row.confidence_label} />
                    {normalizeConfidence(row.confidence_label) === "conflicting" ? (
                      <Link href={`/schools/${schoolId}/conflict/${row.id}`}>Inspect contradiction</Link>
                    ) : null}
                  </div>
                  {row.claim_texts.map((text) => (
                    <p key={text} className="evidence-claim">
                      {text}
                    </p>
                  ))}
                  {row.reconciliation_note ? <p className="evidence-note">{row.reconciliation_note}</p> : null}
                  {row.evidence
                    .filter((item) => item.source_excerpt)
                    .map((item, index) => (
                      <blockquote key={`${row.id}-${index}`} className="evidence-excerpt">
                        <span className="evidence-source-tag">
                          {sourceTag(item.source_type, item.source_trust_tier)}
                        </span>
                        <span className="evidence-excerpt-text">{item.source_excerpt}</span>
                      </blockquote>
                    ))}
                  {freshnessLabel(row.last_updated) ? (
                    <p className="evidence-freshness">{freshnessLabel(row.last_updated)}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
