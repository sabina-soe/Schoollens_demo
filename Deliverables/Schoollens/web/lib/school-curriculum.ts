export type CurriculumYear = {
  name: string;
  subjects: string[];
  optional?: string[];
  note?: string;
};

export type CurriculumStage = {
  id: string;
  name: string;
  ages?: string;
  duration?: string;
  summary: string;
  source_url: string;
  source_label: string;
  subjects?: string[];
  skills?: string[];
  hours?: string[];
  notes?: string[];
  years?: CurriculumYear[];
};

export type CurriculumRecord = {
  framework?: string;
  medium?: string;
  academic_year?: string;
  confidence?: string;
  stages: CurriculumStage[];
};

export function yearsInCurriculum(record: CurriculumRecord | null | undefined) {
  return [...new Set((record?.stages ?? []).flatMap((stage) => stage.years?.map((year) => year.name) ?? []))];
}
