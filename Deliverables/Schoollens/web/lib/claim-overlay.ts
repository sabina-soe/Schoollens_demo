import { networkIds } from "@/lib/school-network";
import type { RegisterSchool } from "@/lib/public-register";

export type OverlayClaim = {
  id: string;
  claim_text: string | null;
  category: string | null;
  source_type: string | null;
  source_trust_tier: string | null;
  created_at?: string | null;
};

export type OverlayEvidence = {
  claim_id: string;
  source_excerpt: string | null;
  evidence_type?: string | null;
  uploaded_at?: string | null;
  original_url?: string | null;
};

export type OverlayGroup = {
  id: string;
  school_id: string;
  category: string | null;
  confidence_label: string | null;
  reconciliation_note: string | null;
  last_updated: string | null;
  claims: OverlayClaim[];
  evidence: OverlayEvidence[];
};

type OverlayIndex = {
  bySchool?: Record<string, string>;
  aliases?: Record<string, string>;
};

const ILBC_HUB = "f6c7b97d-8959-4d0c-841f-8148d10dcd4d";
const DEMO_HUBS = [
  { test: /ilbc/i, id: ILBC_HUB },
  { test: /international school yangon|\bisy\b/i, id: "b0595924-73f7-49c4-94b0-b05017d77ef8" },
  { test: /pride|pism/i, id: "d1e8deee-ed2c-43fb-a382-c3adb5d06861" },
  { test: /kings international|kis-mm/i, id: "ba3c6f02-961b-42e1-8ef9-21d872abbda7" },
  { test: /helix/i, id: "5d88ea9c-c422-4696-88f3-5f2afb315530" },
];

export function localNetworkIds(schoolId: string, localSchools: RegisterSchool[], schoolName?: string | null) {
  const current = localSchools.find((school) => school.id === schoolId);
  const siblings = current?.school_group_id
    ? localSchools.filter((school) => school.school_group_id === current.school_group_id)
    : current
      ? [current]
      : [];
  const ids = networkIds(schoolId, siblings);
  const name = schoolName || current?.name || "";
  for (const hub of DEMO_HUBS) {
    if (hub.test.test(name) || ids.includes(hub.id)) ids.push(hub.id);
  }
  return [...new Set(ids)];
}

async function readIndex(): Promise<OverlayIndex> {
  try {
    const response = await fetch("/school-claims/index.json", { cache: "no-store" });
    if (response.ok) return (await response.json()) as OverlayIndex;
  } catch {
    return {};
  }
  return {};
}

async function readOverlayFiles(files: string[]) {
  const merged: OverlayGroup[] = [];
  const seen = new Set<string>();
  await Promise.all(
    files.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { groups?: OverlayGroup[] };
        for (const group of payload.groups ?? []) {
          if (seen.has(group.id)) continue;
          seen.add(group.id);
          merged.push(group);
        }
      } catch {
        return;
      }
    }),
  );
  return merged;
}

export async function loadKnownClaimOverlays() {
  const index = await readIndex();
  const files = Object.values(index.bySchool ?? {});
  return { groups: await readOverlayFiles(files), index };
}

export async function loadClaimOverlay(ids: string[]): Promise<OverlayGroup[]> {
  const index = await readIndex();
  const files = new Set<string>();
  for (const id of ids) {
    const target = index.aliases?.[id] ?? id;
    if (index.bySchool?.[target]) files.add(index.bySchool[target]);
    else if (index.bySchool?.[id]) files.add(index.bySchool[id]);
    else if (ids.length <= 20) files.add(`/school-claims/${target}.json`);
  }
  if (!files.size) {
    return (await loadKnownClaimOverlays()).groups.filter((group) =>
      ids.some((id) => id === group.school_id || index.aliases?.[id] === group.school_id),
    );
  }

  return readOverlayFiles([...files]);
}

export function overlayLabels(groups: OverlayGroup[]) {
  const next: Record<string, string[]> = {};
  for (const group of groups) {
    const list = next[group.school_id] ?? [];
    list.push(group.confidence_label ?? "unknown");
    next[group.school_id] = list;
  }
  return next;
}
