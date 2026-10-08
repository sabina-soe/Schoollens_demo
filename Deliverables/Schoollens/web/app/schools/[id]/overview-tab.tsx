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
import { FeeTable } from "./fee-table";
import { type CampusRecord, usableMedia } from "@/lib/campus-media";
import { type MoeRecord } from "@/lib/moe-register";
import { parentVerifyItems, type ParentClaimInput } from "@/lib/parent-claims";
import {
  campusOptionsFromPosters,
  defaultCampusId,
  filterMoeCampuses,
  postersForCampus,
  selectedCampus,
  type FeePoster,
} from "@/lib/school-branches";
import { yearsInCurriculum, type CurriculumRecord } from "@/lib/school-curriculum";
import type { CcaRecord } from "@/lib/school-cca";
import type { FacilityRecord } from "@/lib/school-facilities";
import { CampusPicker } from "./campus-picker";
import { CcaProgrammes } from "./cca-programmes";
import { ConflictCompare } from "./conflict-compare";
import { EvidenceTab } from "./evidence-tab";
import { CurriculumStages } from "./curriculum-stages";
import { FacilityList } from "./facility-list";
import { IsdListing } from "./isd-listing";
import { profileLead, splitProfileStats } from "@/lib/profile-snapshot";
import { firstOkJson, pickBySchoolIds } from "@/lib/school-network";
import { loadClaimOverlay } from "@/lib/claim-overlay";
import type { IsdRecord } from "@/lib/school-isd";
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

function mergeStoredSummary(current: StoredSummary | null, partial: Partial<StoredSummary>): StoredSummary {
  return {
    summary_text: partial.summary_text ?? current?.summary_text ?? null,
    key_stats: partial.key_stats ?? current?.key_stats ?? null,
    things_to_verify: partial.things_to_verify ?? current?.things_to_verify ?? null,
  };
}

function fallbackSummary(texts: string[]) {
  const unique = [...new Set(texts.map((text) => text.trim()).filter(Boolean))];
  if (!unique.length) return "";
  return unique.slice(0, 3).join(" ");
}

