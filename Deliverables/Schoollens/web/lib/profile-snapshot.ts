export type ProfileStat = {
  label?: string;
  value?: string;
};

export type ProfileFact = {
  label: string;
  value: string;
};

const FACT_LABEL = /curriculum|location|address|hours|class size|programme|program\b/i;
const SNAPSHOT_LABEL = /population|nationalit|acceptance|pass rate|enrol|students|rate/i;

function classify(item: ProfileFact): "snapshot" | "fact" {
  if (FACT_LABEL.test(item.label)) return "fact";
  if (/%/.test(item.value) || SNAPSHOT_LABEL.test(item.label)) return "snapshot";
  return item.value.length <= 36 ? "snapshot" : "fact";
}

export function splitProfileStats(stats: ProfileStat[]) {
  const clean = stats.filter((item): item is ProfileFact => Boolean(item.label && item.value));
  const snapshots: ProfileFact[] = [];
  const facts: ProfileFact[] = [];
  for (const item of clean) {
    (classify(item) === "snapshot" ? snapshots : facts).push(item);
  }
  if (snapshots.length < 2) {
    return { snapshots: [] as ProfileFact[], facts: clean };
  }
  return { snapshots, facts };
}

export function profileLead(summary: string, hasStats: boolean) {
  const text = summary.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (!hasStats) return text;
  const sentence = text.match(/^[^.!?]+[.!?]/);
  return (sentence?.[0] || text).trim();
}
