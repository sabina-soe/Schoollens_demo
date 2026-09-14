"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { freshnessLabel, sourceTag } from "@/lib/confidence";
import { ConfidenceChip } from "../../confidence-chip";

type Side = {
  claim_text: string;
  source_type: string | null;
  source_trust_tier: string | null;
  created_at: string | null;
  excerpts: { text: string; uploaded_at: string | null; original_url: string | null }[];
};

export function ConflictView({ schoolId, groupId }: { schoolId: string; groupId: string }) {
  const [schoolName, setSchoolName] = useState("School");
  const [note, setNote] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>("conflicting");
  const [updated, setUpdated] = useState<string | null>(null);
  const [sides, setSides] = useState<Side[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle();
      if (school?.name) setSchoolName(school.name);
      const { data: group, error: groupError } = await supabase
        .from("claim_groups")
        .select("id, school_id, category, confidence_label, reconciliation_note, last_updated")
        .eq("id", groupId)
        .maybeSingle();
      if (groupError || !group || group.school_id !== schoolId) {
        setError(groupError?.message || "Conflict group not found.");
        setLoading(false);
        return;
      }
      setNote(group.reconciliation_note);
      setLabel(group.confidence_label);
      setUpdated(group.last_updated);
      const { data: members } = await supabase
        .from("claim_group_members")
        .select("claim_id")
        .eq("claim_group_id", groupId);
      const claimIds = (members ?? []).map((row) => row.claim_id);
      const { data: claims } = claimIds.length
        ? await supabase
            .from("claims")
            .select("id, claim_text, source_type, source_trust_tier, created_at")
            .in("id", claimIds)
        : { data: [] };
      const { data: evidence } = claimIds.length
        ? await supabase
            .from("evidence")
            .select("claim_id, source_excerpt, uploaded_at, original_url")
            .in("claim_id", claimIds)
        : { data: [] };
      const excerptsByClaim = new Map<string, typeof evidence>();
      for (const row of evidence ?? []) {
        const list = excerptsByClaim.get(row.claim_id) ?? [];
        list.push(row);
        excerptsByClaim.set(row.claim_id, list);
      }
      setSides(
        (claims ?? []).map((claim) => ({
          claim_text: claim.claim_text,
          source_type: claim.source_type,
          source_trust_tier: claim.source_trust_tier,
          created_at: claim.created_at,
          excerpts: (excerptsByClaim.get(claim.id) ?? [])
            .filter((item) => item.source_excerpt)
            .map((item) => ({
              text: item.source_excerpt as string,
              uploaded_at: item.uploaded_at,
              original_url: item.original_url,
            })),
        })),
      );
      setLoading(false);
    })();
  }, [schoolId, groupId]);

  if (loading) {
    return (
      <main className="wide">
        <p>Loading contradiction…</p>
      </main>
    );
  }

  return (
    <main className="wide">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/schools">Schools</Link>
        <span> / </span>
        <Link href={`/schools/${schoolId}`}>{schoolName}</Link>
        <span> / </span>
        <span>Conflict</span>
      </nav>
      <h1>Conflicting evidence</h1>
      <ConfidenceChip label={label} />
      {error ? <p className="error">{error}</p> : null}
      {note ? <p className="evidence-note">{note}</p> : <p>No reconciliation note yet.</p>}
      {freshnessLabel(updated) ? <p className="evidence-freshness">{freshnessLabel(updated)}</p> : null}
      <div className="conflict-grid">
        {sides.map((side, index) => (
          <article key={`${side.claim_text}-${index}`} className="conflict-side">
            <p className="evidence-source-tag">{sourceTag(side.source_type, side.source_trust_tier)}</p>
            <p className="evidence-claim">{side.claim_text}</p>
            {side.excerpts.map((excerpt, excerptIndex) => (
              <blockquote key={excerptIndex} className="evidence-excerpt">
                <span className="evidence-excerpt-text">{excerpt.text}</span>
                {excerpt.uploaded_at ? (
                  <p className="evidence-freshness">{freshnessLabel(excerpt.uploaded_at)}</p>
                ) : null}
              </blockquote>
            ))}
            {side.created_at ? <p className="evidence-freshness">{side.created_at.slice(0, 10)}</p> : null}
          </article>
        ))}
      </div>
      <p>
        Parents can confirm or dispute this on the{" "}
        <Link href={`/schools/${schoolId}`}>Reviews</Link> tab. The platform does not decide which source is correct.
      </p>
    </main>
  );
}
