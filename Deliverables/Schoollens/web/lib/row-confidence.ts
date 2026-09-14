import { normalizeConfidence, type ConfidenceLabel } from "./confidence";

const CONCERN: Record<ConfidenceLabel, number> = {
  conflicting: 0,
  unknown: 1,
  outdated: 2,
  likely: 3,
  supported: 4,
};

export function headlineConfidence(labels: Array<string | null | undefined>): ConfidenceLabel {
  if (!labels.length) return "unknown";
  return labels
    .map((label) => normalizeConfidence(label))
    .sort((a, b) => CONCERN[a] - CONCERN[b])[0];
}
