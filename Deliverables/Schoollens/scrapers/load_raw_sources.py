"""Load Section 7.2 page objects or Apify facebook-posts-scraper dumps into raw_sources."""

import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from supabase import create_client


def _utc_now():
    return datetime.now(timezone.utc).isoformat()


def _page_objects(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return [data]
    raise ValueError("expected a list of page objects")


def _norm_fb_url(url):
    if not url:
        return ""
    parsed = urlparse(url.strip())
    host = (parsed.netloc or "").lower().replace("m.facebook.com", "www.facebook.com")
    path = (parsed.path or "").rstrip("/").lower()
    return f"https://{host}{path}" if host else ""


def _compact(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def _is_apify_post(page):
    return bool(page.get("postId") or page.get("facebookUrl") or page.get("pageName"))


def _is_url_stub(page):
    return set(page.keys()) <= {"url"} or (
        not page.get("postId") and not page.get("text") and not page.get("extracted_text") and not page.get("content_hash")
    )


def _extracted_text(page):
    if isinstance(page.get("extracted_text"), str) and page["extracted_text"].strip():
        return page["extracted_text"]
    parts = []
    if isinstance(page.get("text"), str) and page["text"].strip():
        parts.append(page["text"].strip())
    for media in page.get("media") or []:
        if isinstance(media, dict) and isinstance(media.get("ocrText"), str) and media["ocrText"].strip():
            parts.append(media["ocrText"].strip())
    return "\n\n".join(parts)


def _content_hash(url, extracted):
    digest = hashlib.sha256(f"{url}\n{extracted}".encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def _school_index(client):
    return client.table("schools").select("id, name, official_facebook_url").execute().data or []


def _match_school(schools, page):
    fb = _norm_fb_url(page.get("facebookUrl") or page.get("url") or "")
    page_name = page.get("pageName") or ""
    user_name = (page.get("user") or {}).get("name") if isinstance(page.get("user"), dict) else ""
    candidates = [_compact(page_name), _compact(user_name)]
    for school in schools:
        official = _norm_fb_url(school.get("official_facebook_url") or "")
        name = school.get("name") or ""
        compact_name = _compact(name)
        if official and fb and (official == fb or official in fb or fb in official):
            return school["id"]
        if page_name and official and _compact(page_name) and _compact(page_name) in _compact(official):
            return school["id"]
        if user_name and name and (user_name.lower() in name.lower() or name.lower() in user_name.lower()):
            return school["id"]
        for candidate in candidates:
            if len(candidate) >= 4 and (candidate in compact_name or compact_name in candidate):
                return school["id"]
            if len(candidate) >= 4 and candidate[:4] in compact_name:
                return school["id"]
    return None


def _normalize_page(page, schools):
    if page.get("school_id") and page.get("url") and page.get("content_hash"):
        return page, None

    if _is_url_stub(page) and not _is_apify_post(page):
        return None, "skip_stub"

    if not _is_apify_post(page) and not page.get("extracted_text"):
        return None, "missing school_id, url, or content_hash"

    school_id = page.get("school_id") or _match_school(schools, page)
    url = page.get("url") or page.get("facebookUrl")
    extracted = _extracted_text(page)
    if not school_id:
        return None, "no matching school"
    if not url:
        return None, "missing url"
    if not extracted.strip():
        return None, "no extractable text"

    language = "my" if re.search(r"[\u1000-\u109F]", extracted) else "en"
    normalized = dict(page)
    normalized.update(
        {
            "school_id": school_id,
            "source_type": page.get("source_type") or "fb_page",
            "crawl_status": page.get("crawl_status") or "success",
            "url": url,
            "page_title": user_title(page),
            "extracted_text": extracted,
            "content_hash": page.get("content_hash") or _content_hash(url, extracted),
            "language_detected": page.get("language_detected") or language,
            "crawled_at": page.get("crawled_at") or page.get("time"),
        }
    )
    return normalized, None


def user_title(page):
    if isinstance(page.get("user"), dict) and page["user"].get("name"):
        return page["user"]["name"]
    return page.get("page_title") or page.get("pageName")


def _already_loaded(client, school_id, url, content_hash):
    query = (
        client.table("raw_sources")
        .select("id")
        .eq("school_id", school_id)
        .eq("content_hash", content_hash)
        .filter("raw_json->>url", "eq", url)
        .limit(1)
    )
    return bool(query.execute().data)


def _load_folder(client, folder: Path):
    ingested = 0
    skipped = 0
    blocked = 0
    disallowed = 0
    unmatched = 0
    stubs = 0
    failed = []
    schools = _school_index(client)

    for path in sorted(folder.rglob("*.json")):
        try:
            pages = _page_objects(path)
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            failed.append({"file": str(path), "message": str(exc)})
            continue

        for page in pages:
            if not isinstance(page, dict):
                failed.append({"file": str(path), "message": "page object is not an object"})
                continue

            normalized, reason = _normalize_page(page, schools)
            if reason == "skip_stub":
                stubs += 1
                continue
            if reason == "no matching school":
                unmatched += 1
                continue
            if normalized is None:
                failed.append({"file": str(path), "url": page.get("url"), "message": reason})
                continue

            crawl_status = normalized.get("crawl_status")
            if crawl_status == "blocked":
                blocked += 1
            elif crawl_status == "disallowed":
                disallowed += 1

            try:
                if _already_loaded(
                    client,
                    normalized["school_id"],
                    normalized["url"],
                    normalized["content_hash"],
                ):
                    skipped += 1
                    continue

                client.table("raw_sources").insert(
                    {
                        "school_id": normalized["school_id"],
                        "source_type": normalized.get("source_type"),
                        "crawl_status": crawl_status,
                        "raw_json": normalized,
                        "content_hash": normalized["content_hash"],
                        "crawled_at": normalized.get("crawled_at"),
                    }
                ).execute()
                ingested += 1
            except Exception as exc:
                failed.append({"file": str(path), "url": normalized.get("url"), "message": str(exc)})

    return ingested, skipped, blocked, disallowed, unmatched, stubs, failed


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

    folder = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("raw-crawls")
    if not folder.is_dir():
        sys.exit(f"folder not found: {folder}")

    client = create_client(url, key)
    started_at = _utc_now()
    ingested, skipped, blocked, disallowed, unmatched, stubs, failed = _load_folder(client, folder)
    finished_at = _utc_now()

    status = "error" if failed else "success"
    source_type = "fb_page" if ingested or unmatched or stubs else "website"

    errors = {
        "skipped_duplicates": skipped,
        "blocked": blocked,
        "disallowed": disallowed,
        "unmatched_school": unmatched,
        "skipped_stubs": stubs,
        "failed": failed,
    }

    client.table("sync_jobs").insert(
        {
            "source_type": source_type,
            "started_at": started_at,
            "finished_at": finished_at,
            "status": status,
            "rows_ingested": ingested,
            "errors": errors,
        }
    ).execute()

    print(
        f"{status}: ingested={ingested} skipped_duplicates={skipped} "
        f"unmatched_school={unmatched} skipped_stubs={stubs} "
        f"blocked={blocked} disallowed={disallowed} failed={len(failed)}"
    )


if __name__ == "__main__":
    main()
