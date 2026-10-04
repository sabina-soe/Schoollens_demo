import type { ReactNode } from "react";
import { ConfidenceChip } from "./confidence-chip";
import { buildConflictVisual, type LiveConflictSide } from "@/lib/conflict-display";
import { parentCategoryTitle, type ParentClaimInput } from "@/lib/parent-claims";

export function ConflictCompare({
  item,
  liveSides = [],
  compact = false,
  action,
}: {
  item: ParentClaimInput;
  liveSides?: LiveConflictSide[];
  compact?: boolean;
  action?: ReactNode;
}) {
  const visual = buildConflictVisual(item, liveSides);
  const heading = compact ? "h3" : "h2";
  const CheckTag = heading;

  return (
    <div className={`conflict-compare ${compact ? "conflict-compare-compact" : ""}`}>
      <div className="conflict-compare-top">
        <span className="verify-category-tag">{parentCategoryTitle(item)}</span>
        <ConfidenceChip label={item.confidence_label || "conflicting"} size="sm" />
      </div>

      <p className="conflict-check-kicker">What to check</p>
      <CheckTag className="conflict-check-title">{visual.check}</CheckTag>

      {visual.sides.length ? (
        <>
          <p className="conflict-differs-label">Sources differ on {visual.differsOn.toLowerCase()}</p>
          <div className="conflict-compare-row">
            {visual.sides.map((side, index) => (
              <div key={`${side.source}-${side.value}`} className="conflict-compare-pair">
                {index > 0 ? <span className="conflict-vs">vs</span> : null}
                <article className="conflict-compare-pane">
                  <p className="conflict-source-label">{side.source}</p>
                  <p className="conflict-source-value">{side.value}</p>
                </article>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="verify-note">{item.reconciliation_note || "Sources disagree."}</p>
      )}

      {visual.shared ? <p className="conflict-shared">Same on both listings: {visual.shared}</p> : null}

      <p className="conflict-footnote">SchoolLens does not pick which source is correct.</p>
      {action}
    </div>
  );
}
