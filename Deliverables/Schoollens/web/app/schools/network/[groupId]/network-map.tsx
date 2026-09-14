"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { headlineConfidence } from "@/lib/row-confidence";
import { BranchesMap } from "../../[id]/branches-map";
import { ConfidenceChip } from "../../[id]/confidence-chip";

type Branch = {
  id: string;
  name: string;
  address: string | null;
  location: unknown;
  geocode_confidence: string | null;
};

export function NetworkMap({ groupId }: { groupId: string }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [labels, setLabels] = useState<Record<string, string[]>>({});
  const [networkClaims, setNetworkClaims] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data, error: queryError } = await supabase
        .from("schools")
        .select("id, name, address, location, geocode_confidence")
        .eq("school_group_id", groupId)
        .order("name");
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }
      const rows = data ?? [];
      setBranches(rows);
      const ids = rows.map((row) => row.id);
      if (ids.length) {
        const { data: groups } = await supabase
          .from("claim_groups")
          .select("school_id, confidence_label")
          .in("school_id", ids);
        const next: Record<string, string[]> = {};
        for (const group of groups ?? []) {
          const list = next[group.school_id] ?? [];
          list.push(group.confidence_label ?? "unknown");
          next[group.school_id] = list;
        }
        setLabels(next);
        const { data: claims } = await supabase
          .from("claims")
          .select("claim_text")
          .in("school_id", ids)
          .eq("scope", "network");
        setNetworkClaims([
          ...new Set((claims ?? []).map((row) => row.claim_text).filter((text): text is string => Boolean(text))),
        ].slice(0, 8));
      }
      setLoading(false);
    })();
  }, [groupId]);

  return (
    <main className="wide">
      <p>
        <Link href="/schools">Schools</Link>
      </p>
      <h1>School network</h1>
      {loading ? <p>Loading…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && branches.length === 0 ? <p>No branches share this network.</p> : null}
      {networkClaims.length ? (
        <section>
          <h2>Network-level claims</h2>
          <ul className="ledger">
            {networkClaims.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <BranchesMap branches={branches} />
      <ul className="ledger">
        {branches.map((branch) => (
          <li key={branch.id} className="directory-row">
            <div>
              <Link href={`/schools/${branch.id}`}>{branch.name}</Link>
              {branch.address ? <p className="directory-meta">{branch.address}</p> : null}
            </div>
            <ConfidenceChip label={headlineConfidence(labels[branch.id] ?? [])} />
          </li>
        ))}
      </ul>
    </main>
  );
}
