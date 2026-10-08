export type ParentClaimInput = {
  category?: string | null;
  confidence_label?: string | null;
  reconciliation_note?: string | null;
  claim_texts?: string[];
  source_url?: string | null;
  claim_group_id?: string | null;
};

const PARENT_CATEGORIES = new Set([
  "fees",
  "tuition",
  "curriculum",
  "academics",
  "academic",
  "academic outcomes",
  "outcomes",
  "results",
  "location",
  "address",
  "campus",
  "facilities",
  "facility",
  "cca",
  "extra-curricular",
  "extracurricular",
  "co-curricular",
  "teacher",
  "teachers",
  "teacher quality",
  "staff",
  "class size",
  "safety",
]);

const EVENT_NOISE =
  /learning showcase|open house|open day|sports day|concert|carnival|fun\s*fair|prize[- ]giving|graduation (night|party)|held on \d|organised for .{0,80}on \d|organized for .{0,80}on \d|event at the .{0,40}campus/i;

const CONTACT_HANDLE = /@|\bemail\b|\bphone\b|\btel\b|\bhotline\b|\bwhatsapp\b/i;
const PLACE_FACT = /\baddress\b|\btownship\b|\bstreet\b|\broad\b|\bhousing\b|\bno\.?\s*\d/i;
const PLACEHOLDER_NOTE = /only one extracted claim|gemini reconciliation did not return/i;
const CCA_FACT = /\bcca\b|extra-?curricular|co-curricular|field trip|outdoor activit/i;

function blob(item: ParentClaimInput) {
  return [item.reconciliation_note, ...(item.claim_texts ?? [])].filter(Boolean).join(" ");
}

function isEmailOnly(text: string) {
  return CONTACT_HANDLE.test(text) && !PLACE_FACT.test(text);
}

export function isParentDecisionTopic(item: ParentClaimInput) {
  const category = String(item.category || "").toLowerCase().trim();
  const text = blob(item);

  if (EVENT_NOISE.test(text)) return false;
  if (isEmailOnly(text)) return false;

  if (category === "contact info" || category === "contact") {
    return PLACE_FACT.test(text);
  }

  if (PARENT_CATEGORIES.has(category)) return true;

  return (
    /\b(fee|tuition|curriculum|igcse|ial|ib\b|facility|facilities|location|township|teacher|class size|cca)\b/i.test(
      text,
    ) && !EVENT_NOISE.test(text)
  );
}

export function isParentVerifyItem(item: ParentClaimInput) {
  if (!isParentDecisionTopic(item)) return false;
  if (PLACEHOLDER_NOTE.test(item.reconciliation_note || "")) return false;
  const label = String(item.confidence_label || "").toLowerCase();
  return label === "conflicting" || label === "outdated";
}

export function parentCategoryTitle(item: ParentClaimInput) {
  const category = String(item.category || "").toLowerCase().trim();
  const text = blob(item);
  if ((category === "contact info" || category === "contact") && PLACE_FACT.test(text)) {
    return "Location";
  }
  if (category === "curriculum" && CCA_FACT.test(text)) return "CCA";
  if (category === "curriculum") return "Curriculum";
  if (category === "fees" || category === "tuition") return "Fees";
  if (category === "facilities" || category === "facility") return "Facilities";
  if (category === "class size") return "Class size";
  if (category.includes("teacher")) return "Teacher quality";
  if (category.includes("outcome") || category === "results") return "Academic outcomes";
  if (category === "cca" || category.includes("curricular")) return "CCA";
  if (category === "location" || category === "address" || category === "campus") return "Location";
  return item.category || "Key fact";
}

export function parentVerifyItems<T extends ParentClaimInput>(items: T[] | null | undefined) {
  return (items ?? []).filter(isParentVerifyItem);
}
