"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfidenceChip } from "../schools/[id]/confidence-chip";

export type ReviewGroup = {
  id: string;
  school_id: string;
  school_name: string;
  category: string | null;
  confidence_label: string | null;
  reconciliation_note: string | null;
  disputes: number;
};

export function GroupQueue({
  groups,
  onDone,
}: {
  groups: ReviewGroup[];
  onDone: () => void;
}) {
  if (groups.length === 0) {
    return <p>No low-confidence or disputed claim groups.</p>;
  }
  return (
    <ul className="ledger">
      {groups.map((group) => (
        <GroupRow key={group.id} group={group} onDone={onDone} />
      ))}
    </ul>
  );
}

function GroupRow({ group, onDone }: { group: ReviewGroup; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("claim_groups")
      .update({
        confidence_label: String(form.get("label")),
        reconciliation_note: String(form.get("note") || "").trim() || group.reconciliation_note,
        last_updated: new Date().toISOString(),
      })
      .eq("id", group.id);
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onDone();
  }

  return (
    <li>
      <div className="directory-row">
        <div>
          <Link href={`/schools/${group.school_id}`}>{group.school_name}</Link>
          <p className="directory-meta">
            {group.category}
            {group.disputes ? ` · ${group.disputes} dispute(s)` : ""}
            {" · "}
            <Link href={`/schools/${group.school_id}/conflict/${group.id}`}>Inspect</Link>
          </p>
          {group.reconciliation_note ? <p className="evidence-note">{group.reconciliation_note}</p> : null}
        </div>
        <ConfidenceChip label={group.confidence_label} />
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor={`label-${group.id}`}>Resolve label</label>
        <select id={`label-${group.id}`} name="label" defaultValue={group.confidence_label ?? "unknown"}>
          <option value="supported">supported</option>
          <option value="likely">likely</option>
          <option value="conflicting">conflicting</option>
          <option value="outdated">outdated</option>
          <option value="unknown">unknown</option>
        </select>
        <label htmlFor={`note-${group.id}`}>Note</label>
        <textarea id={`note-${group.id}`} name="note" defaultValue={group.reconciliation_note ?? ""} />
        <button type="submit" disabled={busy}>
          Save decision
        </button>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </li>
  );
}
