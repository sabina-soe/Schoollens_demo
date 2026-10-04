const STOP_WORDS = new Set(["the", "of", "and", "a", "an", "at", "in", "for"]);

const SCHOOL_SEARCH_ALIASES: Record<string, string[]> = {
  "b0595924-73f7-49c4-94b0-b05017d77ef8": [
    "ISY",
    "International School Yangon",
    "The International School Yangon",
    "International School Rangoon",
  ],
  "038e4ef9-a8a3-4dca-9ea9-aad223fc71c5": ["YIS", "Yangon International School"],
  "6d0e010f-b869-4350-ae90-5a30f531d22d": ["MISY", "Myanmar International School Yangon"],
  "4dd4da53-4a6f-4bac-aca9-0fd9955e8bfc": ["MIS", "Myanmar International School"],
  "d286f5bb-2db7-5108-aca0-b7f742cdf56a": ["YAIS", "Yangon American", "Yangon American International School"],
};

export function schoolMatchesQuery(
  school: { id?: string; name: string; address?: string | null },
  query: string,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const aliases = SCHOOL_SEARCH_ALIASES[school.id ?? ""] ?? [];
  const haystack = `${school.name} ${school.address ?? ""} ${aliases.join(" ")}`.toLowerCase();
  if (haystack.includes(needle)) return true;
  const tokens = needle.split(/[^a-z0-9]+/).filter((token) => token && !STOP_WORDS.has(token));
  if (!tokens.length) return false;
  return tokens.every((token) => hasWholeToken(haystack, token));
}

function hasWholeToken(haystack: string, token: string) {
  const pattern = new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`);
  return pattern.test(haystack);
}
