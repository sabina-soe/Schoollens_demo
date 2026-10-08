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
      headers: { "User-Agent": "SchoolLensBot/1.0 (+https://schoollens-demo.vercel.app)" },
      redirect: "follow",
      signal: AbortSignal.timeout(Math.max(1500, Math.min(4000, remainMs))),
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
  const maxMs = options?.maxMs ?? 8000;
  const started = Date.now();
  const queued = [...new Set(seedList(seed.endsWith("/") ? seed : `${seed}/`))];
  queued.sort((a, b) => priority(a) - priority(b));
  const seen = new Set<string>();
  const pages: CrawledPage[] = [];

  while (queued.length && pages.length < maxPages && Date.now() - started < maxMs) {
    const remain = maxMs - (Date.now() - started);
    const batch = queued.splice(0, 3).filter((url) => {
      if (seen.has(url) || skip(url)) return false;
      seen.add(url);
      return true;
    });
    if (!batch.length) continue;
    const fetched = await Promise.all(batch.map((url) => fetchPage(url, remain)));
    for (const page of fetched) {
      const { html, ...publicPage } = page;
      pages.push(publicPage);
      if (pages.length >= maxPages) break;
      if (!html) continue;
      for (const link of extractLinks(page.url, html)) {
        if (!seen.has(link) && !queued.includes(link)) queued.push(link);
      }
    }
  }

  const withText = pages.filter((page) => page.extracted_text.length > 80).length;
  return { pages, withText };
}
