"""Extract success raw_sources for one school_id, then reconcile."""

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
    school_id = sys.argv[1]
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    school = db.table("schools").select("id, name").eq("id", school_id).limit(1).execute().data
    if not school:
        sys.exit(f"school not found: {school_id}")
    print(f"school {school[0]['name']} {school_id}", flush=True)
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
        if row["id"] in done:
            print(f"[{index}/{len(rows)}] skip", flush=True)
            continue
        try:
            result = extract(ExtractRequest(raw_source_id=row["id"]))
            count = len(result.get("claim_ids") or [])
            claims += count
            ok += 1
            print(f"[{index}/{len(rows)}] extract claims={count}", flush=True)
        except Exception as exc:
            fail += 1
            print(f"[{index}/{len(rows)}] FAIL {type(exc).__name__}: {exc}", flush=True)
    print(f"extract_ok {ok} extract_fail {fail} new_claims {claims}", flush=True)
    print(f"reconcile {reconcile(ReconcileRequest(school_id=school_id))}", flush=True)


if __name__ == "__main__":
    main()
