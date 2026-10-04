import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE =
  process.argv[2] ||
  "C:\\Users\\VSK\\Downloads\\dataset_facebook-groups-scraper_2026-10-04_07-51-58-664.json";
const SCHOOLS_PATH = path.join(ROOT, "web", "public", "demo-register", "schools.json");
const OUT_REVIEWS = path.join(ROOT, "web", "public", "group-reviews", "by-school.json");
const CRAWLED_ON = path.basename(SOURCE).includes("2026-10-04") ? "2026-10-04" : "2026-10-02";
const OUT_SUMMARY = path.join(ROOT, "raw-crawls", "fb-group", `${CRAWLED_ON}-mentions.json`);

const POS = ["good", "great", "excellent", "love", "proud", "recommend", "caring", "safe", "ကောင်း", "အကောင်း", "recommend"];
const NEG = ["bad", "poor", "terrible", "hate", "unsafe", "expensive", "overcrowded", "cramped", "မကောင်း", "စျေးကြီး", "အန္တရာယ်"];
const CAT_HINTS = {
  fees: ["fee", "tuition", "price", "cost", "ကျသင့်", "သိန်း", "သန်း", "deposit", "mmk", "kyat"],
  facilities: ["lab", "library", "playground", "campus", "building", "facility"],
  safety: ["safe", "bully", "security", "guard", "adhd"],
  "class size": ["class size", "overcrowded", "students per", "classroom"],
  curriculum: ["curriculum", "igcse", "cambridge", "ib ", "a level", "ibdp"],
};

const EXTRA_ALIASES = {
  "f6c7b97d-8959-4d0c-841f-8148d10dcd4d": ["ilbc"],
  "ba3c6f02-961b-42e1-8ef9-21d872abbda7": ["kings international", "kings pun hlaing", "punhlaing", "pun hlaing kings"],
  "3f96414d-5543-45ee-85da-16856c784bbe": ["kings yangon", "kings bahan"],
  "038e4ef9-a8a3-4dca-9ea9-aad223fc71c5": ["yangon international school", " yis "],
  "4dd4da53-4a6f-4bac-aca9-0fd9955e8bfc": ["myanmar international school"],
  "22b3784f-3e04-4153-80e0-abe3000fe273": ["british school yangon"],
  "ff40e933-2c42-48ab-95d9-73a107d00976": ["hallway"],
  "6c78977f-de06-4078-bbd2-570e303276ae": ["network international"],
  "3a7850e4-c67a-4754-8b2f-3e055893f972": ["niec"],
  "3d1593e7-5f61-4b29-b0ab-c70aab49514f": ["iip international", " iip "],
  "d1e8deee-ed2c-43fb-a382-c3adb5d06861": ["pride international", " pism "],
  "b0595924-73f7-49c4-94b0-b05017d77ef8": ["international school yangon", " isy "],
  "6d0e010f-b869-4350-ae90-5a30f531d22d": ["misy"],
  "d286f5bb-2db7-5108-aca0-b7f742cdf56a": ["yangon american", " yais ", "yangonamerican"],
};

const SKIP_IF = [
  /အိမ်ထောင်ရေး/,
  /marriage respect/,
  /octostudio/i,
  /phonics class/i,
  /boy black shoes/i,
  /python with applied/i,
  /printing service/i,
  /zoom official/i,
  /textbook book sale/i,
  /hi q milk/i,
  /dream tree international pre-school/i,
  /htoo printing/i,
];

function isTutorList(text, hitCount) {
  return hitCount >= 3 || /igcseinternationalcourse/i.test(text);
}

const EXTRA_SCHOOLS = [
  {
    id: "b0595924-73f7-49c4-94b0-b05017d77ef8",
    name: "The International School Yangon (ISY)",
  },
  {
    id: "6d0e010f-b869-4350-ae90-5a30f531d22d",
    name: "Myanmar International School Yangon (MISY)",
  },
];

