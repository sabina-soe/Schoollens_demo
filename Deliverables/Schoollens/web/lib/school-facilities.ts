export type FacilityGroup = {
  id: string;
  name: string;
  items: string[];
};

export type FacilityRecord = {
  source_url: string;
  source_label: string;
  confidence?: string;
  summary?: string;
  notes?: string[];
  groups: FacilityGroup[];
};
