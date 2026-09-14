"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const CHANGE_TYPES = ["new", "removed", "contradicted", "updated"] as const;
type ChangeType = (typeof CHANGE_TYPES)[number];

type ChangeRow = {
  id: string;
  change_type: string | null;
  summary_text: string | null;
  detected_at: string | null;
};

function normalizeChangeType(value: string | null | undefined): ChangeType {
  const type = String(value || "").toLowerCase();
  return (CHANGE_TYPES as readonly string[]).includes(type) ? (type as ChangeType) : "updated";
}

function changeLabel(type: ChangeType) {
  if (type === "new") return "New";
  if (type === "removed") return "Removed";
  if (type === "contradicted") return "Contradicted";
  return "Updated";
}

function changeIcon(type: ChangeType) {
  if (type === "new") return "+";
  if (type === "removed") return "–";
  if (type === "contradicted") return "⨯";
  return "~";
}

function detectedLabel(iso: string | null) {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return then.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ChangesTab({ schoolId }: { schoolId: string }) {
  const [rows, setRows] = useState<ChangeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data, error: queryError } = await supabase
        .from("claim_changes")
        .select("id, change_type, summary_text, detected_at")
        .eq("school_id", schoolId)
        .order("detected_at", { ascending: false });
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [schoolId]);

  if (loading) return <p>Loading changes…</p>;
  if (error) return <p className="error">{error}</p>;
  if (rows.length === 0) {
    return <p>No detected changes for this school yet.</p>;
  }

  return (
    <ol className="change-timeline">
      {rows.map((row) => {
        const type = normalizeChangeType(row.change_type);
        return (
          <li key={row.id} className="change-row">
            <div className="change-row-head">
              <span className={`change-chip change-chip-${type}`}>
                <span className="change-chip-icon" aria-hidden="true">
                  {changeIcon(type)}
                </span>
                <span>{changeLabel(type)}</span>
              </span>
              {detectedLabel(row.detected_at) ? (
                <time className="change-date" dateTime={row.detected_at ?? undefined}>
                  {detectedLabel(row.detected_at)}
                </time>
              ) : null}
            </div>
            {row.summary_text ? <p className="change-summary">{row.summary_text}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
