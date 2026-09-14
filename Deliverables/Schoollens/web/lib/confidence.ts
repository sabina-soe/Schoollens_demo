export const CONFIDENCE_LABELS = [
  "supported",
  "likely",
  "conflicting",
  "outdated",
  "unknown",
] as const;

export type ConfidenceLabel = (typeof CONFIDENCE_LABELS)[number];

export function normalizeConfidence(value: string | null | undefined): ConfidenceLabel {
  const label = String(value || "unknown").toLowerCase();
  return (CONFIDENCE_LABELS as readonly string[]).includes(label)
    ? (label as ConfidenceLabel)
    : "unknown";
}

export function sourceTag(sourceType: string | null | undefined, trustTier: string | null | undefined) {
  const type = String(sourceType || "").toLowerCase();
  const tier = String(trustTier || "").toLowerCase();
  if (type === "moe" || tier === "moe") return "MOE Registry";
  if (type === "website" || tier === "official_website") return "Official Website";
  if (type === "fb_page" || tier === "official_facebook") return "Official Facebook";
  if (type === "fb_group" || tier === "community") return "Parent Review";
  return "Parent Review";
}

export const CATEGORY_SECTIONS = [
  { key: "curriculum", title: "Academics", id: "academics" },
  { key: "fees", title: "Fees", id: "fees" },
  { key: "class size", title: "Class size", id: "class-size" },
  { key: "safety", title: "Culture & Safety", id: "culture-safety" },
  { key: "facilities", title: "Facilities", id: "facilities" },
  { key: "contact info", title: "Contact", id: "contact" },
] as const;

export function categoryTitle(category: string | null | undefined) {
  const key = String(category || "").toLowerCase();
  return CATEGORY_SECTIONS.find((section) => section.key === key)?.title ?? (category || "Other");
}

export function categoryId(category: string | null | undefined) {
  const key = String(category || "").toLowerCase();
  return CATEGORY_SECTIONS.find((section) => section.key === key)?.id ?? "other";
}

export function extractNumericStat(claimText: string) {
  const match = claimText.match(/^(\d[\d,]*(?:\+|(?:\s*:\s*\d+))?)\s+(.+)$/);
  if (!match) return null;
  return { value: match[1].replace(/\s+/g, ""), label: match[2] };
}

export function freshnessLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
  if (days === 0) return "last confirmed: today";
  if (days === 1) return "last confirmed: 1 day ago";
  return `last confirmed: ${days} days ago`;
}
