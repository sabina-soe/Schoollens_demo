"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const PROOF_TYPES = [
  { value: "email_domain", label: "Matching email domain" },
  { value: "document", label: "Uploaded document" },
  { value: "phone", label: "Phone verification" },
] as const;

export function ClaimForm({ schoolId, signedIn }: { schoolId: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [proofType, setProofType] = useState<(typeof PROOF_TYPES)[number]["value"]>("email_domain");
  const [proofDetail, setProofDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!signedIn) {
    return (
      <p>
        <Link href="/login">Sign in</Link> to claim this school.
      </p>
    );
  }

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
    const { error: insertError } = await supabase.from("school_claim_requests").insert({
      school_id: schoolId,
      requested_by: user.id,
      proof_type: proofType,
      proof_detail: proofDetail.trim(),
      status: "pending",
    });
    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setOpen(false);
    window.location.reload();
  }

  return (
    <div className="claim-form">
      {!open ? (
        <button type="button" className="secondary" onClick={() => setOpen(true)}>
          Claim this school
        </button>
      ) : (
        <form onSubmit={submit}>
          <h2>Claim this school</h2>
          <label htmlFor="proof_type">Proof type</label>
          <select
            id="proof_type"
            value={proofType}
            onChange={(event) =>
              setProofType(event.target.value as (typeof PROOF_TYPES)[number]["value"])
            }
          >
            {PROOF_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label htmlFor="proof_detail">Proof detail</label>
          <input
            id="proof_detail"
            value={proofDetail}
            onChange={(event) => setProofDetail(event.target.value)}
            placeholder="Domain, document URL, or phone number"
            required
          />
          <button type="submit" disabled={busy}>
            Submit claim
          </button>
          <button type="button" className="secondary" onClick={() => setOpen(false)}>
            Cancel
          </button>
          {error ? <p className="error">{error}</p> : null}
        </form>
      )}
    </div>
  );
}
