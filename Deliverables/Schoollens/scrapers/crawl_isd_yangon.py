"""Crawl International Schools Database Yangon listings. Source-label every fact."""

from __future__ import annotations

import json
import re
import time
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw-crawls" / "isd"
OVERLAY = ROOT / "web" / "public" / "school-isd" / "by-school.json"
REGISTER = ROOT / "web" / "public" / "demo-register" / "schools.json"

UA = "SchoolLensBot/1.0 (+https://schoollens.local; research crawl)"
DELAY = 1.5
CITY = "https://www.international-schools-database.com/in/yangon"
TOP = "https://www.international-schools-database.com/in/yangon/top-schools-in-yangon"
NS = uuid.UUID("0f1bc000-0000-4000-8000-0000000000aa")
LIMIT = 23

SKIP = {
    "top-schools-in-yangon",
    "top-ib-international-schools-in-yangon",
    "top-british-international-schools-in-yangon",
    "top-american-international-schools-in-yangon",
}

KNOWN = {
    "the-international-school-yangon": "b0595924-73f7-49c4-94b0-b05017d77ef8",
    "myanmar-international-school-yangon": "6d0e010f-b869-4350-ae90-5a30f531d22d",
    "yangon-international-school": "038e4ef9-a8a3-4dca-9ea9-aad223fc71c5",
    "myanmar-international-school": "4dd4da53-4a6f-4bac-aca9-0fd9955e8bfc",
    "the-british-school-yangon": "22b3784f-3e04-4153-80e0-abe3000fe273",
    "kings-yangon-international-school": "3f96414d-5543-45ee-85da-16856c784bbe",
    "network-international-school-yangon": "6c78977f-de06-4078-bbd2-570e303276ae",
    "pride-international-school-myanmar-yangon": "d1e8deee-ed2c-43fb-a382-c3adb5d06861",
    "crane-international-school-yangon": "1254e3cd-5600-4fe5-bc9f-740995cc1f74",
    "french-international-school-of-yangon": "32c57574-25e9-43ec-82b6-76310ab44bbd",
}


def fetch(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=40) as response:
        return response.read().decode("utf-8", "replace")


def slugs_from(html: str):
    found = []
    for path in re.findall(r"/in/yangon/([a-z0-9-]+)", html, flags=re.I):
        slug = path.lower()
        if slug in SKIP or slug in found:
            continue
        found.append(slug)
    return found


def ranking_slugs(html: str):
    block = re.search(
        r"What are the best international schools in Yangon\?(.*?)(?:There are|See them|</ol>|</section>)",
        html,
        flags=re.I | re.S,
    )
    names = []
    if block:
        names = re.findall(r"<li[^>]*>\s*([^<]+)", block.group(1), flags=re.I)
    if not names:
        names = re.findall(r"<h2[^>]*>\s*([^<]+)</h2>", html, flags=re.I)
        names = [name.strip() for name in names if "international" in name.lower() or "school" in name.lower()]
    return [re.sub(r"\s+", " ", name).strip() for name in names if name.strip()]


def name_to_slug(name: str, slugs: list[str]):
    compact = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    for slug in slugs:
        if slug in compact or compact in slug:
            return slug
        key = slug.replace("-yangon", "").replace("yangon-", "")
        if key and key in compact:
            return slug
    return None


def school_ld(html: str):
    blocks = re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, flags=re.I | re.S)
    for block in blocks:
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        graph = data.get("@graph", [data] if isinstance(data, dict) else [])
        for item in graph:
            if str(item.get("@id", "")).endswith("#school"):
                return item
    return {}


def visible_text(html: str):
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&nbsp;", " ", text)
    return [line.strip() for line in text.splitlines() if line.strip()]


def yearly_fees(html: str):
    lines = visible_text(html)
    for index, line in enumerate(lines):
        if re.fullmatch(r"Yearly fees:?", line, flags=re.I) and index + 1 < len(lines):
            value = lines[index + 1]
            if re.search(r"not public|enquire|personalised|personalized|^from:?$|^fees$|^usd$|^mmk$", value, flags=re.I):
                return "Not published on ISD"
            if len(value) < 80 and re.search(r"\d", value):
                return value
    if re.search(r"does not make their fees public", html, flags=re.I):
        return "Not published on ISD"
    return None


def extra_languages(html: str):
    lines = visible_text(html)
    for index, line in enumerate(lines):
        if re.search(r"Extra languages", line, flags=re.I) and index + 1 < len(lines):
            value = lines[index + 1]
            if len(value) < 80 and not re.search(r"class size|school bus|native", value, flags=re.I):
                return value
    return None


