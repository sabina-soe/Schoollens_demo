import { readFile } from "node:fs/promises";
import path from "node:path";
import type { OverlayGroup } from "@/lib/claim-overlay";

const NO_EVIDENCE = "There is no verified evidence on this.";

const STOP = new Set([
  "the",
  "and",
  "for",
  "are",
  "was",
  "this",
  "that",
  "what",
  "when",
  "who",
  "how",
  "does",
  "do",
  "did",
  "about",
  "sources",
  "source",
  "say",
  "says",
  "school",
  "schools",
  "international",
]);

const CATEGORY_BOOST: Record<string, string[]> = {
  fees: ["fee", "fees", "tuition", "mmk", "usd", "cost", "semester", "kyat"],
  curriculum: ["curriculum", "igcse", "ial", "ib", "subject", "primary", "secondary"],
  cca: ["cca", "club", "sport", "music", "extracurricular"],
  facilities: ["campus", "facility", "lab", "library", "playground"],
  safety: ["safety", "safeguard", "child"],
  "class size": ["class", "size", "ratio"],
  "contact info": ["where", "location", "located", "address", "township", "street", "city", "contact", "phone", "email"],
};

const LOCATION_INTENT = ["where", "location", "located", "address", "township", "street", "city", "campus"];
const LOCATION_IN_CLAIM = ["located", "location", "address", "township", "street"];

type OverlayIndex = {
  bySchool?: Record<string, string>;
  aliases?: Record<string, string>;
};

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function overlayGroups(schoolId: string): Promise<OverlayGroup[]> {
  const root = path.join(process.cwd(), "public", "school-claims");
  const index = (await readJson<OverlayIndex>(path.join(root, "index.json"))) ?? {};
  const hub = index.aliases?.[schoolId] ?? schoolId;
  const rel = index.bySchool?.[hub] ?? `/school-claims/${hub}.json`;
  const file = path.join(root, path.basename(rel));
  const payload = await readJson<{ groups?: OverlayGroup[] }>(file);
  return payload?.groups ?? [];
}

function tokens(question: string) {
  return new Set(
    (question.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (token) => token.length > 2 && !STOP.has(token),
    ),
  );
}

function isLocationQuestion(question: string, needle: Set<string>) {
  const lower = ` ${question.toLowerCase()} `;
  return LOCATION_INTENT.some((token) => needle.has(token) || lower.includes(` ${token} `));
}

function looksLikeLocation(blob: string) {
  return LOCATION_IN_CLAIM.some((token) => blob.includes(token));
}

export async function localAsk(schoolId: string, question: string) {
  const groups = await overlayGroups(schoolId);
  const needle = tokens(question);
  const locationQuestion = isLocationQuestion(question, needle);
  const scored = groups
    .map((group) => {
      const texts = (group.claims ?? []).map((claim) => claim.claim_text || "").filter(Boolean);
      const blob = [group.category, group.reconciliation_note, ...texts].join(" ").toLowerCase();
      let score = 0;
      for (const token of needle) {
        if (blob.includes(token)) score += 2;
        if (token === "location" && blob.includes("located")) score += 4;
        if (token === "where" && blob.includes("located")) score += 4;
      }
      const extra = CATEGORY_BOOST[group.category ?? ""];
      if (extra?.some((token) => needle.has(token) || (locationQuestion && extra.includes("located")))) {
        score += 3;
      }
      if (locationQuestion) {
        if (looksLikeLocation(blob)) score += 8;
        else score = 0;
      }
      return { group, texts, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (!scored.length) {
    return { answer: NO_EVIDENCE, cited_claim_group_ids: [] as string[] };
  }

  const cited: string[] = [];
  const sentences: string[] = [];
  for (const row of scored.slice(0, 4)) {
    if (!row.texts[0]) continue;
    cited.push(row.group.id);
    sentences.push(`${row.texts[0]} (${row.group.confidence_label || "unknown"})`);
  }
  return {
    answer: sentences.length ? `From the retrieved evidence: ${sentences.join(" ")}` : NO_EVIDENCE,
    cited_claim_group_ids: cited,
  };
}
