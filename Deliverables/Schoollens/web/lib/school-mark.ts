const STOP = new Set([
  "the",
  "of",
  "and",
  "at",
  "for",
  "a",
  "an",
  "in",
  "to",
  "school",
  "schools",
  "international",
  "campus",
  "private",
  "myanmar",
]);

const GENERIC_PAREN = new Set(["IS", "INTL"]);

const LOGO_BY_ID: Record<string, string> = {
  "b0595924-73f7-49c4-94b0-b05017d77ef8": "/school-logos/isy.svg",
  "f6c7b97d-8959-4d0c-841f-8148d10dcd4d": "/school-logos/ilbc.png",
  "d1e8deee-ed2c-43fb-a382-c3adb5d06861": "/school-logos/pism.png",
  "ba3c6f02-961b-42e1-8ef9-21d872abbda7": "/school-logos/kings.png",
  "5d88ea9c-c422-4696-88f3-5f2afb315530": "/school-logos/helix.png",
};

const LOGO_BY_GROUP: Record<string, string> = {
  "aaf8ab28-d86b-5a86-86d6-7a7fbd4d9591": "/school-logos/ilbc.png",
};

export function schoolInitials(name: string) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "?";

  const paren = trimmed.match(/\(([A-Za-z][A-Za-z0-9.&-]{1,8})\)\s*$/);
  if (paren && !GENERIC_PAREN.has(paren[1].toUpperCase())) {
    return paren[1].toUpperCase();
  }

  const tokens = trimmed.split(/[\s/|,]+/).filter(Boolean);
  const caps = tokens
    .map((token) => token.replace(/[^A-Za-z0-9]/g, ""))
    .filter((token) => /^[A-Z]{2,8}$/.test(token) && !STOP.has(token.toLowerCase()));
  if (caps[0]) return caps[0];

  const significant = tokens.filter((token) => {
    const word = token.replace(/[^A-Za-z]/g, "").toLowerCase();
    return word.length > 0 && !STOP.has(word) && !token.startsWith("(");
  });
  if (significant.length === 1) {
    const word = significant[0].replace(/[^A-Za-z]/g, "");
    return word.slice(0, 6).toUpperCase() || trimmed.slice(0, 4).toUpperCase();
  }
  const letters = significant
    .map((token) => token.replace(/[^A-Za-z]/g, "")[0] || "")
    .join("")
    .toUpperCase();
  if (letters.length >= 2) return letters.slice(0, 4);
  return trimmed.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "?";
}

export function schoolLogoSrc(school: {
  id?: string | null;
  school_group_id?: string | null;
  name?: string | null;
}) {
  if (school.id && LOGO_BY_ID[school.id]) return LOGO_BY_ID[school.id];
  if (school.school_group_id && LOGO_BY_GROUP[school.school_group_id]) {
    return LOGO_BY_GROUP[school.school_group_id];
  }
  const name = school.name || "";
  if (/^ILBC\b/i.test(name)) return "/school-logos/ilbc.png";
  if (/\(ISY\)/i.test(name) || /^the international school yangon\b/i.test(name)) {
    return "/school-logos/isy.svg";
  }
  if (/\bpride ism\b|\bpism\b/i.test(name)) return "/school-logos/pism.png";
  if (/^kings international school\b/i.test(name)) return "/school-logos/kings.png";
  if (/^helix\b/i.test(name)) return "/school-logos/helix.png";
  return null;
}
