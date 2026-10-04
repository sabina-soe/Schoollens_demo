import { parentCategoryTitle, type ParentClaimInput } from "@/lib/parent-claims";
import { sourceTag } from "@/lib/confidence";

export type ConflictSide = {
  value: string;
  source: string;
};

export type ConflictVisual = {
  check: string;
  differsOn: string;
  sides: ConflictSide[];
  shared: string | null;
};

export type LiveConflictSide = {
  claim_text?: string | null;
  source_type?: string | null;
  source_trust_tier?: string | null;
};

function clean(value: string) {
  return value
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/[.,;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseFact(value: string) {
  const text = clean(value);
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "This fact";
}

function splitNamedList(chunk: string) {
  return chunk
    .split(/\s*,\s*(?:and\s+)?|\s+and\s+/i)
    .map(clean)
    .filter((item) => item.length > 2);
}

function sourceFromNote(note: string) {
  if (/official website/i.test(note)) return "Official Website";
  if (/official facebook|facebook page/i.test(note)) return "Official Facebook";
  if (/\bmoe\b|ministry of education/i.test(note)) return "MOE Registry";
  return "Listing";
}

function parseSidesFromNote(note: string): string[] {
  const both = note.match(/listing both\s+(.+)\s+and\s+(.+?)\.?$/i);
  if (both) return [clean(both[1]), clean(both[2])].filter(Boolean);

  const whilePair = note.match(
    /lists(?: the| a different)? address(?: in)?\s+([^,.]+).+?lists(?: the| a different)? address(?: in)?\s+([^,.]+)/i,
  );
  if (whilePair) return [clean(whilePair[1]), clean(whilePair[2])].filter(Boolean);

  const colon = note.match(/:\s*([^:]+)$/);
  if (colon && /campus|preschool|township|street|road/i.test(colon[1])) {
    const items = splitNamedList(colon[1]);
    if (items.length >= 2) return items;
  }

  return [];
}

function differsOnFromNote(note: string) {
  if (/street address/i.test(note)) return "Street address";
  if (/township|school address/i.test(note)) return "Township";
  if (/campus/i.test(note)) return "Campus";
  if (/\bfee|tuition/i.test(note)) return "Fee";
  const match = note.match(/disagree on (?:the )?([^.,]+)/i);
  return match ? titleCaseFact(match[1]) : "This fact";
}

function checkFromNote(note: string, item: ParentClaimInput) {
  if (/outdoor activit|field trip/i.test(note)) {
    return "Confirm which campus offers preschool outdoor activities and field trips.";
  }
  const place = note.match(/street address within\s+([^.,]+)/i);
  if (place) return `Confirm the street address in ${clean(place[1])}.`;
  if (/school address/i.test(note)) return "Confirm the current school address before you visit.";
  const disagree = note.match(/disagree on (?:the )?([^.,]+)/i);
  if (disagree) return `Confirm ${clean(disagree[1])}.`;
  return `Confirm the ${parentCategoryTitle(item).toLowerCase()} before you decide.`;
}

function labelRepeatedSources(sides: ConflictSide[]) {
  const counts = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const side of sides) counts.set(side.source, (counts.get(side.source) ?? 0) + 1);
  return sides.map((side) => {
    const total = counts.get(side.source) ?? 1;
    if (total <= 1) return side;
    const index = (seen.get(side.source) ?? 0) + 1;
    seen.set(side.source, index);
    if (side.source === "Listing") return { ...side, source: `Listing ${index}` };
    return { ...side, source: `${side.source} · ${index}` };
  });
}

function uniqueSides(sides: ConflictSide[]) {
  const seen = new Set<string>();
  const out: ConflictSide[] = [];
  for (const side of sides) {
    const key = `${side.source}::${side.value.toLowerCase()}`;
    if (seen.has(key) || !side.value) continue;
    seen.add(key);
    out.push(side);
  }
  return out;
}

export function buildConflictVisual(
  item: ParentClaimInput,
  liveSides: LiveConflictSide[] = [],
): ConflictVisual {
  const note = item.reconciliation_note || "";
  const parsed = parseSidesFromNote(note);
  const source = sourceFromNote(note);
  const fromNote = parsed.map((value) => ({ value, source }));
  const fromLive = liveSides
    .map((side) => ({
      value: clean(side.claim_text || ""),
      source: sourceTag(side.source_type, side.source_trust_tier),
    }))
    .filter((side) => side.value);
  const sides = labelRepeatedSources(uniqueSides(fromLive.length >= 2 ? fromLive : fromNote));
  const sharedMatch = note.match(/share(?:s)? the same ([^.]+)/i);

  return {
    check: checkFromNote(note, item),
    differsOn: differsOnFromNote(note),
    sides,
    shared: sharedMatch ? titleCaseFact(sharedMatch[1]) : null,
  };
}
