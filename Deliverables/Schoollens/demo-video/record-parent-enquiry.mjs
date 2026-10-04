import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SCHOOLLENS_URL || "http://127.0.0.1:3002";
const KINGS_ID = "ba3c6f02-961b-42e1-8ef9-21d872abbda7";
const KINGS_YANGON_ID = "3f96414d-5543-45ee-85da-16856c784bbe";
const outDir = path.join(__dirname, "output");
const storyHtml = path.join(__dirname, "story-enquiry.html");
fs.mkdirSync(outDir, { recursive: true });

const CAPTION_CSS = `
nextjs-portal { display: none !important; }
.error-banner { display: none !important; }
#demo-caption {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 2147483647;
  max-width: min(980px, 90vw);
  background: rgba(0, 31, 68, 0.94);
  color: #fff;
  font: 600 19px/1.4 "Open Sans", "Segoe UI", system-ui, sans-serif;
  padding: 14px 24px;
  border-radius: 12px;
  border-left: 6px solid #38A39A;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.35);
  text-align: center;
  pointer-events: none;
}
`;

async function setCaption(page, text) {
  try {
    await page.evaluate(
      ({ css, text: caption }) => {
        window.__DEMO_CAPTION = caption;
        if (!document.getElementById("demo-caption-style")) {
          const style = document.createElement("style");
          style.id = "demo-caption-style";
          style.textContent = css;
          document.documentElement.appendChild(style);
        }
        let el = document.getElementById("demo-caption");
        if (!el) {
          el = document.createElement("div");
          el.id = "demo-caption";
          document.documentElement.appendChild(el);
        }
        el.textContent = caption;
      },
      { css: CAPTION_CSS, text },
    );
  } catch {}
}

async function hold(page, ms) {
  await page.waitForTimeout(ms);
  try {
    await setCaption(page, (await page.evaluate(() => window.__DEMO_CAPTION || "")) || "");
  } catch {}
}

async function humanClick(page, locator) {
  const target = locator.first();
  await target.waitFor({ state: "visible", timeout: 20000 });
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 16 });
  await target.click();
}

async function gotoSection(page, hash) {
  const nav = page.locator(`a.profile-tab-btn[href="#${hash}"]`);
  if (await nav.count()) {
    await humanClick(page, nav);
    await hold(page, 1400);
    return;
  }
  await page.evaluate((id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), hash);
  await hold(page, 1400);
}

async function searchSchool(page, query) {
  const search = page.locator('input[aria-label="Search schools"]').first();
  await humanClick(page, search);
  await search.fill("");
  await search.type(query, { delay: 45 });
  const btn = page.getByRole("button", { name: /^Search$/i });
  if (await btn.count()) await humanClick(page, btn);
  else await search.press("Enter");
  await page.waitForURL(/\/schools/, { timeout: 20000 }).catch(() => {});
  await page
    .locator(".dir-card, .empty-state-card, .error-banner")
    .first()
    .waitFor({ timeout: 25000 })
    .catch(() => {});
  await hold(page, 2400);
}

function convertSilent(webmPath, mp4Path) {
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-i", webmPath, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4Path],
    { encoding: "utf8" },
  );
  if (r.status === 0 && fs.existsSync(mp4Path)) return mp4Path;
  console.warn("ffmpeg failed", r.stderr?.slice(-300));
  return webmPath;
}

