"""Create the public evidence-pdfs Supabase Storage bucket (Section 7.1)."""

import os
from pathlib import Path

from supabase import create_client

ROOT = Path(__file__).resolve().parents[1]
BUCKET = "evidence-pdfs"


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
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    db = create_client(url, key)
    existing = set()
    for item in db.storage.list_buckets() or []:
        name = getattr(item, "name", None) or getattr(item, "id", None)
        if name is None and isinstance(item, dict):
            name = item.get("name") or item.get("id")
        if name:
            existing.add(name)
    if BUCKET in existing:
        print(f"bucket {BUCKET} already exists")
        return
    db.storage.create_bucket(
        BUCKET,
        options={
            "public": True,
            "file_size_limit": 20_971_520,
            "allowed_mime_types": ["application/pdf"],
        },
    )
    print(f"created public bucket {BUCKET}")


if __name__ == "__main__":
    main()
