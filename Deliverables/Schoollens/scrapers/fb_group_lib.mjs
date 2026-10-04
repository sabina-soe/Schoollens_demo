import fs from "node:fs";

export const GROUP_SOURCES = {
  "237771859200599": {
    url: "https://www.facebook.com/groups/237771859200599",
    label: "International School Review Myanmar",
  },
  "750140393284324": {
    url: "https://www.facebook.com/groups/750140393284324",
    label: "International School Review (မိဘများရင်ဖွင့်ရာ)",
  },
};

export const EXTRA_ALIASES = {
  "f6c7b97d-8959-4d0c-841f-8148d10dcd4d": ["ilbc"],
  "ba3c6f02-961b-42e1-8ef9-21d872abbda7": ["kings international", "kings pun hlaing", "punhlaing", "pun hlaing kings"],
  "3f96414d-5543-45ee-85da-16856c784bbe": ["kings yangon", "kings bahan"],
  "038e4ef9-a8a3-4dca-9ea9-aad223fc71c5": ["yangon international school", " yis "],
  "4dd4da53-4a6f-4bac-aca9-0fd9955e8bfc": ["myanmar international school"],
  "22b3784f-3e04-4153-80e0-abe3000fe273": ["british school yangon", " bsy "],
  "6c78977f-de06-4078-bbd2-570e303276ae": ["network international"],
  "d1e8deee-ed2c-43fb-a382-c3adb5d06861": ["pride international", " pism "],
  "b0595924-73f7-49c4-94b0-b05017d77ef8": ["international school yangon", " isy "],
  "6d0e010f-b869-4350-ae90-5a30f531d22d": ["misy"],
  "d286f5bb-2db7-5108-aca0-b7f742cdf56a": ["yangon american", " yais ", "yangonamerican"],
  "32c57574-25e9-43ec-82b6-76310ab44bbd": ["lfir", "french international school of yangon"],
  "3d1593e7-5f61-4b29-b0ab-c70aab49514f": [" iip ", "iip international"],
  "9e523ef5-6ea0-42a5-bd93-14346a9afbc8": ["warriors", "warrior သုဝဏ္ဏ"],
  "9c5928e5-b6da-4648-bb21-10dea2844346": ["concept x", "conceptx"],
  "5d88ea9c-c422-4696-88f3-5f2afb315530": [" helix "],
  "ff40e933-2c42-48ab-95d9-73a107d00976": ["hallway"],
};

const POS = ["good", "great", "excellent", "love", "proud", "recommend", "caring", "safe", "ကောင်း", "အကောင်း"];
const NEG = ["bad", "poor", "terrible", "hate", "unsafe", "expensive", "overcrowded", "cramped", "မကောင်း", "စျေးကြီး"];
const CAT_HINTS = {
  fees: ["fee", "tuition", "price", "cost", "ကျသင့်", "သိန်း", "သန်း", "deposit", "mmk", "kyat"],
  facilities: ["lab", "library", "playground", "campus", "building", "facility"],
  safety: ["safe", "bully", "security", "guard"],
  "class size": ["class size", "overcrowded", "students per", "classroom"],
  curriculum: ["curriculum", "igcse", "cambridge", "ib ", "a level", "ibdp"],
  teachers: ["teacher", "ဆရာ", "ဆရာမ"],
};

const REVIEW_HINTS = [
  "review",
  "recommend",
  "experience",
  "enrolled",
  "parent",
  "သိချင်",
  "ဘယ်လိုလဲ",
  "အကြံ",
  "ပေးပါ",
  "review ပေး",
  "ကောင်းလား",
  "မကောင်း",
  "recommend",
];

const AD_HINTS = [
  /python with applied/i,
  /printing service/i,
  /zoom official/i,
  /textbook book sale/i,
  /hi q milk/i,
  /dream tree international pre-school/i,
  /htoo printing/i,
  /သင်တန်းကြေး/,
  /for sale/i,
  /paid partnership/i,
  /sale_post_id/,
];

export function compact(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u1000-\u109f ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerpt(text, limit = 420) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}

export function postText(page) {
  const parts = [];
  if (typeof page.text === "string" && page.text.trim()) parts.push(page.text.trim());
  if (page.sharedPost && typeof page.sharedPost.text === "string" && page.sharedPost.text.trim()) {
    parts.push(page.sharedPost.text.trim());
  }
  for (const media of page.media || page.attachments || page.sharedPost?.media || []) {
    const ocr = media && typeof media.ocrText === "string" ? media.ocrText.trim() : "";
    if (ocr && !/^may be (an image|a doodle)|^no photo description/i.test(ocr)) parts.push(ocr);
  }
  return parts.join("\n\n");
}