function compact(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u1000-\u109f ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function postText(page) {
  const parts = [];
  if (typeof page.text === "string" && page.text.trim()) parts.push(page.text.trim());
  if (page.sharedPost && typeof page.sharedPost.text === "string" && page.sharedPost.text.trim()) {
    parts.push(page.sharedPost.text.trim());
  }
  for (const media of page.media || page.attachments || page.sharedPost?.media || []) {
    const ocr = media && typeof media.ocrText === "string" ? media.ocrText.trim() : "";
    if (ocr && !/^may be (an image|a doodle)|^no photo description/i.test(ocr)) {
      parts.push(ocr);
    }
  }
  return parts.join("\n\n");
}

function commentTexts(page) {
  const blobs = [];
  for (const key of ["comments", "latestComments", "topComments"]) {
    const items = page[key];
    if (Array.isArray(items)) blobs.push(...items);
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

function sentiment(text) {
  const lower = text.toLowerCase();
  const pos = POS.filter((word) => lower.includes(word)).length;
  const neg = NEG.filter((word) => lower.includes(word)).length;
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

function category(text) {
  const lower = text.toLowerCase();
  for (const [key, hints] of Object.entries(CAT_HINTS)) {
    if (hints.some((hint) => lower.includes(hint))) return key;
  }
  return null;
}

function schoolNeedles(schools) {
  return schools.map((school) => {
    const aliases = new Set([compact(school.name), ...(EXTRA_ALIASES[school.id] || [])]);
    return {
      id: school.id,
      name: school.name,
      aliases: [...aliases].filter((alias) => alias.replace(/\s/g, "").length >= 3),
    };
  });
}

function matchSchools(text, needles) {
  const hay = ` ${compact(text)} `;
  const hits = [];
  for (const school of needles) {
    const matched = school.aliases.some((alias) => hay.includes(` ${alias} `) || hay.includes(alias));
    if (matched) hits.push(school);
  }
  return hits;
}

function excerpt(text, limit = 420) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}

const raw = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
if (!Array.isArray(raw)) throw new Error("expected a list of group posts");

const register = JSON.parse(fs.readFileSync(SCHOOLS_PATH, "utf8"));
const schools = [...register.schools];
for (const extra of EXTRA_SCHOOLS) {
  if (!schools.some((school) => school.id === extra.id)) {
    schools.push({
      id: extra.id,
      name: extra.name,
      address: null,
      curriculum_type: null,
      school_group_id: null,
      moe_approved_from: null,
      moe_approved_to: null,
      official_facebook_url: null,
      official_website_url: null,
      location: null,
      geocode_confidence: null,
    });
  }
}

const needles = schoolNeedles(schools);
const bySchool = {};
const unmatched = [];
let withText = 0;
let withComments = 0;

for (const page of raw) {
  const body = postText(page);
  const comments = commentTexts(page);
  if (body) withText += 1;
  if (comments.length) withComments += 1;
  const units = [];
  if (body) units.push({ kind: "post", text: body });
  for (const text of comments) units.push({ kind: "comment", text });
  if (!units.length) continue;

  const joined = units.map((unit) => unit.text).join("\n");
  if (SKIP_IF.some((pattern) => pattern.test(joined))) continue;
  const hits = matchSchools(joined, needles);
  if (isTutorList(joined, hits.length)) continue;
  if (!hits.length) {
    unmatched.push({
      url: page.url,
      time: page.time,
      preview: excerpt(joined, 160),
    });
    continue;
  }
  for (const school of hits) {
    const bucket = bySchool[school.id] || { school_name: school.name, comments: [] };
    for (const unit of units) {
      const unitHits = matchSchools(unit.text, [school]);
      if (!unitHits.length && unit.kind === "comment") continue;
      bucket.comments.push({
        id: `${page.legacyId || page.id || page.url}-${bucket.comments.length}`,
        comment_excerpt: excerpt(unit.text),
        sentiment_label: sentiment(unit.text),
        mentioned_claim_category: category(unit.text),
        created_at: page.time || null,
        source_url: page.url || null,
        source_kind: unit.kind,
      });
    }
    bySchool[school.id] = bucket;
  }
}

for (const bucket of Object.values(bySchool)) {
  const seen = new Set();
  bucket.comments = bucket.comments.filter((row) => {
    const key = row.comment_excerpt;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

fs.mkdirSync(path.dirname(OUT_REVIEWS), { recursive: true });
fs.mkdirSync(path.dirname(OUT_SUMMARY), { recursive: true });
fs.writeFileSync(
  OUT_REVIEWS,
  JSON.stringify(
    {
      source: "International School Review (မိဘများရင်ဖွင့်ရာ)",
      crawled_at: CRAWLED_ON,
      posts: raw.length,
      comments_in_export: withComments,
      note:
        "Tutor ads, sales, and posts that did not name a SchoolLens school were not attached to profiles.",
      schools: bySchool,
    },
    null,
    2,
  ),
);
fs.writeFileSync(
  OUT_SUMMARY,
  JSON.stringify(
    {
      posts: raw.length,
      with_text: withText,
      with_comments: withComments,
      matched_schools: Object.fromEntries(
        Object.entries(bySchool).map(([id, bucket]) => [id, { name: bucket.school_name, comments: bucket.comments.length }]),
      ),
      unmatched_sample: unmatched.slice(0, 25),
      unmatched_count: unmatched.length,
    },
    null,
    2,
  ),
);

// Keep the raw Apify dump out of git. Only the mention summary is stored.

console.log(
  JSON.stringify(
    {
      posts: raw.length,
      with_text: withText,
      with_comments: withComments,
      matched: Object.fromEntries(
        Object.entries(bySchool).map(([id, bucket]) => [bucket.school_name, bucket.comments.length]),
      ),
      unmatched: unmatched.length,
      reviews: OUT_REVIEWS,
    },
    null,
    2,
  ),
);
