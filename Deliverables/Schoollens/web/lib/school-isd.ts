export type IsdRecord = {
  source_name: string;
  source_url: string;
  source_updated?: string | null;
  isd_slug?: string;
  isd_list_order?: number | null;
  name?: string;
  address?: string | null;
  ages?: string | null;
  student_count?: number | null;
  curriculum?: string[];
  average_class_size?: string | null;
  maximum_class_size?: string | null;
  languages?: string[];
  extra_languages?: string | null;
  programmes?: string[];
  yearly_fees?: string | null;
  official_website_url?: string | null;
};

export type IsdFact = {
  label: string;
  value: string;
};

export function isdFacts(record: IsdRecord): IsdFact[] {
  const facts: IsdFact[] = [];
  if (record.curriculum?.length) facts.push({ label: "Curriculum", value: record.curriculum.join(", ") });
  if (record.ages) facts.push({ label: "Ages", value: record.ages.replace("-", " to ") });
  if (record.student_count) facts.push({ label: "Students", value: String(record.student_count) });
  if (record.average_class_size || record.maximum_class_size) {
    const parts = [
      record.average_class_size ? `average ${record.average_class_size}` : null,
      record.maximum_class_size ? `maximum ${record.maximum_class_size}` : null,
    ].filter(Boolean);
    facts.push({ label: "Class size", value: parts.join(" · ") });
  }
  if (record.languages?.length) facts.push({ label: "Language of instruction", value: record.languages.join(", ") });
  if (record.extra_languages) facts.push({ label: "Other languages", value: record.extra_languages });
  if (record.programmes?.length) facts.push({ label: "Programmes", value: record.programmes.join(", ") });
  if (record.yearly_fees) facts.push({ label: "Yearly fees (ISD)", value: record.yearly_fees });
  if (record.address) facts.push({ label: "Address", value: record.address });
  return facts;
}
