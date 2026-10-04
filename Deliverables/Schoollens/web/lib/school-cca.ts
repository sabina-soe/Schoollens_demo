export type CcaGroup = {
  id: string;
  name: string;
  items: string[];
};

export type CcaRecord = {
  source_url: string;
  source_label: string;
  confidence?: string;
  summary?: string;
  skills?: string[];
  groups: CcaGroup[];
};
