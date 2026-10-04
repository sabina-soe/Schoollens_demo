"""Snapshot live claim groups into static JSON for Vercel."""

from __future__ import annotations

import json
import os
from pathlib import Path

from supabase import create_client

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "web" / "public" / "school-claims"
DEMO_SCHOOLS = [
    ("ISY", "b0595924-73f7-49c4-94b0-b05017d77ef8"),
    ("ILBC", "f6c7b97d-8959-4d0c-841f-8148d10dcd4d"),
    ("PISM", "d1e8deee-ed2c-43fb-a382-c3adb5d06861"),
    ("Kings", "ba3c6f02-961b-42e1-8ef9-21d872abbda7"),
    ("Helix", "5d88ea9c-c422-4696-88f3-5f2afb315530"),
]


def load_env():
    for path, overwrite in (
        (ROOT / "web" / ".env.local", False),
        (ROOT / "rag-service" / ".env", True),
    ):
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            raw = raw.strip()
            if not raw or raw.startswith("#") or "=" not in raw:
                continue
            key, value = raw.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if overwrite or key not in os.environ:
                os.environ[key] = value
    if not os.environ.get("SUPABASE_URL"):
        os.environ["SUPABASE_URL"] = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")


def db():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def rows(query):
    response = query.execute()
    return response.data or []


def export_school(client, school_id: str):
    groups = rows(
        client.table("claim_groups")
        .select("id, school_id, category, confidence_label, reconciliation_note, last_updated")
        .eq("school_id", school_id)
        .order("category")
    )
    if not groups:
        return {"school_id": school_id, "groups": []}

    group_ids = [group["id"] for group in groups]
    members = rows(
        client.table("claim_group_members").select("claim_group_id, claim_id").in_("claim_group_id", group_ids)
    )
    claim_ids = sorted({member["claim_id"] for member in members})
    claims = (
        rows(
            client.table("claims")
            .select("id, claim_text, category, source_type, source_trust_tier, created_at")
            .in_("id", claim_ids)
        )
        if claim_ids
        else []
    )
    evidence = (
        rows(
            client.table("evidence")
            .select("claim_id, source_excerpt, evidence_type, uploaded_at, original_url")
            .in_("claim_id", claim_ids)
        )
        if claim_ids
        else []
    )
    claim_by_id = {claim["id"]: claim for claim in claims}
    evidence_by_claim: dict[str, list] = {}
    for item in evidence:
        evidence_by_claim.setdefault(item["claim_id"], []).append(item)
    members_by_group: dict[str, list[str]] = {}
    for member in members:
        members_by_group.setdefault(member["claim_group_id"], []).append(member["claim_id"])

    packed = []
    for group in groups:
        packed_claims = []
        packed_evidence = []
        seen_text = set()
        for claim_id in members_by_group.get(group["id"], []):
            claim = claim_by_id.get(claim_id)
            if claim and claim.get("claim_text") and claim["claim_text"] not in seen_text:
                seen_text.add(claim["claim_text"])
                packed_claims.append(claim)
            packed_evidence.extend(evidence_by_claim.get(claim_id, []))
        packed.append({**group, "claims": packed_claims, "evidence": packed_evidence})
    return {"school_id": school_id, "groups": packed}


def main():
    load_env()
    if not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        raise SystemExit("Supabase env missing")
    client = db()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    index = {"bySchool": {}, "aliases": {}, "counts": {}}
    for name, school_id in DEMO_SCHOOLS:
        payload = export_school(client, school_id)
        path = OUT_DIR / f"{school_id}.json"
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        count = len(payload["groups"])
        index["bySchool"][school_id] = f"/school-claims/{school_id}.json"
        index["counts"][name] = count
        school_row = rows(client.table("schools").select("id, school_group_id").eq("id", school_id).limit(1))
        group_id = (school_row[0] or {}).get("school_group_id") if school_row else None
        if group_id:
            siblings = rows(client.table("schools").select("id").eq("school_group_id", group_id))
            for sibling in siblings:
                index["aliases"][sibling["id"]] = school_id
        print(f"{name} {count} groups -> {path.name}", flush=True)
    (OUT_DIR / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")
    print("index", index["counts"], flush=True)


if __name__ == "__main__":
    main()
