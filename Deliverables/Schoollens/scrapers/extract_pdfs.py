"""Download PDF links from website crawls, extract text with pdfplumber, load as raw_sources."""

import hashlib
import io
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber
from supabase import create_client

USER_AGENT = "SchoolLens/1.0 (school evidence platform; pdf extract)"


def _client():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return create_client(url, key)


def _pdf_text(data):
    pages = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages[:20]:
            text = page.extract_text() or ""
            if text.strip():
                pages.append(text)
    return "\n\n".join(pages).strip()


def _hash(url, text):
    digest = hashlib.sha256(f"{url}\n{text}".encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def _collect_links(db, school_id):
    sources = (
        db.table("raw_sources")
        .select("raw_json")
        .eq("school_id", school_id)
        .eq("source_type", "website")
        .execute()
        .data
        or []
    )
    seen = {}
    for row in sources:
        raw = row.get("raw_json") or {}
        if raw.get("kind") == "pdf":
            continue
        for item in raw.get("pdf_links_found") or []:
            url = (item.get("url") if isinstance(item, dict) else None) or ""
            if url.lower().endswith(".pdf"):
                seen[url] = item.get("linked_from") if isinstance(item, dict) else None
    return seen


def _already(db, school_id):
    rows = (
        db.table("raw_sources")
        .select("raw_json")
        .eq("school_id", school_id)
        .eq("source_type", "website")
        .execute()
        .data
        or []
    )
    hashes = set()
    urls = set()
    for row in rows:
        raw = row.get("raw_json") or {}
        if raw.get("url"):
            urls.add(raw["url"])
        if raw.get("content_hash"):
            hashes.add(raw["content_hash"])
    return urls, hashes


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: python extract_pdfs.py <school_id> [max_pdfs]")
    school_id = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    db = _client()
    links = _collect_links(db, school_id)
    have_urls, have_hashes = _already(db, school_id)
    now = datetime.now(timezone.utc).isoformat()
    written = 0
    for url, linked_from in list(links.items())[:limit]:
        if url in have_urls:
            continue
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                data = response.read()
        except Exception as exc:
            print(f"FAIL {url}: {exc}")
            time.sleep(1.2)
            continue
        text = _pdf_text(data)
        if not text:
            print(f"EMPTY {url}")
            time.sleep(1.2)
            continue
        digest = _hash(url, text)
        if digest in have_hashes:
            print(f"DUP {url}")
            continue
        file_url = None
        try:
            path = f"{school_id}/{digest.replace(':', '-')}.pdf"
            db.storage.from_("evidence-pdfs").upload(path, data, {"content-type": "application/pdf"})
            file_url = db.storage.from_("evidence-pdfs").get_public_url(path)
        except Exception:
            file_url = None
        page = {
            "school_id": school_id,
            "source_type": "website",
            "kind": "pdf",
            "crawl_status": "success",
            "url": url,
            "page_title": Path(url).name,
            "extracted_text": text[:20000],
            "content_hash": digest,
            "linked_from": linked_from,
            "file_url": file_url,
            "crawled_at": now,
        }
        db.table("raw_sources").insert(
            {
                "school_id": school_id,
                "source_type": "website",
                "crawl_status": "success",
                "raw_json": page,
                "content_hash": digest,
                "crawled_at": now,
            }
        ).execute()
        written += 1
        print(f"OK {url}")
        time.sleep(1.2)
    print(f"wrote {written}")


if __name__ == "__main__":
    main()
