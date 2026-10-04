"""Ingest OCR'd school-fee posters into raw_sources, claims, evidence, and a fees claim group."""

from __future__ import annotations

import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTRACT_PATH = ROOT / "raw-crawls" / "school-fees" / "extracted-2026-09-20.json"
PUBLIC_FEES = ROOT / "web" / "public" / "school-fees"


def load_env():
    for env_path in (ROOT / "web" / ".env.local", ROOT / "web" / ".env"):
        if not env_path.exists():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    os.environ.setdefault("SUPABASE_URL", os.environ.get("NEXT_PUBLIC_SUPABASE_URL", ""))


def rest(method: str, path: str, payload=None, prefer: str | None = None):
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not key:
        raise RuntimeError("NEXT_PUBLIC_SUPABASE_ANON_KEY missing")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(f"{base}/rest/v1/{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} -> {err.code}: {body[:500]}") from err


def fetch_schools():
    rows = rest("GET", "schools?select=id,name,address,official_website_url,official_facebook_url&order=name&limit=2000")
    return rows or []


def norm(value: str | None) -> str:
    return " ".join((value or "").lower().replace("(", " ").replace(")", " ").split())


def score_school(school: dict, poster: dict) -> int:
    name = norm(school.get("name"))
    address = norm(school.get("address"))
    website = norm(school.get("official_website_url"))
    hay = f"{name} {address} {website}"
    score = 0
    for needle in poster.get("exclude") or []:
        if norm(needle) and norm(needle) in hay:
            return -100
    prefer = poster.get("prefer_id")
    if prefer and school["id"] == prefer:
        score += 50
    for needle in poster.get("match") or []:
        n = norm(needle)
        if n and n in name:
            score += 8 + min(len(n), 20)
        elif n and n in hay:
            score += 4
    for hint in poster.get("address_hint") or []:
        if norm(hint) and norm(hint) in address:
            score += 12
    website_hint = poster.get("website_hint")
    if website_hint and norm(website_hint) in website:
        score += 20
    email_hint = poster.get("email_hint")
    if email_hint and norm(email_hint) in hay:
        score += 10
    if "(1)" in (school.get("name") or "") or "(2)" in (school.get("name") or "") or "(3)" in (school.get("name") or ""):
        score -= 3
    return score


def pick_school(schools: list[dict], poster: dict):
    scored = [(score_school(school, poster), school) for school in schools]
    scored.sort(key=lambda item: item[0], reverse=True)
    if not scored or scored[0][0] < 8:
        return None, scored[0][0] if scored else 0
    top = scored[0][0]
    tied = [school for score, school in scored if score == top]

    def tie_key(school: dict):
        name = school.get("name") or ""
        exact = any(norm(needle) == norm(name) for needle in poster.get("match") or [])
        has_web = bool(school.get("official_website_url"))
        campusish = any(token in name for token in ("(1)", "(2)", "(3)", "Campus"))
        return (exact, has_web, not campusish, -len(name))

    tied.sort(key=tie_key, reverse=True)
    return tied[0], top


def main():
    load_env()
    if not os.environ.get("SUPABASE_URL"):
        sys.exit("missing SUPABASE_URL")
    posters = json.loads(EXTRACT_PATH.read_text(encoding="utf-8"))["posters"]
    schools = fetch_schools()
    match_only = "--match-only" in sys.argv
    now = datetime.now(timezone.utc).isoformat()
    report = []

    for poster in posters:
        school, score = pick_school(schools, poster)
        image = PUBLIC_FEES / poster["file"]
        if not school:
            report.append({"file": poster["file"], "status": "unmatched", "score": score})
            continue
        if not image.exists():
            report.append({"file": poster["file"], "status": "missing-image", "school": school["name"]})
            continue

        if match_only:
            report.append({"file": poster["file"], "status": "matched", "school": school["name"], "id": school["id"], "score": score})
            continue

        extracted = "\n".join(poster["claims"])
        digest = hashlib.sha256(f"{poster['file']}\n{extracted}".encode("utf-8")).hexdigest()
        existing = rest("GET", f"raw_sources?select=id&school_id=eq.{school['id']}&content_hash=eq.sha256:{digest}&limit=1")
        if existing:
            report.append({"file": poster["file"], "status": "already-ingested", "school": school["name"], "id": school["id"]})
            continue

        source_type = poster.get("source_type") or "website"
        trust = {"website": "official_website", "fb_page": "official_facebook"}.get(source_type, "community")
        raw_rows = rest(
            "POST",
            "raw_sources",
            {
                "school_id": school["id"],
                "source_type": source_type,
                "crawl_status": "success",
                "raw_json": {
                    "url": f"/school-fees/{poster['file']}",
                    "file_url": f"/school-fees/{poster['file']}",
                    "page_title": poster.get("label") or poster["file"],
                    "extracted_text": extracted,
                    "ocr_date": "2026-09-20",
                    "source_kind": "fee_poster",
                },
                "content_hash": f"sha256:{digest}",
                "crawled_at": now,
            },
            prefer="return=representation",
        )
        raw_id = raw_rows[0]["id"]

        group_rows = rest(
            "POST",
            "claim_groups",
            {
                "school_id": school["id"],
                "category": "fees",
                "confidence_label": "likely",
                "reconciliation_note": (
                    f"Single published fee announcement ({poster['file']}). "
                    "Amounts are as printed on that poster; not yet cross-checked with another independent source."
                ),
                "last_updated": now,
            },
            prefer="return=representation",
        )
        group_id = group_rows[0]["id"]

        claim_ids = []
        for text in poster["claims"]:
            claim_rows = rest(
                "POST",
                "claims",
                {
                    "school_id": school["id"],
                    "claim_text": text,
                    "category": "fees",
                    "language": "en",
                    "scope": "branch",
                    "source_type": source_type,
                    "source_trust_tier": trust,
                    "created_at": now,
                },
                prefer="return=representation",
            )
            claim_id = claim_rows[0]["id"]
            claim_ids.append(claim_id)
            rest(
                "POST",
                "evidence",
                {
                    "claim_id": claim_id,
                    "raw_source_id": raw_id,
                    "file_url": f"/school-fees/{poster['file']}",
                    "original_url": f"/school-fees/{poster['file']}",
                    "evidence_type": "photo",
                    "source_excerpt": text,
                    "uploaded_at": now,
                },
            )
            rest("POST", "claim_group_members", {"claim_group_id": group_id, "claim_id": claim_id})

        rest(
            "POST",
            "claim_changes",
            {
                "school_id": school["id"],
                "claim_group_id": group_id,
                "change_type": "new",
                "summary_text": f"Fee announcement poster added: {poster.get('label') or poster['file']}.",
                "detected_at": now,
            },
        )
        report.append(
            {
                "file": poster["file"],
                "status": "ingested",
                "school": school["name"],
                "id": school["id"],
                "claims": len(claim_ids),
                "score": score,
            }
        )

    print(json.dumps(report, ensure_ascii=False, indent=2))
    if match_only:
        overlay = {}
        extracts = {item["file"]: item for item in posters}
        for row in report:
            if row.get("status") != "matched":
                continue
            poster = extracts[row["file"]]
            overlay.setdefault(row["id"], {"school_name": row["school"], "posters": []})
            overlay[row["id"]]["posters"].append(
                {
                    "file": row["file"],
                    "label": poster.get("label"),
                    "claims": poster["claims"],
                }
            )
        out = PUBLIC_FEES / "by-school.json"
        out.write_text(json.dumps(overlay, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nwrote {out} ({len(overlay)} schools)")


if __name__ == "__main__":
    main()
