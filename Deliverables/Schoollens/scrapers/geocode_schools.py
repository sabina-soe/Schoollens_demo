"""Batch-geocode school addresses into schools.location via Nominatim (Section 4.6.1)."""

import hashlib
import json
import os
import sys
import time
import urllib.parse
import urllib.request

from supabase import create_client

NOMINATIM = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "SchoolLens/1.0 (school evidence platform; geocode batch)"

CITIES = [
    ("Yangon", ["ရန်ကုန်", "yangon"]),
    ("Mandalay", ["မန္တလေး", "mandalay"]),
    ("Naypyidaw", ["နေပြည်တော်", "nay pyi taw", "naypyitaw", "naypyidaw"]),
    ("Mawlamyine", ["မော်လမြိုင်", "mawlamyine"]),
    ("Pyin Oo Lwin", ["ပြင်ဦးလွင်", "pyin oo lwin"]),
    ("Monywa", ["မုံရွာ", "monywa"]),
    ("Sagaing", ["စစ်ကိုင်း", "sagaing"]),
    ("Myitkyina", ["မြစ်ကြီးနား", "myitkyina"]),
    ("Hpa-an", ["ဘားအံ", "hpa-an", "hpa an"]),
    ("Dawei", ["ထားဝယ်", "dawei"]),
    ("Myeik", ["မြိတ်", "myeik"]),
    ("Taunggyi", ["တောင်ကြီး", "taunggyi"]),
    ("Bago", ["ပဲခူး", "bago", "pegu"]),
    ("Pathein", ["ပုသိမ်", "pathein"]),
    ("Magway", ["မကွေး", "magway"]),
    ("Taungoo", ["တောင်ငူ", "taungoo", "toungoo"]),
    ("Pyay", ["ပြည်", "pyay", "pyi"]),
]


def _client():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return create_client(url, key)


def _geocode(query_text):
    query = urllib.parse.urlencode({"q": query_text, "format": "json", "limit": 1, "countrycodes": "mm"})
    request = urllib.request.Request(f"{NOMINATIM}?{query}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not payload:
        return None
    hit = payload[0]
    lat = float(hit["lat"])
    lng = float(hit["lon"])
    importance = float(hit.get("importance") or 0)
    confidence = "high" if importance >= 0.5 else "low"
    return lat, lng, confidence


def _city(address):
    hay = str(address or "").lower()
    for name, markers in CITIES:
        if any(marker in hay for marker in markers):
            return name
    return None


def _jitter(school_id, lat, lng):
    digest = hashlib.sha256(school_id.encode("utf-8")).digest()
    lat += (digest[0] - 128) / 20000
    lng += (digest[1] - 128) / 20000
    return lat, lng


def _load_env():
    from pathlib import Path

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


def main():
    _load_env()
    db = _client()
    rows = db.table("schools").select("id, name, address, location, geocode_confidence").execute().data or []
    needle = None
    for arg in sys.argv[1:]:
        if arg.startswith("--ilike="):
            needle = arg.split("=", 1)[1].lower()
    if needle:
        rows = [row for row in rows if needle in str(row.get("name") or "").lower()]
    pending = [
        row
        for row in rows
        if row.get("address")
        and (not row.get("location") or row.get("geocode_confidence") in (None, "", "failed"))
    ]
    if "--all-missing" not in sys.argv and not needle:
        pending = pending[: int(os.environ.get("GEOCODE_LIMIT", "20"))]
    print(f"geocoding {len(pending)} school(s)")
    city_cache = {}
    for row in pending:
        city = _city(row.get("address"))
        queries = [f"{row['address']}, Myanmar"]
        if city:
            queries.append(f"{row.get('name')}, {city}, Myanmar")
            queries.append(f"{city}, Myanmar")
        result = None
        used = "street"
        try:
            for query in queries:
                if query in city_cache:
                    result = city_cache[query]
                else:
                    result = _geocode(query)
                    time.sleep(1.1)
                    if city and query.endswith(f"{city}, Myanmar"):
                        city_cache[query] = result
                if result:
                    used = "city" if city and query.endswith(f"{city}, Myanmar") else "street"
                    break
        except Exception as exc:
            print(f"FAIL {row['name']}: {exc}")
            db.table("schools").update({"geocode_confidence": "failed"}).eq("id", row["id"]).execute()
            continue
        if not result:
            print(f"MISS {row['name']}")
            db.table("schools").update({"geocode_confidence": "failed"}).eq("id", row["id"]).execute()
            continue
        lat, lng, confidence = result
        if used == "city":
            lat, lng = _jitter(row["id"], lat, lng)
            confidence = "low"
        db.table("schools").update(
            {
                "location": f"({lng},{lat})",
                "geocode_confidence": confidence,
            }
        ).eq("id", row["id"]).execute()
        print(f"OK {row['name']} {lat},{lng} {confidence} {used}")


if __name__ == "__main__":
    main()
