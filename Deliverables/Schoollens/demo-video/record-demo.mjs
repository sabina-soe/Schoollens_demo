import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SCHOOLLENS_URL || "http://127.0.0.1:3002";
const ISY_ID = "b0595924-73f7-49c4-94b0-b05017d77ef8";
const ILBC_ID = "f6c7b97d-8959-4d0c-841f-8148d10dcd4d";
const outDir = path.join(__dirname, "output");
fs.mkdirSync(outDir, { recursive: true });

const CAPTION_CSS = `
nextjs-portal { display: none !important; }
#demo-caption {
  position: fixed;
  left: 50%;
  bottom: 28px;
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
  letter-spacing: 0.01em;
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
  } catch {
    // Page navigated while setting the caption.
  }
}

async function hold(page, ms) {
  await page.waitForTimeout(ms);
  try {
    await setCaption(page, (await page.evaluate(() => window.__DEMO_CAPTION || "")) || "");
  } catch {
    // Ignore if a navigation tore down the page during the pause.
  }
}

async function humanClick(page, locator) {
  const target = locator.first();
  await target.waitFor({ state: "visible", timeout: 20000 });
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
  }
  await target.click();
}

async function smoothScroll(page, y) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);
  await hold(page, 1400);
}

async function gotoSection(page, hash) {
  const nav = page.locator(`a.profile-tab-btn[href="#${hash}"]`);
  if (await nav.count()) {
    await humanClick(page, nav);
    await hold(page, 1600);
    return;
  }
  await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, hash);
  await hold(page, 1600);
}

async function explainPipeline(page) {
  const process = page.locator(".home-process, [aria-label='How SchoolLens works']").first();
  if (await process.count()) {
    await process.scrollIntoViewIfNeeded();
  }
  await setCaption(page, "How data is collected: crawl the MOE register, official school websites, and public Facebook pages.");
  await hold(page, 5500);
  await setCaption(page, "How AI is used: it extracts claims from those pages, then reconciles them. It does not rank schools.");
  await hold(page, 5500);
  await setCaption(page, "Ask is grounded AI — answers come only from retrieved claim groups, with citations you can check.");
  await hold(page, 5000);
}

async function showOperatorCollection(page) {
  try {
    const signIn = page.getByRole("button", { name: /^Sign in$/i });
    if (await signIn.count()) {
      await setCaption(page, "Operators queue the crawls. This desk is not a parent ranking tool.");
      await hold(page, 1800);
      await humanClick(page, signIn);
      const operatorBtn = page.getByRole("button", { name: /^Operator$/i });
      if (!(await operatorBtn.count())) return false;
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {}),
        operatorBtn.first().click(),
      ]);
      await hold(page, 2000);
    }

    await page.goto(`${BASE}/operator`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const crawlHeading = page.getByRole("heading", { name: /Crawl targets/i });
    try {
      await crawlHeading.waitFor({ timeout: 12000 });
    } catch {
      console.log("Operator desk not available — continuing on public pages");
      return false;
    }

    console.log("On operator desk");
    await setCaption(page, "Collection starts here: each school has an official website URL and a Facebook URL.");
    await hold(page, 4500);

    const search = page.getByPlaceholder("Search by name");
    if (await search.count()) {
      await humanClick(page, search);
      await search.fill("");
      await search.type("International School Yangon", { delay: 40 });
      await hold(page, 2800);
    }

    const queueWeb = page.getByRole("button", { name: /Queue website/i }).first();
    if (await queueWeb.count()) {
      await queueWeb.scrollIntoViewIfNeeded();
      await setCaption(page, "Queue website — the crawler fetches the official site. AI later extracts claims from the HTML.");
      await hold(page, 2500);
      if (await queueWeb.isEnabled()) {
        await humanClick(page, queueWeb);
        await hold(page, 3000);
      } else {
        await hold(page, 2000);
      }
    }

    const queueFb = page.getByRole("button", { name: /Queue Facebook/i }).first();
    if (await queueFb.count()) {
      await queueFb.scrollIntoViewIfNeeded();
      await setCaption(page, "Queue Facebook — public posts are collected, then the same AI extract step runs on that text.");
      await hold(page, 5000);
    }

    const history = page.getByRole("heading", { name: /Run history/i });
    if (await history.count()) {
      await history.scrollIntoViewIfNeeded();
      await setCaption(page, "Run history records the source, status, and how many rows were ingested into the ledger.");
      await hold(page, 5000);
    }

    const logOut = page.getByRole("button", { name: /Log out/i });
    if (await logOut.count()) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {}),
        logOut.first().click(),
      ]);
    }
    return true;
  } catch (error) {
    console.log("Operator scene skipped:", error.message);
    return false;
  }
}

function convertToMp4(webmPath, mp4Path) {
  const ffmpeg = spawnSync(
    "ffmpeg",
    ["-y", "-i", webmPath, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4Path],
    { encoding: "utf8" },
  );
  if (ffmpeg.status === 0 && fs.existsSync(mp4Path)) {
    return mp4Path;
  }
  console.warn("ffmpeg conversion skipped:", ffmpeg.stderr?.slice(-400) || ffmpeg.error?.message);
  return webmPath;
}

console.log("Launching Chromium...");
const browser = await chromium.launch({
  headless: true,
  timeout: 60000,
  args: ["--hide-scrollbars"],
});
console.log("Chromium launched");

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: outDir,
    size: { width: 1440, height: 900 },
  },
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
  const schedule = () => {
    apply();
    setInterval(apply, 500);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule, { once: true });
  } else {
    schedule();
  }
}, CAPTION_CSS);

const page = await context.newPage();
page.setDefaultTimeout(25000);

try {
  console.log("Opening", BASE);
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  console.log("Home loaded");
  await page.waitForSelector('input[aria-label="Search schools"]', { timeout: 25000 });
  await setCaption(page, "SchoolLens is not a ranking. It is an evidence ledger for Myanmar schools.");
  await hold(page, 4000);

  await explainPipeline(page);
  const showedOperator = await showOperatorCollection(page);
  console.log("Operator collection scene:", showedOperator);

  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('input[aria-label="Search schools"]', { timeout: 25000 });
  await setCaption(page, "Parents search the public register by name — no scores, no stars.");
  const search = page.locator('input[aria-label="Search schools"]').first();
  await humanClick(page, search);
  await search.fill("");
  await search.type("International School Yangon", { delay: 55 });
  await hold(page, 1200);

  const searchBtn = page.getByRole("button", { name: /^Search$/i });
  if (await searchBtn.count()) {
    await humanClick(page, searchBtn);
  } else {
    await search.press("Enter");
  }

  await page.waitForURL(/\/schools/, { timeout: 20000 }).catch(() => {});
  await hold(page, 2500);
  await setCaption(page, "Results show confidence, not ratings: supported, likely, conflicting, or unknown.");
  await hold(page, 4500);

  const isyLink = page.locator(`a[href="/schools/${ISY_ID}"]`).first();
  await setCaption(page, "Open ISY. This school has crawled website evidence — more than a brochure page.");
  if (await isyLink.count()) {
    await isyLink.scrollIntoViewIfNeeded();
    await hold(page, 2000);
    await humanClick(page, isyLink);
  } else {
    await page.goto(`${BASE}/schools/${ISY_ID}`, { waitUntil: "domcontentloaded" });
  }

  await page.waitForURL(new RegExp(`/schools/${ISY_ID}`), { timeout: 20000 }).catch(() => {
    return page.goto(`${BASE}/schools/${ISY_ID}`, { waitUntil: "domcontentloaded" });
  });
  await page.waitForSelector("h1, .profile-hero, .confidence-panel-label", { timeout: 30000 }).catch(() => {});
  await hold(page, 2500);
  console.log("On ISY profile", page.url());
  await setCaption(page, "ISY has 107 claim groups from public sources. The number is a count of evidence, not a rank.");
  await hold(page, 5000);

  await setCaption(page, "Every fact is labelled. Supported means independent sources agree. Conflicting means they do not.");
  await hold(page, 3500);

  const inspect = page.locator("button.btn-sources-toggle").first();
  if (await inspect.count()) {
    await inspect.scrollIntoViewIfNeeded();
    await setCaption(page, "Inspect sources: crawled website text. AI extracted these claims; you can still read the original excerpt.");
    await hold(page, 1800);
    await humanClick(page, inspect);
    await hold(page, 5500);
  }

  const compare = page.locator("a.verify-inspect-link").first();
  if (await compare.count()) {
    await compare.scrollIntoViewIfNeeded();
    await setCaption(page, "AI reconciliation: two official pages disagree, so the label is conflicting. The model does not pick a winner.");
    await hold(page, 2500);
    await humanClick(page, compare);
    await page.waitForURL(/\/conflict\//, { timeout: 15000 }).catch(() => {});
    console.log("On conflict page", page.url());
    await hold(page, 7000);
  } else {
    await setCaption(page, "When sources disagree, SchoolLens shows both sides. It will not invent a single “correct” answer.");
    await hold(page, 4500);
  }

  console.log("Opening ILBC");
  await setCaption(page, "Now ILBC: Facebook is a second collection channel, not a brochure photo gallery.");
  await page.goto(`${BASE}/schools/${ILBC_ID}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1, .profile-hero, .confidence-panel-label", { timeout: 30000 }).catch(() => {});
  await hold(page, 3500);

  await setCaption(page, "ILBC also has Facebook crawls. Same pipeline: collect pages, AI extracts claims, then label confidence.");
  await hold(page, 5000);

  await gotoSection(page, "verification-hub");
  await setCaption(page, "Evidence is the AI ledger: each claim keeps its source tag — official website or Facebook — and a confidence label.");
  await hold(page, 6000);
  await smoothScroll(page, (await page.evaluate(() => window.scrollY)) + 320);

  await gotoSection(page, "fees");
  await setCaption(page, "AI also reads fee posters. One source, so the label is likely until another independent record agrees.");
  await hold(page, 5500);
  await smoothScroll(page, (await page.evaluate(() => window.scrollY)) + 360);

  console.log("Ask section");
  await gotoSection(page, "ask");
  await setCaption(page, "Parents use AI here. Ask retrieves claim groups only — it will not answer from a chatbot’s training data.");
  await hold(page, 3500);

  const suggestion = page.getByRole("button", { name: /What curriculum is officially listed/i });
  if (await suggestion.count()) {
    await humanClick(page, suggestion);
  } else {
    const askBox = page.locator("textarea, input[type='text']").last();
    if (await askBox.count()) {
      await humanClick(page, askBox);
      await askBox.fill("What curriculum is officially listed?");
      const askSubmit = page.getByRole("button", { name: /Ask|Send/i }).last();
      if (await askSubmit.count()) await humanClick(page, askSubmit);
    }
  }

  await page
    .locator(".answer-text, .error-banner, .citation-evidence-card")
    .first()
    .waitFor({ timeout: 20000 })
    .catch(() => {});
  const askFailed = await page.locator(".error-banner").first().isVisible().catch(() => false);
  if (askFailed) {
    await setCaption(page, "When Ask returns, every sentence is tied to a claim group. Here is the ledger those answers use.");
    await hold(page, 4500);
    await gotoSection(page, "verification-hub");
    await setCaption(page, "This is the AI output parents can audit: each claim, its source, and whether sources agree.");
    await hold(page, 6000);
  } else {
    await setCaption(page, "The answer cites claim groups. You can check the source instead of trusting a chatbot.");
    await hold(page, 8000);
    await smoothScroll(page, (await page.evaluate(() => window.scrollY)) + 280);
    await hold(page, 4000);
  }

  await setCaption(page, "Recap: collect from website and Facebook, AI extracts and reconciles, Ask cites the ledger — no invented ranking.");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await hold(page, 5500);
} catch (error) {
  console.error("Recording walkthrough error:", error);
  await setCaption(page, "SchoolLens demo — evidence ledger, not a ranking.").catch(() => {});
  await hold(page, 2500);
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    const rawPath = await video.path();
    const webmDest = path.join(outDir, "SchoolLens-demo-with-subtitles.webm");
    const mp4Dest = path.join(outDir, "SchoolLens-demo-with-subtitles.mp4");
    if (rawPath && fs.existsSync(rawPath)) {
      fs.copyFileSync(rawPath, webmDest);
      const finalPath = convertToMp4(webmDest, mp4Dest);
      console.log("VIDEO_READY", finalPath);
    } else {
      console.error("No video file was written.");
      process.exitCode = 1;
    }
  }
}
