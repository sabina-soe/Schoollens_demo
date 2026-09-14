import { normalizeConfidence, type ConfidenceLabel } from "@/lib/confidence";

const ICONS: Record<ConfidenceLabel, string> = {
  supported: "✓",
  likely: "~",
  conflicting: "⨯",
  outdated: "◷",
  unknown: "?",
};

export function ConfidenceChip({ label }: { label: string | null | undefined }) {
  const value = normalizeConfidence(label);
  const text =
    value === "supported"
      ? "Supported"
      : value === "likely"
        ? "Likely"
        : value === "conflicting"
          ? "Conflicting"
          : value === "outdated"
            ? "Outdated"
            : "Unknown";
  return (
    <span className={`confidence-chip confidence-chip-${value}`}>
      <span className="confidence-chip-icon" aria-hidden="true">
        {ICONS[value]}
      </span>
      <span>{text}</span>
    </span>
  );
}
