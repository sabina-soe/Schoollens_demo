import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { OverlayGroup } from "@/lib/claim-overlay";
import type { ExtractedClaim } from "@/lib/gemini-extract";

const KEEP = new Set([
  "b0595924-73f7-49c4-94b0-b05017d77ef8",
  "f6c7b97d-8959-4d0c-841f-8148d10dcd4d",
  "d1e8deee-ed2c-43fb-a382-c3adb5d06861",
  "ba3c6f02-961b-42e1-8ef9-21d872abbda7",
  "5d88ea9c-c422-4696-88f3-5f2afb315530",
]);

function claimsDir() {
  return path.join(process.cwd(), "public", "school-claims");
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) return fallback;
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function claimsToGroups(schoolId: string, claims: ExtractedClaim[]): OverlayGroup[] {
  const now = new Date().toISOString();
  return claims.map((claim) => {
    const claimId = randomUUID();
    const groupId = randomUUID();
    return {
      id: groupId,
      school_id: schoolId,
      category: claim.category,
      confidence_label: "likely",
      reconciliation_note: "Official website. One source, so the label is likely, not independently corroborated.",
      last_updated: now,
      claims: [
        {
          id: claimId,
          claim_text: claim.claim_text,
          category: claim.category,
          source_type: "website",
          source_trust_tier: "official_website",
          created_at: now,
        },
      ],
      evidence: [
        {
          claim_id: claimId,
          source_excerpt: claim.source_excerpt,
          evidence_type: "webpage",
          uploaded_at: now,
          original_url: claim.source_url ?? null,
        },
      ],
    };
  });
}

export function writeClaimOverlay(schoolId: string, claims: ExtractedClaim[]) {
  if (process.env.VERCEL || !claims.length) return 0;
  const dir = claimsDir();
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${schoolId}.json`);
  const incoming = claimsToGroups(schoolId, claims);
  const existing = readJson<{ school_id?: string; groups?: OverlayGroup[] }>(file, { school_id: schoolId, groups: [] });
  const prior = KEEP.has(schoolId) ? existing.groups ?? [] : [];
  const groups = [...incoming, ...prior.filter((group) => !incoming.some((row) => row.id === group.id))];
  writeFileSync(file, JSON.stringify({ school_id: schoolId, groups }, null, 2), "utf8");

  const indexFile = path.join(dir, "index.json");
  const index = readJson<{
    bySchool?: Record<string, string>;
    aliases?: Record<string, string>;
    counts?: Record<string, number>;
  }>(indexFile, {});
  index.bySchool = { ...(index.bySchool ?? {}), [schoolId]: `/school-claims/${schoolId}.json` };
  index.aliases = { ...(index.aliases ?? {}), [schoolId]: schoolId };
  const registerFile = path.join(process.cwd(), "public", "demo-register", "schools.json");
  const register = readJson<{ schools?: { id: string; school_group_id?: string | null; name?: string }[] }>(
    registerFile,
    {},
  );
  const current = register.schools?.find((row) => row.id === schoolId);
  if (current?.school_group_id) {
    for (const row of register.schools ?? []) {
      if (row.school_group_id === current.school_group_id) index.aliases![row.id] = schoolId;
    }
  }
  writeFileSync(indexFile, JSON.stringify(index, null, 2), "utf8");
  return incoming.length;
}
