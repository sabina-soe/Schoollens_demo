"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "../../components/ui/skeleton";

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
  if (type === "new") return "New Claim";
  if (type === "removed") return "Claim Removed";
  if (type === "contradicted") return "Contradiction Detected";
  return "Record Updated";
}

function ChangeIcon({ type }: { type: ChangeType }) {
  if (type === "new") {
    return (
      <svg className="change-svg" viewBox="0 0 16 16" fill="currentColor">
        <path fillRule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z" />
      </svg>
    );
  }
  if (type === "removed") {
    return (
      <svg className="change-svg" viewBox="0 0 16 16" fill="currentColor">
        <path fillRule="evenodd" d="M2 8a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11A.5.5 0 0 1 2 8z" />
      </svg>
    );
  }
  if (type === "contradicted") {
    return (
      <svg className="change-svg" viewBox="0 0 16 16" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className="change-svg" viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
      <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
    </svg>
  );
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

  if (loading) {
    return (
      <div className="tab-loading-state" aria-hidden="true">
        <Skeleton style={{ width: "100%", height: "80px", marginBottom: "12px", borderRadius: "10px" }} />
        <Skeleton style={{ width: "100%", height: "80px", marginBottom: "12px", borderRadius: "10px" }} />
      </div>
    );
  }
  if (error) return <div className="error-banner">{error}</div>;
  if (rows.length === 0) {
    return (
      <div className="empty-state-card">
        <h2>No timeline changes recorded</h2>
        <p>No new evidence alterations or source contradictions have been logged for this school.</p>
      </div>
    );
  }

  return (
    <div className="changes-tab-container">
      <div className="timeline-header">
        <span className="section-kicker">Audit Trail</span>
        <h2>Evidence Evolution Timeline</h2>
        <p className="section-lead">
          Chronological log of newly crawled records, verified modifications, and source discrepancies detected across public crawls.
        </p>
      </div>

      <div className="change-timeline-list">
        {rows.map((row) => {
          const type = normalizeChangeType(row.change_type);
          return (
            <div key={row.id} className="change-timeline-item">
              <div className="timeline-item-header">
                <span className={`change-chip change-chip-${type}`}>
                  <ChangeIcon type={type} />
                  <span>{changeLabel(type)}</span>
                </span>
                {detectedLabel(row.detected_at) ? (
                  <time className="change-date-badge" dateTime={row.detected_at ?? undefined}>
                    {detectedLabel(row.detected_at)}
                  </time>
                ) : null}
              </div>
              {row.summary_text ? <p className="change-summary-text">{row.summary_text}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
