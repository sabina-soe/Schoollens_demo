"""Run one website crawl for the operator desk without live Supabase."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JOBS_PATH = ROOT / "raw-crawls" / "operator-jobs.json"
sys.path.insert(0, str(Path(__file__).resolve().parent))

from crawl_website import _run_one, load_local_schools  # noqa: E402


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_jobs() -> list[dict]:
    if not JOBS_PATH.exists():
        return []
    try:
        payload = json.loads(JOBS_PATH.read_text(encoding="utf-8"))
        return payload if isinstance(payload, list) else []
    except json.JSONDecodeError:
        return []


def _update(job_id: str, **changes) -> None:
    JOBS_PATH.parent.mkdir(parents=True, exist_ok=True)
    jobs = _load_jobs()
    found = False
    for row in jobs:
        if row.get("id") == job_id:
            row.update(changes)
            found = True
            break
    if not found:
        jobs.insert(0, {"id": job_id, **changes})
    JOBS_PATH.write_text(json.dumps(jobs[:80], ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: operator_local_crawl.py <job_id> <school_id>", file=sys.stderr)
        return 2
    job_id, school_id = sys.argv[1], sys.argv[2]
    schools = [row for row in load_local_schools() if row.get("id") == school_id]
    if not schools:
        _update(
            job_id,
            status="error",
            finished_at=_now(),
            errors={"school_id": school_id, "reason": "School is not in the local register with a website."},
        )
        return 1
    school = schools[0]
    _update(job_id, status="running", errors={"school_id": school_id, "reason": "local website crawl running"})
    try:
        result = _run_one(school["id"], school["official_website_url"])
        _update(
            job_id,
            status="success",
            finished_at=_now(),
            rows_ingested=result.get("success_with_text") or 0,
            errors={
                "school_id": school_id,
                "pages": result.get("pages"),
                "reason": "local website crawl finished",
                "path": result.get("path"),
            },
        )
        return 0
    except Exception as exc:
        _update(
            job_id,
            status="error",
            finished_at=_now(),
            errors={"school_id": school_id, "reason": str(exc)},
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
