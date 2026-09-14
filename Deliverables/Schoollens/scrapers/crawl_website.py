"""Section 7.1 generic website crawl. Writes Section 7.2 page-object JSON."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

import trafilatura

PRIORITY = (
    "about",
    "admission",
    "fee",
    "tuition",
    "curriculum",
    "contact",
    "branch",
    "campus",
    "academic",
)
MAX_PAGES = 40
MAX_SECONDS = 180
DELAY_SECONDS = 1.5
USER_AGENT = "SchoolLensBot/1.0 (+https://schoollens.local; research crawl)"


class _LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs: list[str] = []
        self.iframes: list[tuple[str, str]] = []
        self.title = ""
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "a" and attrs_dict.get("href"):
            self.hrefs.append(attrs_dict["href"])
        if tag == "iframe" and attrs_dict.get("src"):
            self.iframes.append((attrs_dict["src"], attrs_dict.get("title") or attrs_dict.get("name") or "iframe"))
        if tag == "title":
            self._in_title = True

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data


def _utc_now():
    return datetime.now(timezone.utc).isoformat()


def _load_env():
    root = Path(__file__).resolve().parents[1]
    for env_path in (root / "web" / ".env.local", root / "rag-service" / ".env", root / "rag-service" / ".env.example"):
        if not env_path.exists():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    if not os.environ.get("SUPABASE_URL"):
        os.environ["SUPABASE_URL"] = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")


def _request(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xml;q=0.9,*/*;q=0.8"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.getcode(), response.read(), response.headers.get_content_charset() or "utf-8", response.geturl()


def _fetch(url):
    try:
        status, body, charset, final = _request(url)
        text = body.decode(charset, errors="replace")
        return status, text, final, None
    except urllib.error.HTTPError as exc:
        return exc.code, "", url, str(exc)
    except Exception as exc:
        return 0, "", url, str(exc)


def _norm_url(base, href):
    joined = urllib.parse.urljoin(base, href)
    parsed = urllib.parse.urlparse(joined)
    if parsed.scheme not in ("http", "https"):
        return None
    parsed = parsed._replace(fragment="")
    return urllib.parse.urlunparse(parsed)


def _same_host(seed, url):
    return urllib.parse.urlparse(seed).netloc.lower().removeprefix("www.") == urllib.parse.urlparse(
        url
    ).netloc.lower().removeprefix("www.")


def _is_asset(url):
    path = urllib.parse.urlparse(url).path.lower()
    return path.endswith(
        (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".css", ".js", ".ico", ".woff", ".woff2", ".mp4", ".zip")
    )


def _priority(url):
    path = urllib.parse.urlparse(url).path.lower()
    return 0 if any(key in path for key in PRIORITY) else 1


def _robots(seed):
    parsed = urllib.parse.urlparse(seed)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    parser = urllib.robotparser.RobotFileParser()
    parser.set_url(robots_url)
    try:
        parser.read()
    except Exception:
        return None
    return parser


def _sitemap_urls(seed):
    parsed = urllib.parse.urlparse(seed)
    roots = [
        f"{parsed.scheme}://{parsed.netloc}/sitemap.xml",
        f"{parsed.scheme}://{parsed.netloc}/wp-sitemap.xml",
        f"{parsed.scheme}://{parsed.netloc}/sitemap_index.xml",
    ]
    found: list[str] = []
    for sitemap in roots:
        status, text, _, _ = _fetch(sitemap)
        if status != 200 or "<url" not in text.lower():
            continue
        found.extend(re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", text, flags=re.I))
        if found:
            break
    return [url.strip() for url in found if _same_host(seed, url.strip())]


def _looks_js_shell(html, extracted):
    if len(html) < 4000:
        return False
    if len(extracted.strip()) >= 200:
        return False
    return html.lower().count("<script") >= 5


def _looks_blocked(status, html):
    if status in (401, 403, 429, 503):
        return True
    sample = html.lower()[:4000]
    if "cf-challenge" in sample or "cf-browser-verification" in sample:
        return True
    if "access denied" in sample:
        return True
    # Contact-form reCAPTCHA is not a bot wall. Only treat captcha as blocked
    # when it looks like an interstitial challenge, not a widget on a real page.
    if "captcha" in sample:
        widget = "recaptcha/api.js" in sample or "g-recaptcha" in html.lower()
        if widget and status == 200 and len(html) > 5000:
            return False
        return True
    return False


def _to_unicode(text):
    if not text or not re.search(r"[\u1000-\u109F]", text):
        return text
    try:
        from myanmartools import ZawgyiDetector

        if ZawgyiDetector().get_zawgyi_probability(text) < 0.85:
            return text
        from icu import Transliterator

        return Transliterator.createInstance("Zawgyi-my").transliterate(text)
    except Exception:
        return text


def _language(text):
    return "my" if re.search(r"[\u1000-\u109F]", text) else "en"


def _parse_html(html):
    parser = _LinkParser()
    try:
        parser.feed(html)
    except Exception:
        pass
    return parser


def _extract_text(html, url):
    extracted = trafilatura.extract(html, url=url, include_comments=False, include_tables=True) or ""
    return _to_unicode(extracted.strip())


def _playwright_html(url):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=20000)
            html = page.content()
            browser.close()
            return html
    except Exception:
        return None


def _page_object(school_id, url, status, html, extracted, crawl_status, pdfs, embeds):
    parser = _parse_html(html) if html else _LinkParser()
    return {
        "school_id": school_id,
        "source_type": "website",
        "crawl_status": crawl_status,
        "url": url,
        "page_title": parser.title.strip() or None,
        "extracted_text": extracted,
        "content_hash": f"sha256:{hashlib.sha256((url + '\n' + extracted).encode('utf-8')).hexdigest()}",
        "language_detected": _language(extracted),
        "pdf_links_found": pdfs,
        "embedded_links_found": embeds,
        "http_status": status,
        "crawled_at": _utc_now(),
    }


def crawl(seed, school_id):
    started = time.monotonic()
    robots = _robots(seed)
    queued: list[str] = []
    seen: set[str] = set()
    pages: list[dict] = []
    hit_cap = False

    sitemap = _sitemap_urls(seed)
    start_urls = sitemap or [seed]
    for url in sorted(start_urls, key=_priority):
        if url not in seen:
            queued.append(url)
            seen.add(url)
    if seed not in seen:
        queued.insert(0, seed)
        seen.add(seed)

    depth = {seed: 0}
    for url in queued:
        depth.setdefault(url, 0 if url == seed else 1)

    while queued and len(pages) < MAX_PAGES and (time.monotonic() - started) < MAX_SECONDS:
        queued.sort(key=_priority)
        url = queued.pop(0)
        if robots is not None and not robots.can_fetch(USER_AGENT, url):
            pages.append(_page_object(school_id, url, None, "", "", "disallowed", [], []))
            continue

        status, html, final_url, error = _fetch(url)
        time.sleep(DELAY_SECONDS)

        if _looks_blocked(status, html):
            pages.append(_page_object(school_id, final_url or url, status, html, "", "blocked", [], []))
            continue
        if status != 200:
            pages.append(
                _page_object(
                    school_id,
                    final_url or url,
                    status,
                    html,
                    "",
                    "blocked" if status in (401, 403, 429) else "success",
                    [],
                    [],
                )
            )
            if pages[-1]["crawl_status"] == "success":
                pages[-1]["extracted_text"] = ""
                pages[-1]["crawl_note"] = error or f"http {status}"
            continue

        extracted = _extract_text(html, final_url)
        if _looks_js_shell(html, extracted):
            rendered = _playwright_html(final_url)
            if rendered:
                html = rendered
                extracted = _extract_text(html, final_url)
            elif len(extracted) < 80:
                pages.append(_page_object(school_id, final_url, status, html, extracted, "blocked", [], []))
                pages[-1]["crawl_note"] = "js_shell_no_playwright"
                continue

        parser = _parse_html(html)
        pdfs = []
        embeds = [{"url": src, "type": "iframe", "label": label, "found_on_page": final_url} for src, label in parser.iframes]
        for href in parser.hrefs:
            absolute = _norm_url(final_url, href)
            if not absolute or not _same_host(seed, absolute) or _is_asset(absolute):
                continue
            if absolute.lower().endswith(".pdf"):
                pdfs.append({"url": absolute, "linked_from": final_url})
                continue
            child_depth = depth.get(url, 0) + 1
            if child_depth <= 2 and absolute not in seen:
                seen.add(absolute)
                queued.append(absolute)
                depth[absolute] = child_depth

        pages.append(_page_object(school_id, final_url, status, html, extracted, "success", pdfs, embeds))

    if len(pages) >= MAX_PAGES or (time.monotonic() - started) >= MAX_SECONDS:
        hit_cap = True
    return pages, hit_cap


def _resolve_school(name, school_id):
    from supabase import create_client

    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    query = db.table("schools").select("id, name, official_website_url")
    if school_id:
        rows = query.eq("id", school_id).limit(1).execute().data
    else:
        rows = query.ilike("name", f"%{name}%").limit(1).execute().data
    row = rows[0] if rows else None
    if not row:
        raise SystemExit("school not found")
    return db, row


def main():
    parser = argparse.ArgumentParser(description="Generic Section 7.1 website crawl")
    parser.add_argument("url")
    parser.add_argument("--school", default="ILBC")
    parser.add_argument("--school-id")
    args = parser.parse_args()

    _load_env()
    if not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

    db, school = _resolve_school(args.school, args.school_id)
    seed = args.url.rstrip("/") + "/"
    if school.get("official_website_url") != args.url:
        db.table("schools").update({"official_website_url": args.url}).eq("id", school["id"]).execute()

    pages, hit_cap = crawl(seed, school["id"])
    out_dir = Path(__file__).resolve().parents[1] / "raw-crawls" / school["id"]
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{datetime.now(timezone.utc).date().isoformat()}.json"
    out_path.write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding="utf-8")

    success = sum(1 for page in pages if page["crawl_status"] == "success" and page.get("extracted_text"))
    blocked = sum(1 for page in pages if page["crawl_status"] == "blocked")
    disallowed = sum(1 for page in pages if page["crawl_status"] == "disallowed")
    print(
        f"wrote {out_path} pages={len(pages)} success_with_text={success} "
        f"blocked={blocked} disallowed={disallowed} hit_cap={hit_cap}"
    )


if __name__ == "__main__":
    main()