console.log("Launching Chromium...");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const launchOpts = { headless: true, timeout: 60000, args: ["--hide-scrollbars"] };
if (fs.existsSync(chromePath)) launchOpts.executablePath = chromePath;
else if (fs.existsSync(edgePath)) launchOpts.executablePath = edgePath;
const browser = await chromium.launch(launchOpts);
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outDir, size: { width: 1440, height: 900 } },
});
await context.addInitScript((css) => {
  window.__DEMO_CAPTION = window.__DEMO_CAPTION || "";
  const apply = () => {
    if (!document.getElementById("demo-caption-style")) {
      const style = document.createElement("style");
      style.id = "demo-caption-style";
      style.textContent = css;
      document.documentElement.appendChild(style);
    }
    let el = document.getElementById("demo-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-caption";
      document.documentElement.appendChild(el);
    }
    const next = window.__DEMO_CAPTION || "";
    if (el.textContent !== next) el.textContent = next;
  };
  const start = () => {
    apply();
    setInterval(apply, 500);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}, CAPTION_CSS);

const page = await context.newPage();
page.setDefaultTimeout(25000);

try {
  await page.goto("file:///" + storyHtml.replace(/\\/g, "/"), { waitUntil: "domcontentloaded" });
  await setCaption(page, "Real enquiry. A parent asked the group: Yangon American or KINGS — what are the fees?");
  await hold(page, 5500);
  await setCaption(page, "Facebook answered with 84% recommended vs not yet rated. That is not evidence.");
  await hold(page, 4500);

  console.log("Opening SchoolLens");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 40000 });
  await page.waitForSelector('input[aria-label="Search schools"]', { timeout: 30000 });
  await setCaption(page, "SchoolLens will not pick a school. It will show what sources actually say.");
  await hold(page, 4000);

  await setCaption(page, "First campus from the post: Yangon American International School.");
  await searchSchool(page, "Yangon American");
  await setCaption(page, "No 84% score. If claims exist, we show confidence. If not, we say unknown — not recommended.");
  await hold(page, 4000);

  const yais = page.getByRole("link", { name: /American/i }).first();
  if (await yais.count()) {
    await yais.scrollIntoViewIfNeeded();
    await hold(page, 1200);
    await humanClick(page, yais);
    await page.waitForSelector("h1, .confidence-panel-label", { timeout: 25000 }).catch(() => {});
    await hold(page, 2000);
    console.log("On YAIS-like profile", page.url());
    await setCaption(page, "This is the ledger, not a Facebook recommendation bar.");
    await hold(page, 4500);
    await gotoSection(page, "fees");
    await setCaption(page, "If a fee poster is on file, it is labelled likely — one source. Gossip numbers stay gossip.");
    await hold(page, 4500);
  } else {
    await setCaption(page, "No inspectable record for that name yet. Honest empty is better than an invented 84%.");
    await hold(page, 4500);
  }

  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[aria-label="Search schools"]');
  await setCaption(page, "Second campus from the post: KINGS International School — Pun Hlaing.");
  await searchSchool(page, "KINGS International");
  await hold(page, 1500);

  const kingsLink = page.locator(`a[href="/schools/${KINGS_ID}"]`).first();
  if (await kingsLink.count()) {
    await kingsLink.scrollIntoViewIfNeeded();
    await humanClick(page, kingsLink);
  } else {
    const fallback = page.getByRole("link", { name: /KINGS International School/i }).first();
    if (await fallback.count()) await humanClick(page, fallback);
    else await page.goto(`${BASE}/schools/${KINGS_ID}`, { waitUntil: "domcontentloaded" });
  }
  await page.locator("h1, #fees, .empty-state-card").first().waitFor({ timeout: 25000 }).catch(() => {});
  await page.locator("#fees, .fee-poster-block").first().waitFor({ timeout: 20000 }).catch(() => {});
  console.log("On KINGS profile", page.url());
  await setCaption(page, "Facebook said not yet rated. SchoolLens does not rate. It counts claim groups from sources.");
  await hold(page, 5000);

  await gotoSection(page, "fees");
  await page.locator(".fee-poster-block, #fees").first().waitFor({ timeout: 15000 }).catch(() => {});
  await setCaption(page, "Real solution: a public fee poster, extracted. Label is likely until a second source agrees.");
  await hold(page, 7000);
  await page.evaluate(() => window.scrollBy({ top: 280, behavior: "smooth" }));
  await hold(page, 2500);

  await gotoSection(page, "ask");
  await setCaption(page, "Ask the question the parent actually has — fees — not which school is better.");
  await hold(page, 2800);
  const feeAsk = page.getByRole("button", { name: /What do sources say about tuition fees/i });
  if (await feeAsk.count()) await humanClick(page, feeAsk);
  await page.locator(".answer-text, .error-banner, .citation-evidence-card").first().waitFor({ timeout: 18000 }).catch(() => {});
  const failed = await page.locator(".error-banner").first().isVisible().catch(() => false);
  if (failed) {
    await setCaption(page, "Ask stays silent if the service fails. It will not invent a fee to win the Facebook thread.");
    await hold(page, 4000);
    await gotoSection(page, "fees");
    await setCaption(page, "The poster is still here. That is the answer Facebook comments cannot open.");
    await hold(page, 5000);
  } else {
    await setCaption(page, "The answer must cite a claim group. A comment thread never shows the source.");
    await hold(page, 6000);
  }

  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await setCaption(page, "84% recommended is not a fact. SchoolLens shows the source — or says we do not have one.");
  await hold(page, 5000);
} catch (error) {
  console.error(error);
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    const raw = await video.path();
    const dest = path.join(outDir, "SchoolLens-parent-enquiry-silent.webm");
    const mp4 = path.join(outDir, "SchoolLens-parent-enquiry-silent.mp4");
    if (raw && fs.existsSync(raw)) {
      fs.copyFileSync(raw, dest);
      console.log("VIDEO_READY", convertSilent(dest, mp4));
    } else {
      process.exitCode = 1;
    }
  }
}
