import { normalizeConfidence, type ConfidenceLabel } from "@/lib/confidence";
import type { FeePoster } from "@/lib/school-branches";

export type FeeLedgerEvidence = {
  source_excerpt: string | null;
  evidence_type: string | null;
  uploaded_at: string | null;
  original_url: string | null;
  source_type: string | null;
  source_trust_tier: string | null;
};

export type FeeLedgerRow = {
  id: string;
  category: string;
  confidence_label: string;
  reconciliation_note: string | null;
  last_updated: string | null;
  claim_texts: string[];
  evidence: FeeLedgerEvidence[];
};

export function feePosterShouldList(poster: FeePoster, hasFeeClaimGroups: boolean) {
  const label = normalizeConfidence(poster.confidence);
  if (label === "outdated" || label === "conflicting") return true;
  return !hasFeeClaimGroups;
}

export function feePostersToLedgerRows(schoolId: string, posters: FeePoster[], hasFeeClaimGroups = false): FeeLedgerRow[] {
  return posters.filter((poster) => feePosterShouldList(poster, hasFeeClaimGroups)).map((poster, index) => {
    const programmes = (poster.branches ?? []).flatMap((branch) =>
      (branch.programmes ?? []).map((row) => `${row.item}: ${row.amount || row.on_campus || row.online || ""}`.trim()),
    );
    const shared = (poster.shared ?? []).map((row) => `${row.item}: ${row.amount || ""}`.trim());
    const claim_texts = [...new Set([...programmes, ...shared, ...(poster.claims ?? [])])].filter(Boolean);
    const href = poster.source_url || (poster.file ? `/school-fees/${encodeURIComponent(poster.file)}` : null);
    return {
      id: `fee-overlay-${schoolId}-${index}`,
      category: "fees",
      confidence_label: poster.confidence || "likely",
      reconciliation_note: poster.lead || null,
      last_updated: null,
      claim_texts: claim_texts.length ? claim_texts : [poster.label || "Published fee schedule"].filter(Boolean),
      evidence: [
        {
          source_excerpt: poster.source_label || poster.label || "Published fee source",
          evidence_type: "published_schedule",
          uploaded_at: null,
          original_url: href,
          source_type: "website",
          source_trust_tier: "official_website",
        },
      ],
    };
  });
}

export function addFeePosterCounts(
  counts: Record<ConfidenceLabel, number>,
  posters: FeePoster[],
  hasFeeClaimGroups: boolean,
) {
  const next = { ...counts };
  for (const poster of posters) {
    if (!feePosterShouldList(poster, hasFeeClaimGroups)) continue;
    next[normalizeConfidence(poster.confidence)] += 1;
  }
  return next;
}
