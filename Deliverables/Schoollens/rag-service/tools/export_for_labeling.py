"""Export claim_groups for the Section 9.2 evaluation dataset (human labels)."""

import csv
import os
import sys
from pathlib import Path

from supabase import create_client

SAMPLE_SCHOOL_NAMES = (
    "The International School Yangon",
    "ILBC",
    "City School Yangon",
    "Eden School Pyin Oo Lwin",
    "Future Kidz International School",
    "Wells International School",
)

COLUMNS = (
    "claim_group_id",
    "school_id",
    "category",
    "member_claims",
    "ai_confidence_label",
    "ai_reconciliation_note",
    "human_label",
)


def _client():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return create_client(url, key)


def _sample_school_ids(db):
    raw = os.environ.get("DEV_SAMPLE_SCHOOL_IDS", "").strip()
    if raw:
        return [item.strip() for item in raw.split(",") if item.strip()]

    ids = []
    for name in SAMPLE_SCHOOL_NAMES:
        rows = db.table("schools").select("id").ilike("name", f"%{name}%").execute().data or []
        ids.extend(row["id"] for row in rows)
    return list(dict.fromkeys(ids))


def _in_batches(db, table, columns, key, values):
    rows = []
    for start in range(0, len(values), 100):
        chunk = values[start : start + 100]
        rows.extend(
            db.table(table).select(columns).in_(key, chunk).execute().data or []
        )
    return rows


def main():
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("eval_claim_groups.csv")
    db = _client()
    school_ids = _sample_school_ids(db)
    if not school_ids:
        sys.exit("no dev sample schools found (set DEV_SAMPLE_SCHOOL_IDS or load the Section 7.1 sample)")

    groups = _in_batches(
        db,
        "claim_groups",
        "id, school_id, category, confidence_label, reconciliation_note",
        "school_id",
        school_ids,
    )
    if not groups:
        sys.exit("no claim_groups for the dev sample schools")

    group_ids = [group["id"] for group in groups]
    members = _in_batches(
        db,
        "claim_group_members",
        "claim_group_id, claim_id",
        "claim_group_id",
        group_ids,
    )
    claim_ids = list(dict.fromkeys(member["claim_id"] for member in members))
    claims = {
        row["id"]: row
        for row in _in_batches(db, "claims", "id, claim_text, category", "id", claim_ids)
    }

    members_by_group = {}
    for member in members:
        members_by_group.setdefault(member["claim_group_id"], []).append(member["claim_id"])

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        for group in groups:
            parts = []
            for claim_id in members_by_group.get(group["id"], []):
                claim = claims.get(claim_id)
                if not claim:
                    continue
                parts.append(f"{claim.get('claim_text') or ''} [{claim.get('category') or ''}]")
            writer.writerow(
                {
                    "claim_group_id": group["id"],
                    "school_id": group["school_id"],
                    "category": group["category"],
                    "member_claims": " | ".join(parts),
                    "ai_confidence_label": group.get("confidence_label") or "",
                    "ai_reconciliation_note": group.get("reconciliation_note") or "",
                    "human_label": "",
                }
            )

    print(f"wrote {len(groups)} rows to {out_path}")


if __name__ == "__main__":
    main()