export function commentTexts(page) {
  const blobs = [];
  for (const key of ["comments", "latestComments", "topComments"]) {
    if (Array.isArray(page[key])) blobs.push(...page[key]);
  }
  if (page.comments && typeof page.comments === "object" && !Array.isArray(page.comments)) {
    const inner = page.comments.data || page.comments.items || [];
    if (Array.isArray(inner)) blobs.push(...inner);
  }
  const texts = [];
  for (const item of blobs) {
    if (typeof item === "string" && item.trim()) texts.push(item.trim());
    else if (item && typeof item === "object") {
      const text = item.text || item.comment || item.message || "";
      if (typeof text === "string" && text.trim()) texts.push(text.trim());
    }
  }
  return texts;
}

export function sentiment(text) {
  const lower = text.toLowerCase();
  const pos = POS.filter((word) => lower.includes(word)).length;
  const neg = NEG.filter((word) => lower.includes(word)).length;
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

export function category(text) {
  const lower = text.toLowerCase();
  for (const [key, hints] of Object.entries(CAT_HINTS)) {
    if (hints.some((hint) => lower.includes(hint))) return key;
  }
  return null;
}

export function isAd(text, page = {}) {
  if (page.price || String(page.url || "").includes("sale_post_id")) return true;
  return AD_HINTS.some((pattern) => pattern.test(text));
}

export function isReviewLike(text) {
  const lower = text.toLowerCase();
  return REVIEW_HINTS.some((hint) => lower.includes(hint));
}

export function schoolNeedles(schools) {
  return schools.map((school) => {
    const aliases = new Set([compact(school.name), ...(EXTRA_ALIASES[school.id] || [])]);
    return {
      id: school.id,
      name: school.name,
      aliases: [...aliases].filter((alias) => alias.replace(/\s/g, "").length >= 3),
    };
  });
}

const MISY_ID = "6d0e010f-b869-4350-ae90-5a30f531d22d";
const MIS_ID = "4dd4da53-4a6f-4bac-aca9-0fd9955e8bfc";
const KINGS_INTL_ID = "ba3c6f02-961b-42e1-8ef9-21d872abbda7";
const KINGS_YGN_ID = "3f96414d-5543-45ee-85da-16856c784bbe";

export function matchSchools(text, needles) {
  const hay = ` ${compact(text)} `;
  let hits = needles.filter((school) =>
    school.aliases.some((alias) => hay.includes(` ${alias} `) || (alias.length >= 5 && hay.includes(alias))),
  );
  const ids = new Set(hits.map((school) => school.id));
  if (ids.has(MISY_ID) && ids.has(MIS_ID) && !/yankin|mis-edu/.test(hay)) {
    hits = hits.filter((school) => school.id !== MIS_ID);
  }
  if (ids.has(KINGS_INTL_ID) && ids.has(KINGS_YGN_ID)) {
    if (/star city|pun hlaing|punhlaing|thuwunna/.test(hay)) {
      hits = hits.filter((school) => school.id !== KINGS_YGN_ID);
    } else if (/bahan|inya myaing|kings yangon/.test(hay)) {
      hits = hits.filter((school) => school.id !== KINGS_INTL_ID);
    }
  }
  return hits;
}

export function loadSchools(registerPath) {
  const register = JSON.parse(fs.readFileSync(registerPath, "utf8"));
  return register.schools || [];
}

export function groupIdFromPage(page, fallback = "") {
  const fromUrl = String(page.url || page.facebookUrl || page.inputUrl || "").match(/groups\/(\d+)/);
  return page.facebookId || fromUrl?.[1] || fallback;
}

export function findRelevantReviews(pages, schools, { query = "", schoolQuery = "" } = {}) {
  const needles = schoolNeedles(schools);
  const q = compact(query);
  const schoolQ = compact(schoolQuery);
  const rows = [];

  for (const page of pages) {
    const body = postText(page);
    const comments = commentTexts(page);
    const joined = [body, ...comments].filter(Boolean).join("\n");
    if (!joined) continue;
    if (isAd(joined, page)) continue;

    const hits = matchSchools(joined, needles);
    if (hits.length >= 3) continue;
    if (!hits.length && !isReviewLike(joined)) continue;

    for (const unit of [{ kind: "post", text: body }, ...comments.map((text) => ({ kind: "comment", text }))]) {
      if (!unit.text) continue;
      if (isAd(unit.text, page)) continue;
      const unitHits = matchSchools(unit.text, needles);
      if (!unitHits.length && unit.kind === "comment") continue;
      if (schoolQ && !unitHits.some((school) => compact(school.name).includes(schoolQ) || school.aliases.some((alias) => alias.includes(schoolQ)))) {
        continue;
      }
      if (q && !compact(unit.text).includes(q)) continue;
      if (!unitHits.length && !isReviewLike(unit.text)) continue;

      for (const school of unitHits.length ? unitHits : [{ id: null, name: "Unmatched review request" }]) {
        rows.push({
          school_id: school.id,
          school_name: school.name,
          source_kind: unit.kind,
          sentiment_label: sentiment(unit.text),
          mentioned_claim_category: category(unit.text),
          created_at: page.time || null,
          source_url: page.url || page.facebookUrl || null,
          group_id: groupIdFromPage(page),
          comment_excerpt: excerpt(unit.text),
        });
      }
    }
  }

  return rows;
}
