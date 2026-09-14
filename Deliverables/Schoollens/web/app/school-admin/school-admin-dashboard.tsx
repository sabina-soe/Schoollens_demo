"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CorrectionForm } from "./correction-form";
import { LinkChangeForm } from "./link-change-form";

type AdminSchool = {
  id: string;
  name: string;
  school_group_id: string | null;
  official_website_url: string | null;
  official_facebook_url: string | null;
};
type PendingLink = {
  id: string;
  school_id: string;
  field: string;
  proposed_value: string | null;
};
type Flagged = {
  id: string;
  school_id: string;
  category: string | null;
  confidence_label: string | null;
  reconciliation_note: string | null;
};

export function SchoolAdminDashboard() {
  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [schools, setSchools] = useState<AdminSchool[]>([]);
  const [pending, setPending] = useState<PendingLink[]>([]);
  const [flagged, setFlagged] = useState<Flagged[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
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
    if (profile?.role !== "school_admin") {
      setState("denied");
      return;
    }

    const { data: claims } = await supabase
      .from("school_claim_requests")
      .select("school_id")
      .eq("requested_by", user.id)
      .eq("status", "approved");
    const claimedIds = [...new Set((claims ?? []).map((row) => row.school_id))];
    const { data: claimedSchools } = claimedIds.length
      ? await supabase
          .from("schools")
          .select("id, name, school_group_id, official_website_url, official_facebook_url")
          .in("id", claimedIds)
      : { data: [] };
    const groupIds = [
      ...new Set(
        (claimedSchools ?? [])
          .map((row) => row.school_group_id)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const { data: networkSchools } = groupIds.length
      ? await supabase
          .from("schools")
          .select("id, name, school_group_id, official_website_url, official_facebook_url")
          .in("school_group_id", groupIds)
      : { data: [] };
    const merged: AdminSchool[] = Object.values(
      Object.fromEntries(
        [...(claimedSchools ?? []), ...(networkSchools ?? [])].map((row) => [row.id, row]),
      ),
    );
    const { data: pendingRows } = await supabase
      .from("link_change_requests")
      .select("id, school_id, field, proposed_value, status")
      .eq("requested_by", user.id)
      .eq("status", "pending");

    const mergedIds = merged.map((row) => row.id);
    const { data: flaggedRows } = mergedIds.length
      ? await supabase
          .from("claim_groups")
          .select("id, school_id, category, confidence_label, reconciliation_note")
          .in("school_id", mergedIds)
          .eq("confidence_label", "conflicting")
      : { data: [] };

    setSchools(merged);
    setPending((pendingRows ?? []).map(({ status: _status, ...row }) => row));
    setFlagged(flaggedRows ?? []);
    setError(null);
    setState("ready");
  }

  useEffect(() => {
    void load();
  }, []);

  if (state === "loading") {
    return (
      <main>
        <h1>School Admin</h1>
        <p>Loading…</p>
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main>
        <h1>School Admin</h1>
        <p>This dashboard is limited to verified school admins.</p>
        <p>Click Sign in, choose School Admin, then open this page again.</p>
      </main>
    );
  }

  return (
    <main className="wide">
      <p>
        <Link href="/">Home</Link>
      </p>
      <h1>School Admin</h1>
      {error ? <p className="error">{error}</p> : null}
      {schools.length === 0 ? (
        <p>No claimed schools yet.</p>
      ) : (
        schools.map((school) => (
          <section key={school.id} className="admin-school">
            <h2>
              <Link href={`/schools/${school.id}`}>{school.name}</Link>
            </h2>
            <p>Current website: {school.official_website_url || "—"}</p>
            <p>Current Facebook: {school.official_facebook_url || "—"}</p>
            <LinkChangeForm schoolId={school.id} onDone={() => void load()} />
            <h3>Submit a correction</h3>
            <CorrectionForm schoolId={school.id} onDone={() => void load()} />
          </section>
        ))
      )}
      <h2>Flagged contradictions</h2>
      {flagged.length === 0 ? (
        <p>None on your claimed schools.</p>
      ) : (
        <ul className="ledger">
          {flagged.map((row) => (
            <li key={row.id}>
              <Link href={`/schools/${row.school_id}/conflict/${row.id}`}>
                {row.category}: {row.confidence_label}
              </Link>
              {row.reconciliation_note ? <p className="evidence-note">{row.reconciliation_note}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <h2>Pending link changes</h2>
      {pending.length === 0 ? (
        <p>None.</p>
      ) : (
        <ul className="ledger">
          {pending.map((row) => (
            <li key={row.id}>
              {row.field}: {row.proposed_value} (pending)
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
