"""Turn website crawl JSON into parent-facing curriculum, CCA, and facilities overlays."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw-crawls"
CURR = ROOT / "web" / "public" / "school-curriculum" / "by-school.json"
CCA = ROOT / "web" / "public" / "school-cca" / "by-school.json"
FAC = ROOT / "web" / "public" / "school-facilities" / "by-school.json"
REGISTER = ROOT / "web" / "public" / "demo-register" / "schools.json"

# Hand-built ILBC overlays stay; crawl refresh must not flatten them.
KEEP = {
    "f6c7b97d-8959-4d0c-841f-8148d10dcd4d",
    "d1e8deee-ed2c-43fb-a382-c3adb5d06861",
    "ba3c6f02-961b-42e1-8ef9-21d872abbda7",
    "5d88ea9c-c422-4696-88f3-5f2afb315530",
}

NOISE = re.compile(
    r"welcome|click here|read more|learn more|enquire|enroll now|copyright|cookie|privacy|"
    r"all rights|apply now|book a visit|follow us|subscribe|login|sign in",
    re.I,
)
FRAMEWORK = [
    (re.compile(r"french national|aefe|homologu", re.I), "French national curriculum"),
    (re.compile(r"international baccalaureate|\bib diploma|\bibdp\b|\bpyp\b|\bmyp\b", re.I), "IB"),
    (re.compile(r"national curriculum for england|british national curriculum|english national curriculum|international primary curriculum", re.I), "British National Curriculum"),
    (re.compile(r"cambridge", re.I), "Cambridge"),
    (re.compile(r"edexcel|pearson", re.I), "Edexcel Pearson IGCSE & IAL"),
    (re.compile(r"a[- ]?level", re.I), "IGCSE and A Level"),
    (re.compile(r"\bigcse\b", re.I), "IGCSE"),
]

SUBJECTS = [
    "English",
    "English Language",
    "English Literature",
    "Mathematics",
    "Further Mathematics",
    "Science",
    "Biology",
    "Chemistry",
    "Physics",
    "History",
    "Geography",
    "Economics",
    "Business Studies",
    "Accounting",
    "Computer Science",
    "Information Technology",
    "ICT",
    "Art",
    "Art and Design",
    "Music",
    "Drama",
    "Physical Education",
    "PSHE",
    "Myanmar",
    "Myanmarsar",
    "Chinese",
    "French",
    "Spanish",
    "German",
    "Thai",
    "Design Technology",
    "Global Perspectives",
    "Psychology",
    "Sociology",
    "TOK",
    "Theory of Knowledge",
    "Extended Essay",
    "CAS",
]

FACILITY_TERMS = [
    "library",
    "science laboratory",
    "science lab",
    "physics laboratory",
    "chemistry laboratory",
    "biology laboratory",
    "computer lab",
    "ICT lab",
    "swimming pool",
    "gymnasium",
    "sports hall",
    "football pitch",
    "football field",
    "basketball court",
    "playground",
    "canteen",
    "cafeteria",
    "auditorium",
    "theatre",
    "theater",
    "music room",
    "art room",
    "infirmary",
    "clinic",
    "dispensary",
    "air-conditioned classroom",
    "air conditioned classroom",
    "indoor sports",
    "outdoor sports",
    "maker space",
    "makerspace",
    "STEAM lab",
    "STEM lab",
]

CCA_TERMS = [
    "football",
    "soccer",
    "basketball",
    "swimming",
    "volleyball",
    "badminton",
    "table tennis",
    "tennis",
    "chess",
    "choir",
    "choir",
    "drama",
    "debate",
    "robotics",
    "coding",
    "art club",
    "music",
    "dance",
    "yoga",
    "scouts",
    "community service",
    "model united nations",
    "MUN",
    "athletics",
    "running",
    "gymnastics",
    "taekwondo",
    "karate",
]

STAGE_RULES = [
    ("preschool", re.compile(r"preschool|early.?years|kindergarten|nursery|eyfs", re.I), "Preschool / Early Years"),
    ("primary", re.compile(r"primary|elementary|key stage 1|key stage 2", re.I), "Primary"),
    ("secondary", re.compile(r"secondary|high school|key stage 3|key stage 4|igcse", re.I), "Secondary"),
    ("sixth", re.compile(r"a[- ]?level|ib[- ]diploma|sixth form|\bial\b", re.I), "Upper secondary"),
]


def _load(path: Path):
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _save(path: Path, data: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _latest_crawl(school_id: str):
    folder = RAW / school_id
    if not folder.is_dir():
        return []
    files = sorted(p for p in folder.glob("*.json") if p.name[:4].isdigit())
    if not files:
        return []
    data = json.loads(files[-1].read_text(encoding="utf-8"))
    return data if isinstance(data, list) else []


def _clean(line: str):
    text = re.sub(r"^[\s•\-–—*·\d.)]+", "", line).strip()
    return re.sub(r"\s+", " ", text)


def _is_item(text: str):
    if len(text) < 3 or len(text) > 80:
        return False
    if NOISE.search(text):
        return False
    if text.endswith(":"):
        return False
    if re.fullmatch(r"[\W\d]+", text):
        return False
    return True


def _bullets(text: str):
    found = []
    for raw in text.splitlines():
        line = raw.strip()
        if not (line.startswith(("-", "•", "*", "–")) or re.match(r"^\d+[.)]\s+", line)):
            continue
        item = _clean(line)
        if _is_item(item) and item not in found:
            found.append(item)
    return found


def _vocab(text: str, terms: list[str]):
    found = []
    for term in terms:
        if re.search(rf"(?<![\w]){re.escape(term)}(?![\w])", text, flags=re.I) and term not in found:
            found.append(term)
    return found


def _subject_like(item: str):
    if not _is_item(item):
        return False
    if len(item.split()) > 5:
        return False
    if re.search(r"\b(be|is|are|our|this|that|the|to|for|with|from|and/or)\b", item, re.I) and len(item.split()) > 3:
        return False
    return bool(re.match(r"^[A-Z0-9]", item))


def _blob(page):
    return f"{page.get('url') or ''} {page.get('page_title') or ''} {page.get('extracted_text') or ''}"


def _loc(page):
    return f"{page.get('url') or ''} {page.get('page_title') or ''}".lower()


def _kind(page):
    url = (page.get("url") or "").lower()
    loc = _loc(page)
    if any(
        token in url
        for token in (
            "privacy",
            "cookie",
            "career",
            "job",
            "news",
            "calendar",
            "enquiry",
            "apply",
            "governance",
            "legacy",
            "scholarship",
            "portal",
            "events",
            "student-services",
            "library-highlights",
        )
    ):
        return "skip"
    if "/library" in url:
        return "facilities"
    if re.search(r"extracurricular|after-school|after_school|co-curricular|/cca|/eca|clubs", loc):
        return "cca"
    if re.search(r"facilit|/campus", loc):
        return "facilities"
    if re.search(
        r"preschool|kindergarten|primary|secondary|curriculum|igcse|ib-diploma|/ib|a-level|early-years|/learning/",
        loc,
    ):
        return "curriculum"
    if "/about" in url:
        return "about"
    return "other"


def _framework(pages):
    blob = " ".join((page.get("extracted_text") or "")[:2500] for page in pages)
    for pattern, label in FRAMEWORK:
        if pattern.search(blob):
            return label
    return None


def _summary(text: str, limit=280):
    compact = " ".join((text or "").split())
    if not compact:
        return ""
    parts = re.split(r"(?<=[.!?])\s+", compact)
    out = ""
    for part in parts:
        if NOISE.search(part) and len(part) < 80:
            continue
        next_out = f"{out} {part}".strip()
        if len(next_out) > limit:
            return (out or compact)[:limit].rstrip() + ("…" if len(compact) > limit else "")
        out = next_out
        if len(out) > 140:
            return out
    return out[:limit]


def _stage_id(page):
    loc = _loc(page)
    for sid, pattern, name in STAGE_RULES:
        if pattern.search(loc):
            return sid, name
    title = (page.get("page_title") or "Curriculum").split(" | ")[0].split(" - ")[0].strip()
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40] or "stage", title[:60]


def _unique(items):
    out = []
    for item in items:
        if item and item not in out:
            out.append(item)
    return out


def build_school(school_id: str, school_name: str):
    pages = [
        page
        for page in _latest_crawl(school_id)
        if page.get("crawl_status") == "success" and (page.get("extracted_text") or "").strip()
    ]
    if not pages:
        return None

    stages_by_id = {}
    cca_items = []
    fac_items = []
    source_cca = None
    source_fac = None
    source_curr = None

    for page in pages:
        url = page.get("url") or ""
        text = page.get("extracted_text") or ""
        kind = _kind(page)
        bullets = [item for item in _bullets(text) if _subject_like(item)]
        if kind == "skip":
            continue
        if kind == "curriculum":
            sid, name = _stage_id(page)
            stage = stages_by_id.setdefault(
                sid,
                {
                    "id": sid,
                    "name": name,
                    "summary": _summary(text),
                    "source_url": url,
                    "source_label": "Official website",
                    "subjects": [],
                    "notes": [],
                },
            )
            stage["subjects"] = _unique(stage["subjects"] + _vocab(text, SUBJECTS) + [item for item in bullets[:10] if item in SUBJECTS or len(item.split()) <= 4])
            if not source_curr or "/learning/" in url or "curriculum" in url or "academic" in url:
                source_curr = url
                stage["source_url"] = url
        if kind == "cca":
            found = _vocab(text, CCA_TERMS) + bullets
            if found:
                cca_items.extend(found)
                source_cca = source_cca or url
        if kind in ("facilities", "about"):
            found = _vocab(text, FACILITY_TERMS)
            if found:
                fac_items.extend(found)
                source_fac = source_fac or url

    curriculum_pages = [page for page in pages if _kind(page) == "curriculum"]
    framework = _framework(curriculum_pages or pages)
    stages = []
    for stage in stages_by_id.values():
        if not stage["subjects"]:
            stage.pop("subjects")
        if not stage["notes"]:
            stage.pop("notes")
        if stage.get("summary") or stage.get("subjects"):
            stages.append(stage)

    out = {"framework": framework, "school_name": school_name, "generated_at": datetime.now(timezone.utc).isoformat()}
    if stages:
        out["curriculum"] = {
            "framework": framework,
            "confidence": "likely",
            "stages": stages[:6],
        }
    cca_items = _unique(cca_items)
    if cca_items:
        out["cca"] = {
            "source_url": source_cca or pages[0]["url"],
            "source_label": "Official website",
            "confidence": "likely",
            "summary": "Listed on the official website. The page may not say which campus offers each activity.",
            "groups": [{"id": "programmes", "name": "Activities", "items": cca_items[:18]}],
        }
    fac_items = _unique(fac_items)
    if fac_items:
        pretty = [item[0].upper() + item[1:] if item else item for item in fac_items]
        out["facilities"] = {
            "source_url": source_fac or pages[0]["url"],
            "source_label": "Official website",
            "confidence": "likely",
            "summary": "Listed on the official website. The page may not say which campus has each room.",
            "groups": [{"id": "campus", "name": "Campus", "items": pretty[:16]}],
        }
    return out


def main():
    register = _load(REGISTER)
    school_rows = register.get("schools", [])
    schools = {row["id"]: row for row in school_rows}
    curr = _load(CURR)
    cca = _load(CCA)
    fac = _load(FAC)
    updated = []

    for school_id, school in schools.items():
        built = build_school(school_id, school["name"])
        if not built:
            continue
        if school_id not in KEEP:
            if built.get("curriculum"):
                curr[school_id] = built["curriculum"]
            else:
                curr.pop(school_id, None)
            if built.get("cca"):
                cca[school_id] = built["cca"]
            else:
                cca.pop(school_id, None)
            if built.get("facilities"):
                fac[school_id] = built["facilities"]
            else:
                fac.pop(school_id, None)
            if built.get("framework"):
                school["curriculum_type"] = built["framework"]
        updated.append(
            {
                "id": school_id,
                "name": school["name"],
                "curriculum": bool(built.get("curriculum")),
                "cca": bool(built.get("cca")),
                "facilities": bool(built.get("facilities")),
                "framework": built.get("framework"),
                "kept_hand_built": school_id in KEEP,
            }
        )

    register["schools"] = [schools[row["id"]] for row in school_rows]
    _save(CURR, curr)
    _save(CCA, cca)
    _save(FAC, fac)
    _save(REGISTER, register)
    report = RAW / "website-overlay-report.json"
    report.write_text(json.dumps(updated, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"updated {len(updated)} schools -> {report}", flush=True)
    for row in updated:
        print(
            f"{row['name']}: curriculum={row['curriculum']} cca={row['cca']} "
            f"facilities={row['facilities']} keep={row['kept_hand_built']}",
            flush=True,
        )


if __name__ == "__main__":
    main()
