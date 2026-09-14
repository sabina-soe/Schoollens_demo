"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = ["fees", "curriculum", "safety", "facilities", "class size", "contact info"] as const;

export function CorrectionForm({
  schoolId,
  onDone,
}: {
  schoolId: string;
  onDone: () => void;
}) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("fees");
  const [claimText, setClaimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("claims").insert({
      school_id: schoolId,
      claim_text: claimText.trim(),
      category,
      language: "en",
      scope: "branch",
      source_type: "website",
      source_trust_tier: "official_website",
      created_at: new Date().toISOString(),
    });
    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setClaimText("");
    onDone();
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor={`cat-${schoolId}`}>Category</label>
      <select
        id={`cat-${schoolId}`}
        value={category}
        onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number])}
      >
        {CATEGORIES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <label htmlFor={`claim-${schoolId}`}>Correction (English claim text)</label>
      <textarea
        id={`claim-${schoolId}`}
        value={claimText}
        onChange={(event) => setClaimText(event.target.value)}
        required
      />
      <button type="submit" disabled={busy}>
        Submit correction
      </button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
