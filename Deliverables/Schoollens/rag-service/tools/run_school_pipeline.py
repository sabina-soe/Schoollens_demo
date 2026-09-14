"""Extract all success raw_sources for a school, then reconcile."""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "rag-service"))

for env_path in (ROOT / "web" / ".env.local", ROOT / "rag-service" / ".env", ROOT / "rag-service" / ".env.example"):
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

from supabase import create_client

from main import ExtractRequest, ReconcileRequest, extract, reconcile


def main():
    query = sys.argv[1] if len(sys.argv) > 1 else "ILBC"
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    matches = db.table("schools").select("id, name").ilike("name", f"%{query}%").execute().data or []
    if not matches:
        sys.exit(f"no school matching {query}")
    scored = []
    for row in matches:
        sources = (
            db.table("raw_sources")
            .select("id", count="exact")
            .eq("school_id", row["id"])
            .execute()
        )
        scored.append((sources.count or 0, row))
    scored.sort(key=lambda item: item[0], reverse=True)
    school = scored[0][1]
    school_id = school["id"]
    print(f"school {school['name']} {school_id} raw_sources={scored[0][0]}", flush=True)

    rows = (
        db.table("raw_sources")
        .select("id")
        .eq("school_id", school_id)
        .eq("crawl_status", "success")
        .execute()
        .data
        or []
    )
    done = set()
    if rows:
        evidence = (
            db.table("evidence")
            .select("raw_source_id")
            .in_("raw_source_id", [row["id"] for row in rows])
            .execute()
            .data
            or []
        )
        done = {row["raw_source_id"] for row in evidence}
    print(f"raw_sources {len(rows)} already_extracted {len(done)}", flush=True)

    ok = 0
    fail = 0
    claims = 0
    for index, row in enumerate(rows, 1):
        raw_source_id = row["id"]
        if raw_source_id in done:
            print(f"[{index}/{len(rows)}] skip extracted", flush=True)
            continue
        try:
            result = extract(ExtractRequest(raw_source_id=raw_source_id))
            count = len(result.get("claim_ids") or [])
            claims += count
            ok += 1
            print(f"[{index}/{len(rows)}] extract claims={count}", flush=True)
        except Exception as exc:
            fail += 1
            print(f"[{index}/{len(rows)}] FAIL {type(exc).__name__}: {exc}", flush=True)

    print(f"extract_ok {ok} extract_fail {fail} new_claims {claims}", flush=True)
    rec = reconcile(ReconcileRequest(school_id=school_id))
    print(f"reconcile {rec}", flush=True)


if __name__ == "__main__":
    main()