def props(school: dict):
    values: dict[str, list[str]] = {}
    for item in school.get("additionalProperty") or []:
        name = item.get("name")
        value = item.get("value")
        if name and value:
            values.setdefault(name, []).append(str(value))
    return values


def record_from(slug: str, html: str, list_order: int | None):
    school = school_ld(html)
    address = school.get("address") or {}
    street = address.get("streetAddress") if isinstance(address, dict) else None
    extra = props(school)
    website = school.get("url") or ""
    if "international-schools-database.com" in website:
        website = ""
    source_url = f"https://www.international-schools-database.com/in/yangon/{slug}"
    return {
        "source_name": "International Schools Database",
        "source_url": source_url,
        "source_updated": school.get("dateModified"),
        "isd_slug": slug,
        "isd_list_order": list_order,
        "name": school.get("name") or slug.replace("-", " ").title(),
        "address": street,
        "ages": school.get("typicalAgeRange"),
        "student_count": school.get("numberOfStudents"),
        "curriculum": extra.get("Curriculum") or [],
        "average_class_size": (extra.get("Average Class Size") or [None])[0],
        "maximum_class_size": (extra.get("Maximum Class Size") or [None])[0],
        "languages": [item.get("name") for item in school.get("availableLanguage") or [] if item.get("name")],
        "extra_languages": extra_languages(html),
        "programmes": [item.get("name") for item in school.get("teaches") or [] if item.get("name")],
        "yearly_fees": yearly_fees(html),
        "official_website_url": website or None,
        "official_facebook_url": next(
            (link for link in school.get("sameAs") or [] if "facebook.com" in link),
            None,
        ),
    }


def school_id(slug: str):
    return KNOWN.get(slug) or str(uuid.uuid5(NS, slug))


def main():
    print("fetch city + ranking", flush=True)
    city_html = fetch(CITY)
    time.sleep(DELAY)
    top_html = fetch(TOP)
    all_slugs = slugs_from(city_html)
    ranked_names = ranking_slugs(top_html)
    ranked = []
    for name in ranked_names:
        slug = name_to_slug(name, all_slugs)
        if slug and slug not in ranked:
            ranked.append(slug)
    ordered = ranked + [slug for slug in all_slugs if slug not in ranked]
    chosen = ordered[:LIMIT]
    print(f"city={len(all_slugs)} ranked={len(ranked)} crawl={len(chosen)}", flush=True)

    overlay = {}
    raw = []
    register = json.loads(REGISTER.read_text(encoding="utf-8"))
    by_id = {row["id"]: row for row in register["schools"]}
    added = []

    for index, slug in enumerate(chosen, start=1):
        url = f"https://www.international-schools-database.com/in/yangon/{slug}"
        print(f"crawl {index}/{len(chosen)} {slug}", flush=True)
        html = fetch(url)
        time.sleep(DELAY)
        fact = record_from(slug, html, index if slug in ranked else None)
        sid = school_id(slug)
        overlay[sid] = fact
        raw.append({"school_id": sid, **fact})
        if sid not in by_id:
            row = {
                "id": sid,
                "name": fact["name"],
                "address": fact.get("address"),
                "curriculum_type": ", ".join(fact["curriculum"]) or None,
                "school_group_id": None,
                "moe_approved_from": None,
                "moe_approved_to": None,
                "official_website_url": fact.get("official_website_url"),
                "official_facebook_url": fact.get("official_facebook_url"),
                "location": None,
                "geocode_confidence": None,
            }
            register["schools"].append(row)
            by_id[sid] = row
            added.append(fact["name"])
        else:
            row = by_id[sid]
            if not row.get("address") and fact.get("address"):
                row["address"] = fact["address"]
            if not row.get("official_website_url") and fact.get("official_website_url"):
                row["official_website_url"] = fact["official_website_url"]
            if not row.get("curriculum_type") and fact["curriculum"]:
                row["curriculum_type"] = ", ".join(fact["curriculum"])

    RAW.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).date().isoformat()
    (RAW / f"{stamp}.json").write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
    OVERLAY.parent.mkdir(parents=True, exist_ok=True)
    OVERLAY.write_text(json.dumps(overlay, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REGISTER.write_text(json.dumps(register, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OVERLAY} schools={len(overlay)} new={added}", flush=True)


if __name__ == "__main__":
    main()