export function OverviewTab({
  schoolId,
  networkIds,
  schoolName,
  schoolAddress,
  moeRange,
  moeRecord,
  supportedShare,
  totalGroups,
}: {
  schoolId: string;
  networkIds?: string[];
  schoolName: string;
  schoolAddress?: string | null;
  moeRange: string;
  moeRecord?: MoeRecord | null;
  supportedShare: number | null;
  totalGroups: number;
}) {
  const ledgerIds = networkIds?.length ? networkIds : [schoolId];
  const [sections, setSections] = useState<Section[]>([]);
  const [stored, setStored] = useState<StoredSummary | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [feePosters, setFeePosters] = useState<FeePoster[]>([]);
  const [campusId, setCampusId] = useState("");
  const [yearFocus, setYearFocus] = useState("");
  const [campus, setCampus] = useState<CampusRecord | null>(null);
  const [curriculumRecord, setCurriculumRecord] = useState<CurriculumRecord | null>(null);
  const [ccaRecord, setCcaRecord] = useState<CcaRecord | null>(null);
  const [facilityRecord, setFacilityRecord] = useState<FacilityRecord | null>(null);
  const [isdRecord, setIsdRecord] = useState<IsdRecord | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const extras = new AbortController();

    function loadExtras(hasStored: boolean) {
      firstOkJson<{ summary_text?: string }>(
        ledgerIds.map((id) => `/school-summaries/${id}.json`),
        extras.signal,
      )
        .then((payload) => {
          if (cancelled || !payload?.summary_text) return;
          setStored((current) => mergeStoredSummary(current, { summary_text: payload.summary_text ?? null }));
        })
        .catch(() => {})
        .finally(() => {
          if (hasStored) return;
          firstOkJson<{ summary_text?: string; things_to_verify?: unknown[] }>(
            ledgerIds.map((id) => `/api/schools/${id}/summarize`),
            extras.signal,
          )
            .then((payload) => {
              if (cancelled || !payload) return;
              if (payload.summary_text || (payload.things_to_verify || []).length) {
                const partial = {
                  summary_text: payload.summary_text ?? null,
                  things_to_verify: (payload.things_to_verify ?? null) as StoredSummary["things_to_verify"],
                };
                setStored((current) => (current ? current : mergeStoredSummary(null, partial)));
              }
            })
            .catch(() => {});
        });
      firstOkJson<{ items?: MediaItem[] }>(
        [
          ...ledgerIds.map((id) => `/school-media/${id}.json`),
          ...ledgerIds.map((id) => `/api/schools/${id}/media`),
        ],
        extras.signal,
      )
        .then((payload) => {
          if (!cancelled) setMedia(payload?.items ?? []);
        })
        .catch(() => {
          if (!cancelled) setMedia([]);
        });
      fetch("/school-campus/by-school.json", { signal: extras.signal })
        .then((response) => response.json())
        .then((payload) => {
          if (!cancelled) setCampus(pickBySchoolIds(payload, ledgerIds));
        })
        .catch(() => {
          if (!cancelled) setCampus(null);
        });
      fetch("/school-curriculum/by-school.json", { signal: extras.signal })
        .then((response) => response.json())
        .then((payload) => {
          if (!cancelled) setCurriculumRecord(pickBySchoolIds(payload, ledgerIds));
        })
        .catch(() => {
          if (!cancelled) setCurriculumRecord(null);
        });
      fetch("/school-cca/by-school.json", { signal: extras.signal })
        .then((response) => response.json())
        .then((payload) => {
          if (!cancelled) setCcaRecord(pickBySchoolIds(payload, ledgerIds));
        })
        .catch(() => {
          if (!cancelled) setCcaRecord(null);
        });
      fetch("/school-facilities/by-school.json", { signal: extras.signal })
        .then((response) => response.json())
        .then((payload) => {
          if (!cancelled) setFacilityRecord(pickBySchoolIds(payload, ledgerIds));
        })
        .catch(() => {
          if (!cancelled) setFacilityRecord(null);
        });
      fetch("/school-isd/by-school.json", { signal: extras.signal })
        .then((response) => (response.ok ? response.json() : {}))
        .then((payload) => {
          if (!cancelled) setIsdRecord(pickBySchoolIds(payload, ledgerIds));
        })
        .catch(() => {
          if (!cancelled) setIsdRecord(null);
        });
      fetch("/school-fees/by-school.json", { signal: extras.signal })
        .then((response) => response.json())
        .then((payload: Record<string, { posters?: FeePoster[] }>) => {
          if (!cancelled) {
            const record = pickBySchoolIds(payload, ledgerIds);
            const posters = (record?.posters ?? []) as FeePoster[];
            setFeePosters(posters);
            const options = campusOptionsFromPosters(posters);
            setCampusId((current) => current || defaultCampusId(posters, options));
          }
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
          supabase.from("claim_groups").select("id, category, confidence_label, last_updated").in("school_id", ledgerIds),
        ),
        withTimeout(
          supabase
            .from("school_summaries")
            .select("summary_text, key_stats, things_to_verify")
            .in("school_id", ledgerIds),
        ),
      ]);
      if (cancelled) return;
      const storedRow = (Array.isArray(storedRes.data) ? storedRes.data : storedRes.data ? [storedRes.data] : []).find(
        (row) => row?.summary_text || (row?.key_stats || []).length,
      );
      if (storedRow) setStored(storedRow);
      if (groupsRes.error && !isRegisterUnreachable(groupsRes.error)) {
        setError(groupsRes.error.message);
      }

      let groups = groupsRes.data ?? [];
      let members: { claim_group_id: string; claim_id: string }[] = [];
      let claimById: Record<string, { id: string; claim_text: string | null; category: string | null; source_type: string | null; source_trust_tier: string | null }> = {};
      const excerptByClaim = new Map<string, string>();

      if (groups.length) {
        const groupIds = groups.map((group) => group.id);
        const membersRes = await supabase
          .from("claim_group_members")
          .select("claim_group_id, claim_id")
          .in("claim_group_id", groupIds);
        if (cancelled) return;
        members = membersRes.data ?? [];
        const claimIds = [...new Set(members.map((member) => member.claim_id))];
        const [claimsRes, evidenceRes] = await Promise.all([
          claimIds.length
            ? supabase.from("claims").select("id, claim_text, category, source_type, source_trust_tier").in("id", claimIds)
            : Promise.resolve({ data: [] as { id: string; claim_text: string | null; category: string | null; source_type: string | null; source_trust_tier: string | null }[] }),
          claimIds.length
            ? supabase.from("evidence").select("claim_id, source_excerpt").in("claim_id", claimIds)
            : Promise.resolve({ data: [] as { claim_id: string; source_excerpt: string | null }[] }),
        ]);
        if (cancelled) return;
        claimById = Object.fromEntries((claimsRes.data ?? []).map((claim) => [claim.id, claim]));
        for (const row of evidenceRes.data ?? []) {
          if (row.source_excerpt && !excerptByClaim.has(row.claim_id)) {
            excerptByClaim.set(row.claim_id, row.source_excerpt);
          }
        }
      } else {
        const overlay = await loadClaimOverlay(ledgerIds);
        if (cancelled) return;
        groups = overlay;
        members = overlay.flatMap((group) => group.claims.map((claim) => ({ claim_group_id: group.id, claim_id: claim.id })));
        claimById = Object.fromEntries(overlay.flatMap((group) => group.claims.map((claim) => [claim.id, claim])));
        for (const group of overlay) {
          for (const row of group.evidence) {
            if (row.source_excerpt && !excerptByClaim.has(row.claim_id)) {
              excerptByClaim.set(row.claim_id, row.source_excerpt);
            }
          }
        }
      }

      if (!groups.length) {
        setSections([]);
        setLoading(false);
        loadExtras(Boolean(storedRow));
        return;
      }

      const byCategory = new Map<string, { texts: string[]; labels: string[]; updated: string | null; sources: Source[] }>();
      for (const group of groups) {
        const key = String(group.category || "other").toLowerCase();
        const bucket = byCategory.get(key) ?? { texts: [], labels: [], updated: null, sources: [] };
        bucket.labels.push(group.confidence_label ?? "unknown");
        if (!bucket.updated || (group.last_updated && group.last_updated > bucket.updated)) {
          bucket.updated = group.last_updated;
        }
        for (const member of members) {
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
      loadExtras(Boolean(storedRow));
      } catch {
        if (cancelled) return;
        const overlay = await loadClaimOverlay(ledgerIds);
        if (cancelled) return;
        if (!overlay.length) {
          setSections([]);
          setLoading(false);
          loadExtras(false);
          return;
        }
        const byCategory = new Map<string, { texts: string[]; labels: string[]; updated: string | null; sources: Source[] }>();
        for (const group of overlay) {
          const key = String(group.category || "other").toLowerCase();
          const bucket = byCategory.get(key) ?? { texts: [], labels: [], updated: null, sources: [] };
          bucket.labels.push(group.confidence_label ?? "unknown");
          if (!bucket.updated || (group.last_updated && group.last_updated > bucket.updated)) {
            bucket.updated = group.last_updated;
          }
          for (const claim of group.claims) {
            if (claim.claim_text) bucket.texts.push(claim.claim_text);
          }
          for (const row of group.evidence) {
            if (!row.source_excerpt) continue;
            const claim = group.claims.find((item) => item.id === row.claim_id);
            bucket.sources.push({
              tag: sourceTag(claim?.source_type, claim?.source_trust_tier),
              excerpt: row.source_excerpt,
              groupId: group.id,
              conflicting: normalizeConfidence(group.confidence_label) === "conflicting",
            });
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
        loadExtras(false);
      }
    })();

    return () => {
      cancelled = true;
      extras.abort();
    };
  }, [schoolId, ledgerIds.join("|")]);

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
  const feeVerify = feePosters
    .filter((poster) => {
      const label = String(poster.confidence || "").toLowerCase();
      return label === "outdated" || label === "conflicting";
    })
    .map((poster): ParentClaimInput => ({
      category: "fees",
      confidence_label: poster.confidence,
      reconciliation_note: poster.lead || null,
      source_url: poster.source_url || (poster.file ? `/school-fees/${encodeURIComponent(poster.file)}` : null),
      claim_group_id: null,
      claim_texts: [
        ...(poster.branches ?? []).flatMap((branch) =>
          (branch.programmes ?? []).map((row) => `${row.item}: ${row.amount || ""}`.trim()),
        ),
        ...(poster.shared ?? []).map((row) => `${row.item}: ${row.amount || ""}`.trim()),
      ].filter(Boolean),
    }));
  const verify = parentVerifyItems<ParentClaimInput>([
    ...((stored?.things_to_verify ?? []) as ParentClaimInput[]),
    ...feeVerify,
  ]);
  const curriculum = sections.find((section) => section.key === "curriculum");
  const facilities = sections.find((section) => section.key === "facilities");
  const languages = sections.find((section) => /language|diploma/.test(section.key));
  const rest = sections.filter(
    (section) =>
      section.key !== "curriculum" &&
      section.key !== "facilities" &&
      section.key !== "contact info" &&
      section !== languages &&
      !(feePosters.length && section.key === "fees"),
  );
  const campusOptions = campusOptionsFromPosters(feePosters);
  const activeCampus = selectedCampus(campusOptions, campusId);
  const visibleFeePosters = postersForCampus(feePosters, campusId);
  const moeCampuses = filterMoeCampuses(moeRecord, activeCampus);
  const yearOptions = [
    ...new Set([
      ...visibleFeePosters.flatMap((poster) => poster.branches?.[0]?.programmes?.map((row) => row.item) ?? []),
      ...yearsInCurriculum(curriculumRecord),
    ]),
  ];
  const campusFacts = campus?.items ?? [];
  const campusAddress = activeCampus?.address || campus?.address || schoolAddress || "";
  const gallery = usableMedia(media);
  const hasCampusContent = Boolean(facilities || campusFacts.length || campusAddress || gallery.length || facilityRecord);
  const { snapshots, facts } = splitProfileStats(stats);
  const lead = profileLead(stored?.summary_text || "", stats.length > 0);

  return (
    <div className="overview-tab-content">
      {campusOptions.length > 1 ? (
        <CampusPicker
          campuses={campusOptions}
          value={campusId}
          onChange={setCampusId}
          years={[...new Set([yearFocus, ...yearOptions].filter(Boolean))]}
          yearValue={yearFocus}
          onYearChange={(year) => {
            setYearFocus(year);
            if (year) {
              requestAnimationFrame(() => document.getElementById("fees")?.scrollIntoView({ behavior: "smooth", block: "start" }));
            }
          }}
        />
      ) : null}
      <section className="profile-section profile-snapshot" id="overview">
        <div className="profile-section-head">
          <div>
            <span className="profile-section-kicker">At a glance</span>
            <h2 className="profile-section-title">Institutional profile</h2>
          </div>
          {curriculum?.updated && freshnessLabel(curriculum.updated) ? (
            <span className="profile-section-meta">{freshnessLabel(curriculum.updated)}</span>
          ) : null}
        </div>
        {lead ? (
          <p className="snapshot-lead">{lead}</p>
        ) : (
          <p className="snapshot-lead">
            <strong className="profile-school-name">{schoolName}</strong> is listed in the public register.
            No reconciled institutional summary is on file yet.
          </p>
        )}
        {snapshots.length ? (
          <div className={`snapshot-stat-grid snapshot-stat-grid-${Math.min(snapshots.length, 4)}`}>
            {snapshots.map((item) => (
              <div key={`${item.label}-${item.value}`} className="snapshot-stat-card">
                <span className="snapshot-stat-label">{item.label}</span>
                <strong className={`snapshot-stat-value${item.value.length > 18 ? " snapshot-stat-value-long" : ""}`}>
                  {item.value}
                </strong>
              </div>
            ))}
          </div>
        ) : null}
        {facts.length ? (
          <dl className="snapshot-fact-list">
            {facts.map((item) => (
              <div key={`${item.label}-${item.value}`} className="snapshot-fact-row">
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>
      {isdRecord ? <IsdListing record={isdRecord} /> : null}

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
              <p>
                {moeRecord?.campus_count
                  ? activeCampus && moeCampuses.length !== moeRecord.campus_count
                    ? `${moeCampuses.length} of ${moeRecord.campus_count} township listings for ${activeCampus.name}`
                    : `${moeRecord.campus_count} township listing${moeRecord.campus_count === 1 ? "" : "s"} on the MOE approve list`
                  : moeRange
                    ? "Registered dates on file"
                    : "No MOE dates on file"}
              </p>
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
          {sections
            .filter((section) => section.key !== "contact info")
            .map((section) => (
            <div key={section.key} className="trust-score-item">
              <div className="trust-score-copy">
                <h3>{categoryTitle(section.key)}</h3>
                <p>{freshnessLabel(section.updated) || "From public sources"}</p>
              </div>
              <ConfidenceChip label={section.confidence} size="sm" />
            </div>
          ))}
        </div>
        {moeRecord?.campuses?.length ? (
          <div className="moe-campus-list">
            <h3 className="moe-campus-title">
              MOE township registrations{activeCampus ? ` · ${activeCampus.name}` : ""}
            </h3>
            <p className="profile-section-lead">
              Each branch is registered separately. Names on the list can match the group name or a local campus name.
            </p>
            {moeCampuses.length ? (
              <div className="fee-table-wrap">
                <table className="fee-table moe-table">
                  <thead>
                    <tr>
                      <th scope="col">Listed name</th>
                      <th scope="col">Address</th>
                      <th scope="col">Approve term</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moeCampuses.map((row) => (
                      <tr key={`${row.moe_index}-${row.address}`}>
                        <td className="fee-table-item">{row.listed_name}</td>
                        <td className="fee-table-detail">{row.address || "—"}</td>
                        <td className="fee-table-amount">{row.period || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="profile-empty-copy">No MOE row matched this campus on the approve list.</p>
            )}
          </div>
        ) : null}
        {verify.length ? (
          <>
          <p className="profile-section-lead">
            Where sources disagree, SchoolLens shows what to check and which listings differ. It does not pick a winner.
          </p>
          <div className="verify-items-list">
            {verify.map((item, index) => (
              <div key={item.claim_group_id || `${item.category}-${index}`} className="verify-item-card">
                <ConflictCompare
                  item={item}
                  compact
                  action={
                    item.confidence_label === "conflicting" && item.claim_group_id ? (
                      <Link href={`/schools/${schoolId}/conflict/${item.claim_group_id}`} className="verify-inspect-link">
                        Open full comparison
                      </Link>
                    ) : item.source_url ? (
                      <a href={item.source_url} target="_blank" rel="noreferrer" className="verify-inspect-link">
                        Open source
                      </a>
                    ) : null
                  }
                />
              </div>
            ))}
          </div>
          </>
        ) : null}
        <EvidenceTab schoolId={schoolId} networkIds={ledgerIds} />
      </section>

      {visibleFeePosters.length ? (
        <section className="profile-section" id="fees">
          <div className="profile-section-head">
            <div>
              <span className="profile-section-kicker">
                {visibleFeePosters[0]?.kicker || "Posted announcement"}
              </span>
              <h2 className="profile-section-title">Fees{activeCampus && campusOptions.length > 1 ? ` · ${activeCampus.name}` : ""}</h2>
            </div>
            <ConfidenceChip label={visibleFeePosters[0]?.confidence || "likely"} size="sm" />
          </div>
          <p className="profile-section-lead">
            {visibleFeePosters[0]?.lead ||
              (activeCampus && campusOptions.length > 1
                ? `Monthly TIL fees for ${activeCampus.name}. Choose another campus above to compare.`
                : "Read from a published source. This is one source, so the label is likely until another independent record agrees.")}
          </p>
          {visibleFeePosters.map((poster) => (
            <FeeTable
              key={poster.source_url || poster.file || poster.label}
              poster={poster}
              focusYear={yearFocus}
            />
          ))}
        </section>
      ) : null}

      <section className="profile-section" id="educational-stages">
        <div className="profile-section-head">
          <h2 className="profile-section-title">Educational stages</h2>
          {curriculumRecord || curriculum ? (
            <ConfidenceChip label={curriculumRecord?.confidence || curriculum?.confidence || "likely"} size="sm" />
          ) : null}
        </div>
        {curriculumRecord ? (
          <CurriculumStages record={curriculumRecord} focusYear={yearFocus} />
        ) : curriculum ? (
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

      {ccaRecord ? (
        <section className="profile-section" id="cca">
          <div className="profile-section-head">
            <div>
              <span className="profile-section-kicker">Official website</span>
              <h2 className="profile-section-title">CCA</h2>
            </div>
            <ConfidenceChip label={ccaRecord.confidence || "likely"} size="sm" />
          </div>
          <CcaProgrammes record={ccaRecord} />
        </section>
      ) : null}

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
          {facilityRecord || facilities ? (
            <ConfidenceChip label={facilityRecord?.confidence || facilities?.confidence || "likely"} size="sm" />
          ) : campusFacts.length ? (
            <ConfidenceChip label="likely" size="sm" />
          ) : null}
        </div>
        {campusAddress ? (
          <p className="campus-address">
            <span>Campus</span>
            {campusAddress}
          </p>
        ) : null}
        {campusFacts.length ? (
          <ul className="campus-fact-list">
            {campusFacts.map((fact) => (
              <li key={fact.text}>
                <p>{fact.text}</p>
                <span>{fact.source}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {facilityRecord ? <FacilityList record={facilityRecord} /> : null}
        {facilities ? (
          <CategoryEvidence
            schoolId={schoolId}
            section={facilities}
            openKey={openKey}
            setOpenKey={setOpenKey}
          />
        ) : null}
        {!hasCampusContent ? (
          <p className="profile-empty-copy">No facilities evidence on file yet.</p>
        ) : null}
        <MediaGallery items={gallery} />
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
