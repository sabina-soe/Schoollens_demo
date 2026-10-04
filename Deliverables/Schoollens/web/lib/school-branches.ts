import type { MoeCampus, MoeRecord } from "@/lib/moe-register";

export type FeeAmountRow = {
  item: string;
  amount?: string;
  on_campus?: string;
  online?: string;
  detail?: string;
};

export type FeeCampus = {
  id: string;
  name: string;
  address?: string;
  moe_match?: string[];
  programmes?: FeeAmountRow[];
  one_time?: FeeAmountRow[];
};

export type FeePoster = {
  file?: string;
  source_url?: string;
  source_label?: string;
  label?: string;
  kicker?: string;
  lead?: string;
  confidence?: string;
  claims?: string[];
  notes?: string[];
  shared?: FeeAmountRow[];
  default_branch?: string;
  branches?: FeeCampus[];
  branch_ids?: string[];
};

export type CampusOption = {
  id: string;
  name: string;
  address?: string;
  moe_match?: string[];
};

export function campusOptionsFromPosters(posters: FeePoster[]): CampusOption[] {
  const seen = new Map<string, CampusOption>();
  for (const poster of posters) {
    for (const branch of poster.branches ?? []) {
      if (!seen.has(branch.id)) {
        seen.set(branch.id, {
          id: branch.id,
          name: branch.name,
          address: branch.address,
          moe_match: branch.moe_match,
        });
      }
    }
  }
  return [...seen.values()];
}

export function defaultCampusId(posters: FeePoster[], options: CampusOption[]) {
  const marked = posters.find((poster) => poster.default_branch)?.default_branch;
  if (marked && options.some((option) => option.id === marked)) return marked;
  const yangon = options.find((option) => /yangon/i.test(option.name) || option.id === "yangon");
  return yangon?.id || options[0]?.id || "";
}

export function postersForCampus(posters: FeePoster[], campusId: string): FeePoster[] {
  if (!campusId) return posters;
  return posters.flatMap((poster) => {
    if (poster.branches?.length) {
      const branch = poster.branches.find((item) => item.id === campusId);
      if (!branch) return [];
      return [
        {
          ...poster,
          label: `${poster.label ?? "Fees"} · ${branch.name}`,
          branches: [branch],
          claims: undefined,
        },
      ];
    }
    if (poster.branch_ids?.length) {
      return poster.branch_ids.includes(campusId) ? [poster] : [];
    }
    return [poster];
  });
}

export function selectedCampus(options: CampusOption[], campusId: string) {
  return options.find((option) => option.id === campusId) ?? options[0] ?? null;
}

export function filterMoeCampuses(record: MoeRecord | null | undefined, campus: CampusOption | null) {
  const campuses = record?.campuses ?? [];
  if (!campus?.moe_match?.length) return campuses;
  const pattern = new RegExp(campus.moe_match.join("|"), "i");
  return campuses.filter((row) => pattern.test(`${row.listed_name} ${row.address ?? ""}`));
}

