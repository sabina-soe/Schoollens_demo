"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GroupQueue, type ReviewGroup } from "./group-queue";
import { QueueActions } from "./queue-actions";

type ClaimRow = {
  id: string;
  school_id: string;
  requested_by: string;
  proof_type: string | null;
  proof_detail: string | null;
};
type LinkRow = {
  id: string;
  school_id: string;
  requested_by: string;
  field: string;
  proposed_value: string | null;
};
type School = { id: string; name: string; school_group_id: string | null };
type Person = { id: string; role: string | null };

export function ModeratorQueue() {
  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [error, setError] = useState<string | null>(null);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [schoolById, setSchoolById] = useState<Record<string, School>>({});
  const [userById, setUserById] = useState<Record<string, Person>>({});
  const [reviewGroups, setReviewGroups] = useState<ReviewGroup[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setState("denied");
      return;
    }
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "moderator") {
      setState("denied");
      return;
    }

    const { data: claimRows, error: claimError } = await supabase
      .from("school_claim_requests")
      .select("id, school_id, requested_by, proof_type, proof_detail, status")
      .eq("status", "pending")
      .order("id");
    const { data: linkRows, error: linkError } = await supabase
      .from("link_change_requests")
      .select("id, school_id, requested_by, field, proposed_value, status")
      .eq("status", "pending")
      .order("id");
    if (claimError || linkError) {
      setError(claimError?.message || linkError?.message || "Could not load queue");
      setState("ready");
      return;
    }

    const schoolIds = [
      ...new Set([
        ...(claimRows ?? []).map((row) => row.school_id),
        ...(linkRows ?? []).map((row) => row.school_id),
      ]),
    ];
    const requesterIds = [
      ...new Set([
        ...(claimRows ?? []).map((row) => row.requested_by),
        ...(linkRows ?? []).map((row) => row.requested_by),
      ]),
    ];
    const { data: schools } = schoolIds.length
      ? await supabase.from("schools").select("id, name, school_group_id").in("id", schoolIds)
      : { data: [] };
    const { data: requesters } = requesterIds.length
      ? await supabase.from("users").select("id, role").in("id", requesterIds)
      : { data: [] };

    const { data: groups } = await supabase
      .from("claim_groups")
      .select("id, school_id, category, confidence_label, reconciliation_note")
      .in("confidence_label", ["conflicting", "unknown", "outdated"]);
    const groupIds = (groups ?? []).map((row) => row.id);
    const { data: votes } = groupIds.length
      ? await supabase.from("claim_verifications").select("claim_group_id, vote").in("claim_group_id", groupIds)
      : { data: [] };
    const disputeCount: Record<string, number> = {};
    for (const vote of votes ?? []) {
      if (vote.vote === "dispute") {
        disputeCount[vote.claim_group_id] = (disputeCount[vote.claim_group_id] ?? 0) + 1;
      }
    }
    const extraSchoolIds = [...new Set((groups ?? []).map((row) => row.school_id))];
    const missingSchoolIds = extraSchoolIds.filter((id) => !(schools ?? []).some((row) => row.id === id));
    const { data: extraSchools } = missingSchoolIds.length
      ? await supabase.from("schools").select("id, name, school_group_id").in("id", missingSchoolIds)
      : { data: [] };
    const allSchools = [...(schools ?? []), ...(extraSchools ?? [])];
    const nameById = Object.fromEntries(allSchools.map((row) => [row.id, row]));

    const ranked = (groups ?? [])
      .map((row) => ({
        id: row.id,
        school_id: row.school_id,
        school_name: nameById[row.school_id]?.name ?? row.school_id,
        category: row.category,
        confidence_label: row.confidence_label,
        reconciliation_note: row.reconciliation_note,
        disputes: disputeCount[row.id] ?? 0,
      }))
      .sort((a, b) => {
        const rank = { conflicting: 0, unknown: 1, outdated: 2, likely: 3, supported: 4 } as const;
        const aRank = rank[(a.confidence_label as keyof typeof rank) || "unknown"] ?? 5;
        const bRank = rank[(b.confidence_label as keyof typeof rank) || "unknown"] ?? 5;
        return aRank - bRank || b.disputes - a.disputes;
      });

    setClaims((claimRows ?? []).map(({ status: _status, ...row }) => row));
    setLinks((linkRows ?? []).map(({ status: _status, ...row }) => row));
    setSchoolById(Object.fromEntries(allSchools.map((row) => [row.id, row])));
    setUserById(Object.fromEntries((requesters ?? []).map((row) => [row.id, row])));
    setReviewGroups(ranked);
    setError(null);
    setState("ready");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "loading") {
    return (
      <main>
        <h1>Moderator</h1>
        <p>Loading…</p>
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main>
        <h1>Moderator</h1>
        <p>This queue is limited to moderators.</p>
        <p>Click Sign in, choose Moderator, then open this page again.</p>
      </main>
    );
  }

  return (
    <main className="wide">
      <p>
        <Link href="/">Home</Link>
      </p>
      <h1>Low-confidence and disputed claims</h1>
      <GroupQueue groups={reviewGroups} onDone={() => void load()} />

      <h1>Pending school claims</h1>
      {error ? <p className="error">{error}</p> : null}
      {claims.length === 0 ? (
        <p>No pending requests.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>School</th>
              <th>Requester</th>
              <th>Proof</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((row) => {
              const school = schoolById[row.school_id];
              const requester = userById[row.requested_by];
              return (
                <tr key={row.id}>
                  <td>
                    <Link href={`/schools/${row.school_id}`}>{school?.name ?? row.school_id}</Link>
                    {school?.school_group_id
                      ? " — multi-branch (approval scopes the network)"
                      : ""}
                  </td>
                  <td>
                    {row.requested_by}
                    {requester?.role ? ` (${requester.role})` : ""}
                  </td>
                  <td>
                    {row.proof_type}: {row.proof_detail}
                  </td>
                  <td>
                    <QueueActions requestId={row.id} kind="claim" onDone={() => void load()} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h1>Pending link changes</h1>
      {links.length === 0 ? (
        <p>No pending link changes.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>School</th>
              <th>Requester</th>
              <th>Proposed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {links.map((row) => {
              const school = schoolById[row.school_id];
              const requester = userById[row.requested_by];
              const liveField =
                row.field === "facebook" ? "official_facebook_url" : "official_website_url";
              return (
                <tr key={row.id}>
                  <td>
                    <Link href={`/schools/${row.school_id}`}>{school?.name ?? row.school_id}</Link>
                  </td>
                  <td>
                    {row.requested_by}
                    {requester?.role ? ` (${requester.role})` : ""}
                  </td>
                  <td>
                    {liveField}: {row.proposed_value}
                  </td>
                  <td>
                    <QueueActions requestId={row.id} kind="link" onDone={() => void load()} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
