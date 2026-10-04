#!/usr/bin/env node
/**
 * Search a Facebook group *export* for parent school reviews.
 * This does not log into Facebook. Drop an Apify group JSON, or fetch one first
 * with fetch_fb_group_via_apify.mjs.
 *
 *   node find_group_reviews.mjs --file "C:\\Users\\VSK\\Downloads\\dataset.json"
 *   node find_group_reviews.mjs --file dump.json --school "ILBC"
 *   node find_group_reviews.mjs --file dump.json --query "fee" --apply
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findRelevantReviews, GROUP_SOURCES, loadSchools } from "./fb_group_lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

const file = arg("file");
const schoolQuery = arg("school");
const query = arg("query");
const apply = process.argv.includes("--apply");

if (!file) {
  console.error("Pass --file <apify-group-json>");
  process.exit(1);
}

const pages = JSON.parse(fs.readFileSync(file, "utf8"));
if (!Array.isArray(pages)) throw new Error("expected a list of group posts");

const schools = loadSchools(path.join(ROOT, "web", "public", "demo-register", "schools.json"));
const rows = findRelevantReviews(pages, schools, { query, schoolQuery });
const groupId = pages[0] ? String(pages[0].facebookId || "") : "";
const source = GROUP_SOURCES[groupId]?.label || pages[0]?.groupTitle || "Facebook group export";

const bySchool = {};
for (const row of rows) {
  if (!row.school_id) continue;
  const bucket = bySchool[row.school_id] || { school_name: row.school_name, comments: [] };
  bucket.comments.push({
    id: `${row.source_url}-${bucket.comments.length}`,
    comment_excerpt: row.comment_excerpt,
    sentiment_label: row.sentiment_label,
    mentioned_claim_category: row.mentioned_claim_category,
    created_at: row.created_at,
    source_url: row.source_url,
    source_kind: row.source_kind,
  });
  bySchool[row.school_id] = bucket;
}

if (apply) {
  const out = path.join(ROOT, "web", "public", "group-reviews", "by-school.json");
  const summary = path.join(ROOT, "raw-crawls", "fb-group", `${new Date().toISOString().slice(0, 10)}-mentions.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.mkdirSync(path.dirname(summary), { recursive: true });
  const payload = {
    source,
    source_url: GROUP_SOURCES[groupId]?.url || pages[0]?.inputUrl || null,
    crawled_at: new Date().toISOString().slice(0, 10),
    posts: pages.length,
    comments_in_export: rows.filter((row) => row.source_kind === "comment").length,
    note: "Only parent-review posts that name a SchoolLens school. Ads were skipped.",
    schools: bySchool,
  };
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  fs.writeFileSync(
    summary,
    JSON.stringify(
      {
        group_id: groupId,
        posts: pages.length,
        relevant: rows.length,
        matched_schools: Object.fromEntries(
          Object.entries(bySchool).map(([id, bucket]) => [id, { name: bucket.school_name, comments: bucket.comments.length }]),
        ),
      },
      null,
      2,
    ),
  );
}

console.log(
  JSON.stringify(
    {
      source,
      posts: pages.length,
      relevant: rows.length,
      schools: Object.fromEntries(Object.entries(bySchool).map(([id, bucket]) => [bucket.school_name, bucket.comments.length])),
      matches: rows.slice(0, 20),
      applied: apply,
    },
    null,
    2,
  ),
);
