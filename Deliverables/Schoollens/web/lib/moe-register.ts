export type MoeCampus = {
  moe_index: string;
  listed_name: string;
  address: string | null;
  period: string | null;
  moe_approved_from: string | null;
  moe_approved_to: string | null;
};

export type MoeRecord = {
  campus_count: number;
  moe_approved_from: string | null;
  moe_approved_to: string | null;
  period: string | null;
  campuses: MoeCampus[];
};

export function moeBadgeLabel(record?: MoeRecord | null, fallbackRange?: string) {
  if (record?.campus_count) {
    return record.campus_count === 1 ? "MOE registered" : `MOE registered · ${record.campus_count} campuses`;
  }
  return fallbackRange ? "MOE registered" : "";
}

export function moeRangeLabel(record?: MoeRecord | null, fallbackRange?: string) {
  if (record?.campus_count && record.campus_count > 1) {
    return `${record.campus_count} township listings`;
  }
  return record?.period || fallbackRange || "";
}
