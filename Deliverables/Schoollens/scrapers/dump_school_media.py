"""Write official website/Facebook media URLs for a school into web/public/school-media."""

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "rag-service"))


def _load_env():
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


def main():
    _load_env()
    from main import SchoolIdRequest, media, summarize

    school_id = sys.argv[1] if len(sys.argv) > 1 else "f6c7b97d-8959-4d0c-841f-8148d10dcd4d"
    media_payload = media(SchoolIdRequest(school_id=school_id))
    media_out = ROOT / "web" / "public" / "school-media" / f"{school_id}.json"
    media_out.parent.mkdir(parents=True, exist_ok=True)
    media_out.write_text(json.dumps(media_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {media_out} items={len(media_payload.get('items') or [])}")
    summary_payload = summarize(SchoolIdRequest(school_id=school_id))
    summary_out = ROOT / "web" / "public" / "school-summaries" / f"{school_id}.json"
    summary_out.parent.mkdir(parents=True, exist_ok=True)
    summary_out.write_text(json.dumps(summary_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"wrote {summary_out} stats={len(summary_payload.get('key_stats') or [])} "
        f"verify={len(summary_payload.get('things_to_verify') or [])}"
    )


if __name__ == "__main__":
    main()
