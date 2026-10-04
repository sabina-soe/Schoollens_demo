"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { freshnessLabel } from "@/lib/confidence";
import { isParentDecisionTopic, type ParentClaimInput } from "@/lib/parent-claims";
import { isRegisterUnreachable, loadLocalSchool, withTimeout } from "@/lib/public-register";
import { ConflictCompare } from "../../conflict-compare";

type Side = {
  claim_text: string;
  source_type: string | null;
  source_trust_tier: string | null;
  created_at: string | null;
  excerpts: { text: string; uploaded_at: string | null; original_url: string | null }[];
};

type LocalVerify = {
  claim_group_id?: string;
  category?: string | null;
  confidence_label?: string | null;
  reconciliation_note?: string | null;
};

async function loadLocalConflict(schoolId: string, groupId: string) {
  const [school, summaryRes] = await Promise.all([
    loadLocalSchool(schoolId),
    fetch(`/school-summaries/${schoolId}.json`).catch(() => null),
  ]);
  const summary = summaryRes && summaryRes.ok ? await summaryRes.json() : null;
  const item = ((summary?.things_to_verify ?? []) as LocalVerify[]).find((row) => row.claim_group_id === groupId);
  return { school, item };
}

export function ConflictView({ schoolId, groupId }: { schoolId: string; groupId: string }) {
  const [schoolName, setSchoolName] = useState("School");
  const [item, setItem] = useState<ParentClaimInput | null>(null);
  const [updated, setUpdated] = useState<string | null>(null);
  const [sides, setSides] = useState<Side[]>([]);
  const [parentTopic, setParentTopic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const local = await loadLocalConflict(schoolId, groupId);
      const localIsParent = !local.item || isParentDecisionTopic(local.item);
      setParentTopic(localIsParent);
      if (local.school?.name) setSchoolName(local.school.name);
      if (localIsParent && local.item) setItem(local.item);

      try {
        const { data: school } = await withTimeout(supabase.from("schools").select("name").eq("id", schoolId).maybeSingle());
        if (school?.name) setSchoolName(school.name);
        const { data: group, error: groupError } = await withTimeout(
          supabase
            .from("claim_groups")
            .select("id, school_id, category, confidence_label, reconciliation_note, last_updated")
            .eq("id", groupId)
            .maybeSingle(),
        );
        if (groupError) throw groupError;
        if (!group || group.school_id !== schoolId) {
          if (!local.item) setError("This conflict group is not on the public register.");
          setLoading(false);
          return;
        }
        const liveItem = {
          category: group.category,
          confidence_label: group.confidence_label,
          reconciliation_note: group.reconciliation_note,
        };
        const keep = isParentDecisionTopic(liveItem);
        setParentTopic(keep);
        if (keep) {
          setItem({
            category: group.category || local.item?.category,
            confidence_label: group.confidence_label || local.item?.confidence_label || "conflicting",
            reconciliation_note: group.reconciliation_note || local.item?.reconciliation_note || null,
          });
          setUpdated(group.last_updated);
        } else {
          setItem(null);
          setSides([]);
          setLoading(false);
          return;
        }
        const { data: members } = await supabase.from("claim_group_members").select("claim_id").eq("claim_group_id", groupId);
        const claimIds = (members ?? []).map((row) => row.claim_id);
        const { data: claims } = claimIds.length
          ? await supabase.from("claims").select("id, claim_text, source_type, source_trust_tier, created_at").in("id", claimIds)
          : { data: [] };
        type EvidenceRow = {
          claim_id: string;
          source_excerpt: string | null;
          uploaded_at: string | null;
          original_url: string | null;
        };
        const { data: evidence } = claimIds.length
          ? await supabase.from("evidence").select("claim_id, source_excerpt, uploaded_at, original_url").in("claim_id", claimIds)
          : { data: [] as EvidenceRow[] };
        const excerptsByClaim = new Map<string, EvidenceRow[]>();
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
      } catch (caught) {
        if (!local.item && !isRegisterUnreachable(caught)) {
          setError(caught instanceof Error ? caught.message : "Could not load this conflict group.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolId, groupId]);

  if (loading) {
    return (
      <main className="profile-page">
        <div className="profile-hero-inner">
          <p className="profile-empty-copy">Loading conflict record…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="profile-page">
      <section className="profile-band">
        <div className="profile-band-inner">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/schools" className="breadcrumb-link">
              Directory
            </Link>
            <span className="breadcrumb-separator">/</span>
            <Link href={`/schools/${schoolId}`} className="breadcrumb-link">
              {schoolName}
            </Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Conflict</span>
          </nav>
        </div>
      </section>

      <div className="profile-hero-inner conflict-page">
        <h1 className="profile-hero-title">{parentTopic ? "What sources disagree on" : "Not shown to parents"}</h1>
        {error ? <p className="error-banner">{error}</p> : null}
        {!parentTopic ? (
          <p className="executive-summary-text">
            This scrape is an event date or contact handle, not a school-choice fact. SchoolLens keeps
            parent pages to fees, curriculum, location, facilities, CCA, academic outcomes, and teacher quality.
          </p>
        ) : item ? (
          <ConflictCompare item={item} liveSides={sides} />
        ) : (
          <p className="profile-empty-copy">Sources disagree, and the comparison is not cached on this device yet.</p>
        )}
        {parentTopic && freshnessLabel(updated) ? <p className="profile-section-meta">{freshnessLabel(updated)}</p> : null}

        {parentTopic && sides.some((side) => side.excerpts.length) ? (
          <div className="conflict-grid">
            {sides.map((side, index) => (
              <article key={`${side.claim_text}-${index}`} className="conflict-side">
                {side.excerpts.map((excerpt, excerptIndex) => (
                  <blockquote key={excerptIndex} className="source-blockquote">
                    “{excerpt.text}”
                  </blockquote>
                ))}
              </article>
            ))}
          </div>
        ) : null}

        <p className="profile-section-lead">
          {parentTopic ? (
            <>
              Parents can confirm or dispute this on the{" "}
              <Link href={`/schools/${schoolId}#reviews`} className="aside-link">
                Reviews
              </Link>{" "}
              tab. SchoolLens does not pick which source is correct.
            </>
          ) : (
            <>
              Back to the{" "}
              <Link href={`/schools/${schoolId}`} className="aside-link">
                school profile
              </Link>
              .
            </>
          )}
        </p>
      </div>
    </main>
  );
}
