export const CITIES: string[] = [
  "Yangon",
  "Mandalay",
  "Naypyidaw",
  "Taunggyi",
  "Mawlamyine",
  "Pathein",
  "Other",
];

const SEARCH_CITIES = [
  "Yangon",
  "Mandalay",
  "Naypyidaw",
  "Taunggyi",
  "Mawlamyine",
  "Pathein",
  "Bago",
  "Pyin Oo Lwin",
  "Monywa",
  "Magway",
  "Sittwe",
  "Myitkyina",
  "Lashio",
  "Hpa-An",
  "Dawei",
] as const;

const YANGON_TOWNSHIPS = [
  "Ahlone",
  "Bahan",
  "Botataung",
  "Dagon",
  "Dagon Seikkan",
  "Dala",
  "Dawbon",
  "East Dagon",
  "Hlaing",
  "Hlaingthaya",
  "Insein",
  "Kamayut",
  "Kyauktada",
  "Kyimyindaing",
  "Lanmadaw",
  "Latha",
  "Mayangone",
  "Mingaladon",
  "Mingala Taungnyunt",
  "North Dagon",
  "North Okkalapa",
  "Pazundaung",
  "Sanchaung",
  "Shwepyithar",
  "South Dagon",
  "South Okkalapa",
  "Tamwe",
  "Thaketa",
  "Thingangyun",
  "Twante",
  "Yankin",
  "West Dagon",
] as const;

const MANDALAY_TOWNSHIPS = [
  "Amarapura",
  "Aungmyaythazan",
  "Chanayethazan",
  "Chanmyathazi",
  "Maha Aungmyay",
  "Patheingyi",
  "Pyigyidagun",
] as const;

const PLACE_ALIASES: Record<string, string[]> = {
  Naypyidaw: ["Nay Pyi Taw", "Naypyitaw"],
  Hlaingthaya: ["Hlaing Tharyar", "Hlaingtharyar"],
  Mayangone: ["Mayangon"],
  "Mingala Taungnyunt": ["Mingalar Taungnyunt"],
  Shwepyithar: ["Shwe Pyi Thar"],
  "Pyin Oo Lwin": ["Pyinoolwin", "Maymyo"],
  "Hpa-An": ["Hpa An", "Pa-An"],
  "Maha Aungmyay": ["Mahaaungmyay", "Mahar Aungmyay"],
};

export type PlaceOption = {
  value: string;
  group: "city" | "township";
};

export const PLACE_OPTIONS: PlaceOption[] = [
  ...SEARCH_CITIES.map((value) => ({ value, group: "city" as const })),
  ...YANGON_TOWNSHIPS.map((value) => ({ value, group: "township" as const })),
  ...MANDALAY_TOWNSHIPS.map((value) => ({ value, group: "township" as const })),
];

export function mergePlaceOptions(extraPlaces: string[] = []): PlaceOption[] {
  const seen = new Set(PLACE_OPTIONS.map((item) => item.value.toLowerCase()));
  const extras: PlaceOption[] = [];
  for (const place of extraPlaces) {
    const value = place.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    extras.push({ value, group: "township" });
  }
  return extras.length ? [...PLACE_OPTIONS, ...extras] : PLACE_OPTIONS;
}

export function filterPlaceOptions(options: PlaceOption[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return options;
  return options.filter((item) => {
    if (item.value.toLowerCase().includes(needle)) return true;
    return (PLACE_ALIASES[item.value] ?? []).some((alias) => alias.toLowerCase().includes(needle));
  });
}

export function placeMatchesAddress(address: string | null | undefined, place: string) {
  if (!address || !place.trim()) return false;
  const hay = address.toLowerCase();
  const variants = [place, ...(PLACE_ALIASES[place] ?? [])];
  return variants.some((item) => hay.includes(item.toLowerCase()));
}
