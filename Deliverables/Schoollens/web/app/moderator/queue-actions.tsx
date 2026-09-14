"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function QueueActions({
  requestId,
  kind,
  onDone,
}: {
  requestId: string;
  kind: "claim" | "link";
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide(decision: "approved" | "rejected") {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const rpcName =
      kind === "claim" ? "review_school_claim_request" : "review_link_change_request";
    const { error: rpcError } = await supabase.rpc(rpcName, {
      p_request_id: requestId,
      p_decision: decision,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onDone();
  }

  return (
    <div>
      <button type="button" disabled={busy} onClick={() => void decide("approved")}>
        Approve
      </button>
      <button type="button" className="danger" disabled={busy} onClick={() => void decide("rejected")}>
        Reject
      </button>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
