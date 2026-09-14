"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LinkChangeForm({
  schoolId,
  onDone,
}: {
  schoolId: string;
  onDone: () => void;
}) {
  const [field, setField] = useState<"website" | "facebook">("website");
  const [proposedValue, setProposedValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setBusy(false);
      setError("Sign in required");
      return;
    }
    const { error: insertError } = await supabase.from("link_change_requests").insert({
      school_id: schoolId,
      requested_by: user.id,
      field,
      proposed_value: proposedValue.trim(),
      status: "pending",
    });
    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setProposedValue("");
    onDone();
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor={`field-${schoolId}`}>Field</label>
      <select
        id={`field-${schoolId}`}
        value={field}
        onChange={(event) => setField(event.target.value as "website" | "facebook")}
      >
        <option value="website">official_website_url</option>
        <option value="facebook">official_facebook_url</option>
      </select>
      <label htmlFor={`value-${schoolId}`}>Proposed URL</label>
      <input
        id={`value-${schoolId}`}
        type="url"
        value={proposedValue}
        onChange={(event) => setProposedValue(event.target.value)}
        required
      />
      <button type="submit" disabled={busy}>
        Propose change
      </button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
