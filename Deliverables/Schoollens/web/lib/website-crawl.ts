export type CrawledPage = {
  url: string;
  page_title: string | null;
  extracted_text: string;
  crawl_status: "success" | "blocked" | "error";
  http_status: number | null;
};

const PRIORITY = [
  "about",
  "admission",
  "fee",
  "tuition",
  "curriculum",
  "academic",
  "preschool",
  "primary",
  "secondary",
  "igcse",
  "campus",
  "contact",
  "elementary",
  "middle-school",
  "high-school",
];

const EXTRA_PATHS: Record<string, string[]> = {
  "conceptx.edu.mm": [
    "/about-us",
    "/academic-programs",
    "/elementary-school",
    "/middle-school",
    "/high-school",
    "/campus-life",
    "/contact",
  ],
  "alba-edu.com": [
    "/pre-school",
    "/primary",
    "/lower",
    "/upper",
    "/admission",
    "/facility",
    "/contact-us",
  ],
};

const GENERIC_PATHS = ["/about", "/about-us", "/admissions", "/academic-programs", "/curriculum", "/contact"];

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function sameHost(seed: string, url: string) {
  return hostOf(seed) === hostOf(url);
}

function skip(url: string) {
  return /\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|mp4)(\?|$)/i.test(url) || url.startsWith("mailto:");
}

function canon(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    const href = parsed.toString();
    return href.replace(/\/$/, "") || href;
  } catch {
    return url.replace(/\/$/, "");
  }
}

function priority(url: string) {
  const path = url.toLowerCase();
  const index = PRIORITY.findIndex((token) => path.includes(token));
  return index === -1 ? 80 : index;
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

function extractText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

function extractLinks(base: string, html: string) {
  const links: string[] = [];
  const matches = html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi);
  for (const match of matches) {
    try {
      const url = new URL(match[1], base).toString().split("#")[0];
      if (sameHost(base, url) && !skip(url)) links.push(url.replace(/\/$/, "") || url);
    } catch {
      continue;
    }
  }
  return links;
}

function seedList(seed: string) {
  const origin = new URL(seed);
  const host = hostOf(seed);
  const extras = EXTRA_PATHS[host] ?? GENERIC_PATHS;
  return [seed, ...extras.map((path) => new URL(path, origin).toString())];
}

async function fetchPage(url: string, remainMs: number): Promise<CrawledPage & { html: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SchoolLensBot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(Math.max(2500, Math.min(8000, remainMs))),
    });
    const html = await response.text();
    if (!response.ok) {
      return {
        url,
        page_title: extractTitle(html),
        extracted_text: "",
        crawl_status: response.status === 403 || response.status === 401 ? "blocked" : "error",
        http_status: response.status,
        html,
      };
    }
    return {
      url: response.url || url,
      page_title: extractTitle(html),
      extracted_text: extractText(html),
      crawl_status: "success",
      http_status: response.status,
      html,
    };
  } catch {
    return { url, page_title: null, extracted_text: "", crawl_status: "error", http_status: null, html: "" };
  }
}

export async function crawlSchoolWebsite(seed: string, options?: { maxPages?: number; maxMs?: number }) {
  const maxPages = options?.maxPages ?? 6;
  const maxMs = options?.maxMs ?? 15000;
  const started = Date.now();
  const seedUrl = seed.endsWith("/") ? seed : `${seed}/`;
  const extras = seedList(seedUrl).filter((url) => url.replace(/\/$/, "") !== seedUrl.replace(/\/$/, ""));
  extras.sort((a, b) => priority(a) - priority(b));
  const queued = extras;
  const seen = new Set<string>();
  const pages: CrawledPage[] = [];
  let homeHtml = "";
  let homeUrl = seedUrl;

  const enqueue = (url: string) => {
    const id = canon(url);
    if (!seen.has(id) && !queued.some((item) => canon(item) === id) && !skip(url)) queued.push(id);
  };

  const take = async (url: string, keepErrors: boolean) => {
    const id = canon(url);
    if (seen.has(id) || skip(url) || pages.length >= maxPages) return;
    seen.add(id);
    const remain = maxMs - (Date.now() - started);
    if (remain <= 0) return;
    const page = await fetchPage(url, remain);
    const { html, ...publicPage } = page;
    const finalId = canon(publicPage.url);
    seen.add(finalId);
    if (!keepErrors && publicPage.crawl_status !== "success") return;
    if (pages.some((row) => canon(row.url) === finalId)) return;
    pages.push(publicPage);
    if (!html || publicPage.crawl_status !== "success") return;
    if (!homeHtml) {
      homeHtml = html;
      homeUrl = publicPage.url;
    }
    for (const link of extractLinks(page.url, html)) enqueue(link);
  };

  await take(seedUrl, true);
  queued.sort((a, b) => priority(a) - priority(b));

  while (queued.length && pages.length < maxPages && Date.now() - started < maxMs) {
    const batch = queued.splice(0, 3);
    await Promise.all(batch.map((url) => take(url, false)));
  }

  const withText = pages.filter((page) => page.extracted_text.length > 80).length;
  return { pages, withText, homeHtml, homeUrl };
}
