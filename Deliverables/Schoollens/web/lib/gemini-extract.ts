import { existsSync, readFileSync } from "fs";
import path from "path";
import { ProxyAgent, fetch as proxiedFetch } from "undici";
import type { CrawledPage } from "@/lib/website-crawl";

const CATEGORIES = [
  "fees",
  "curriculum",
  "cca",
  "safety",
  "facilities",
  "class size",
  "contact info",
] as const;

export type ExtractedClaim = {
  claim_text: string;
  category: (typeof CATEGORIES)[number];
  language: string;
  scope: "network" | "branch";
  source_excerpt: string;
  source_url?: string;
};

const EXTRACT_PROMPT = `You extract discrete, structured factual claims from one school source.

Rules:
- Prefer parent-decision facts: fees, curriculum stages and subjects, CCA programmes, location, facilities, class size, teacher quality, and academic outcomes.
- Keep named programme lists. A subject list, fee table row, or CCA activity list is a fact, not a slogan.
- Skip mood copy, ranking language, and one-off event dates (showcases, concerts, sports days) unless they state a standing programme.
- Tag each claim with exactly one category: fees, curriculum, cca, safety, facilities, class size, contact info.
- Use cca for extracurricular, co-curricular, music lessons, sports clubs, STEAM clubs, and similar activity lists.
- Use curriculum for stages, subjects by year, exam frameworks (IGCSE, IAL, IB), medium of instruction, hours, and academic-year dates.
- claim_text must be normalized into English, even if the source is Burmese or mixed. This is the comparable fact.
- source_excerpt must be a short verbatim span copied from the source, in the original language. Never translate it. Burmese stays Burmese.
- language is the detected language of the source excerpt (e.g. en, my), not of claim_text.
- scope is "network" unless the fact is clearly about one campus/branch, in which case use "branch". Website content defaults to network.
- If the source has no usable factual claims, return {"claims": []}.

Source type: website
Source:
`;

function envFromFile(file: string, key: string) {
  if (!existsSync(file)) return "";
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.startsWith(`${key}=`)) continue;
    return trimmed.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

export function geminiApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    envFromFile(path.resolve(process.cwd(), ".env.local"), "GEMINI_API_KEY") ||
    envFromFile(path.resolve(process.cwd(), "..", "rag-service", ".env"), "GEMINI_API_KEY")
  );
}

function isLocationBlocked(text: string) {
  return /FAILED_PRECONDITION|location is not supported/i.test(text);
}

function proxyList() {
  const fromEnv = [process.env.GEMINI_PROXY, process.env.HTTPS_PROXY, process.env.HTTP_PROXY].filter(
    (value): value is string => Boolean(value && value.trim()),
  );
  return [...new Set([...fromEnv, "http://127.0.0.1:12334", ""])];
}

async function geminiPost(url: string, body: string) {
  let last: Response | null = null;
  let lastBlocked = "";
  for (const proxy of proxyList()) {
    try {
      const init: Parameters<typeof proxiedFetch>[1] = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(40000),
      };
      if (proxy) init.dispatcher = new ProxyAgent(proxy);
      const response = await proxiedFetch(url, init);
      last = response as unknown as Response;
      if (response.ok) return last;
      const payload = (await response.clone().json().catch(() => ({}))) as {
        error?: { message?: string; status?: string };
      };
      const message = payload.error?.message || "";
      if (isLocationBlocked(message) || payload.error?.status === "FAILED_PRECONDITION") {
        lastBlocked = message;
        continue;
      }
      return last;
    } catch {
      continue;
    }
  }
  if (last) return last;
  throw new Error(lastBlocked || "Could not reach Gemini. Check Hiddify mixed port 12334.");
}

export async function extractWebsiteClaims(pages: CrawledPage[]): Promise<{
  claims: ExtractedClaim[];
  error?: string;
}> {
  const key = geminiApiKey();
  if (!key) {
    return { claims: [], error: "GEMINI_API_KEY is missing. Add it to rag-service/.env or web/.env.local." };
  }
  const usable = pages.filter((page) => page.extracted_text.length > 80);
  if (!usable.length) return { claims: [], error: "No extractable page text." };

  const source = usable
    .map((page) => `URL: ${page.url}\nTitle: ${page.page_title || ""}\n${page.extracted_text}`)
    .join("\n\n")
    .slice(0, 14000);

  const models = ["gemini-3.5-flash-lite", "gemini-2.5-flash"];
  let payload: {
    error?: { message?: string; status?: string };
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  } = {};
  let lastStatus = 0;
  try {
  for (const model of models) {
    const response = await geminiPost(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${EXTRACT_PROMPT}${source}` }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    );
    lastStatus = response.status;
    payload = (await response.json().catch(() => ({}))) as typeof payload;
    if (response.ok) break;
    const message = payload.error?.message || "";
    if (isLocationBlocked(message) || payload.error?.status === "FAILED_PRECONDITION") {
      return { claims: [], error: "Gemini blocked this location. Connect VPN, then crawl again." };
    }
    if (response.status !== 404) {
      return { claims: [], error: message || "Gemini extract failed." };
    }
  }
  } catch (error) {
    return { claims: [], error: error instanceof Error ? error.message : "Gemini extract failed." };
  }
  if (lastStatus && lastStatus !== 200) {
    return { claims: [], error: payload.error?.message || "Gemini extract failed." };
  }
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  let parsed: { claims?: unknown } = {};
  try {
    parsed = JSON.parse(text) as { claims?: unknown };
  } catch {
    return { claims: [], error: "Gemini did not return JSON claims." };
  }
  const kept: ExtractedClaim[] = [];
  for (const row of Array.isArray(parsed.claims) ? parsed.claims : []) {
    if (!row || typeof row !== "object") continue;
    const claim = row as Record<string, unknown>;
    const category = String(claim.category || "");
    const scope = claim.scope === "branch" ? "branch" : "network";
    if (!CATEGORIES.includes(category as ExtractedClaim["category"])) continue;
    const claim_text = String(claim.claim_text || "").trim();
    const source_excerpt = String(claim.source_excerpt || "").trim();
    if (!claim_text || !source_excerpt) continue;
    const url = usable.find((page) => page.extracted_text.includes(source_excerpt.slice(0, 40)))?.url;
    kept.push({
      claim_text,
      category: category as ExtractedClaim["category"],
      language: String(claim.language || "en").slice(0, 8),
      scope,
      source_excerpt,
      source_url: url || usable[0]?.url,
    });
  }
  return { claims: kept };
}
