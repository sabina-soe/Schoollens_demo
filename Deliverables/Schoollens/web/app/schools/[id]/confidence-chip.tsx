import { normalizeConfidence, type ConfidenceLabel } from "@/lib/confidence";

function ConfidenceIcon({ value }: { value: ConfidenceLabel }) {
  switch (value) {
    case "supported":
      return (
        <svg className="confidence-chip-svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 8.2L7 10.2L11 5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "likely":
      return (
        <svg className="confidence-chip-svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
          <path d="M5 8.2L7 10.2L11 5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "conflicting":
      return (
        <svg className="confidence-chip-svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "outdated":
      return (
        <svg className="confidence-chip-svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 4.5V8.5L10.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "unknown":
    default:
      return (
        <svg className="confidence-chip-svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6.5 6.2C6.5 5.3 7.2 4.8 8 4.8C8.8 4.8 9.5 5.3 9.5 6.1C9.5 7 8.5 7.4 8.5 8.2V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="11" r="0.75" fill="currentColor" />
        </svg>
      );
  }
}

const LABELS: Record<ConfidenceLabel, string> = {
  supported: "Supported",
  likely: "Likely",
  conflicting: "Conflicting",
  outdated: "Outdated",
  unknown: "Unknown",
};

export function ConfidenceChip({
  label,
  size = "md",
  showLabel = true,
}: {
  label: string | null | undefined;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}) {
  const value = normalizeConfidence(label);
  const text = LABELS[value];
  return (
    <span className={`confidence-chip confidence-chip-${value} confidence-chip-${size}`} title={`Confidence: ${text}`}>
      <span className="confidence-chip-icon" aria-hidden="true">
        <ConfidenceIcon value={value} />
      </span>
      {showLabel ? <span className="confidence-chip-text">{text}</span> : null}
    </span>
  );
}
