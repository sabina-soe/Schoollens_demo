import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

function logoDir() {
  return path.join(process.cwd(), "public", "school-logos", "extracted");
}

function logoCandidates(html: string, base: string) {
  const found: string[] = [];
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*apple-touch-icon[^"']*["']/i,
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    try {
      found.push(new URL(match[1], base).toString());
    } catch {
      continue;
    }
  }
  try {
    found.push(new URL("/favicon.ico", base).toString());
    found.push(new URL("/favicon.png", base).toString());
  } catch {
    /* ignore */
  }
  const fromHtml = html.matchAll(/https?:\/\/[^"'\\\s>]+\.(?:png|jpe?g|svg|webp|ico)(?:\?[^"'\\\s>]*)?/gi);
  for (const match of fromHtml) {
    const url = match[0];
    if (/logo|icon|favicon|mark|brand/i.test(url)) found.unshift(url);
  }
  return [...new Set(found)];
}

function extensionFor(url: string, contentType: string) {
  const type = contentType.toLowerCase();
  if (type.includes("svg")) return ".svg";
  if (type.includes("webp")) return ".webp";
  if (type.includes("jpeg") || type.includes("jpg")) return ".jpg";
  if (type.includes("png")) return ".png";
  if (type.includes("icon") || type.includes("ico")) return ".ico";
  const fromUrl = url.toLowerCase().match(/\.(svg|webp|png|jpe?g|ico)(\?|$)/);
  if (fromUrl) return fromUrl[1] === "jpeg" ? ".jpg" : `.${fromUrl[1]}`;
  return ".png";
}

export async function saveSchoolLogo(schoolId: string, html: string, pageUrl: string) {
  if (process.env.VERCEL || !html) return null;
  const dir = logoDir();
  mkdirSync(dir, { recursive: true });
  for (const url of logoCandidates(html, pageUrl)) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      const type = response.headers.get("content-type") || "";
      if (type.includes("text/html")) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 80 || bytes.length > 2_000_000) continue;
      const ext = extensionFor(url, type);
      const fileName = `${schoolId}${ext}`;
      writeFileSync(path.join(dir, fileName), bytes);
      const publicPath = `/school-logos/extracted/${fileName}`;
      const indexFile = path.join(dir, "index.json");
      const index = existsSync(indexFile)
        ? (JSON.parse(readFileSync(indexFile, "utf8")) as Record<string, string>)
        : {};
      index[schoolId] = `${publicPath}?v=${Date.now()}`;
      writeFileSync(indexFile, JSON.stringify(index, null, 2), "utf8");
      return index[schoolId];
    } catch {
      continue;
    }
  }
  return null;
}
