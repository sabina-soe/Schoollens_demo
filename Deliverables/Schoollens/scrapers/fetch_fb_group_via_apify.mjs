#!/usr/bin/env node
/**
 * Fetch a Facebook *public group* export through the same Apify actor
 * SchoolLens already uses. Does not log into Facebook or use cookies.
 *
 *   set APIFY_TOKEN=...
 *   node fetch_fb_group_via_apify.mjs --group https://www.facebook.com/groups/237771859200599 --limit 80
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_GROUP = "https://www.facebook.com/groups/237771859200599";
const ACTOR = "apify~facebook-groups-scraper";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function loadEnv() {
  for (const rel of ["rag-service/.env", "web/.env.local", "rag-service/.env.example"]) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const [key, ...rest] = line.split("=");
      process.env[key.trim()] ||= rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

async function api(url, token, options = {}) {
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}token=${token}`, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Apify ${response.status}: ${body.slice(0, 240)}`);
  }
  return response.json();
}

async function main() {
  loadEnv();
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.error(
      [
        "No APIFY_TOKEN in the environment.",
        "SchoolLens does not log into Facebook.",
        "Either:",
        "  1) Add APIFY_TOKEN and rerun this script, or",
        "  2) Run your usual Apify facebook-groups-scraper on this group, then:",
        '     node find_group_reviews.mjs --file "<download.json>" --apply',
        `Group: ${DEFAULT_GROUP}`,
      ].join("\n"),
    );
    process.exit(2);
  }

  const group = arg("group", DEFAULT_GROUP);
  const limit = Number(arg("limit", "80"));
  console.log(`starting Apify ${ACTOR} for ${group} limit=${limit}`);
  const started = await api(`https://api.apify.com/v2/acts/${ACTOR}/runs`, token, {
    method: "POST",
    body: JSON.stringify({
      startUrls: [{ url: group }],
      resultsLimit: limit,
      viewOption: "CHRONOLOGICAL",
    }),
  });
  const runId = started.data.id;
  const datasetId = started.data.defaultDatasetId;
  let status = started.data.status;
  while (["READY", "RUNNING"].includes(status)) {
    await new Promise((resolve) => setTimeout(resolve, 8000));
    const poll = await api(`https://api.apify.com/v2/actor-runs/${runId}`, token);
    status = poll.data.status;
    console.log(`run ${runId} ${status}`);
  }
  if (status !== "SUCCEEDED") {
    throw new Error(`Apify run ended ${status}`);
  }
  const items = await api(`https://api.apify.com/v2/datasets/${datasetId}/items`, token);
  const stamp = new Date().toISOString().slice(0, 10);
  const outDir = path.join(ROOT, "raw-crawls", "fb-group");
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `dataset_facebook-groups-scraper_${stamp}-group-237771859200599.json`);
  fs.writeFileSync(out, JSON.stringify(items, null, 2));
  console.log(JSON.stringify({ status, posts: items.length, file: out }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
