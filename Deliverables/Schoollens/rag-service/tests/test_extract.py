"""
Manual test script for POST /rag/extract.

Picks a few real raw_sources rows (one English website row, one Burmese
Facebook row if available, one non-success row), calls the running
/rag/extract endpoint against each, and prints the resulting claims +
evidence so you can eyeball them against the checklist:
  1. claim_text is English for both English and Burmese sources
  2. evidence.source_excerpt for the Burmese row is still genuinely Burmese
  3. category lands sensibly in the taxonomy
  4. scope and source_trust_tier are populated, not null
  5. a non-success crawl_status row returns 400

Run the FastAPI app first (uvicorn main:app --app-dir rag-service),
then run this from the repo root:

  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python rag-service/tests/test_extract.py

No new dependencies added — uses `requests` and `supabase`, which
rag-service already depends on.
"""

import os
import sys

import requests
from supabase import create_client

EXTRACT_URL = os.environ.get("RAG_SERVICE_URL", "http://localhost:8000/rag/extract")
SUPABASE_URL = os.environ["https://vhvrlrfoapwkgochxinl.supabase.co"]
SUPABASE_KEY = os.environ["sb_secret_66ejO-HuTfP1oHVXL2pfYw_jFSlySXc"]

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def pick_sample_rows():
    """Find one English website row, one Facebook row, one non-success row."""
    samples = {}

    website_row = (
        supabase.table("raw_sources")
        .select("id, school_id, source_type, crawl_status")
        .eq("source_type", "website")
        .eq("crawl_status", "success")
        .limit(1)
        .execute()
    )
    if website_row.data:
        samples["website (expect English source)"] = website_row.data[0]

    fb_row = (
        supabase.table("raw_sources")
        .select("id, school_id, source_type, crawl_status")
        .eq("source_type", "fb_page")
        .eq("crawl_status", "success")
        .limit(1)
        .execute()
    )
    if fb_row.data:
        samples["fb_page (may contain Burmese)"] = fb_row.data[0]

    failed_row = (
        supabase.table("raw_sources")
        .select("id, school_id, source_type, crawl_status")
        .neq("crawl_status", "success")
        .limit(1)
        .execute()
    )
    if failed_row.data:
        samples["non-success (expect 400)"] = failed_row.data[0]

    return samples


def call_extract(raw_source_id: str):
    resp = requests.post(EXTRACT_URL, json={"raw_source_id": raw_source_id})
    return resp


def print_results(raw_source_id: str):
    claims = (
        supabase.table("claims")
        .select("id, claim_text, category, language, scope, source_trust_tier")
        .execute()
    )
    # Filter client-side since claims doesn't carry raw_source_id directly (Section 10) —
    # join through evidence instead, which is the actual link.
    evidence = (
        supabase.table("evidence")
        .select("id, claim_id, raw_source_id, evidence_type, source_excerpt")
        .eq("raw_source_id", raw_source_id)
        .execute()
    )
    claim_ids = {e["claim_id"] for e in evidence.data}
    relevant_claims = [c for c in claims.data if c["id"] in claim_ids]

    if not relevant_claims:
        print("  (no claims found for this raw_source_id)")
        return

    for c in relevant_claims:
        matching_evidence = [e for e in evidence.data if e["claim_id"] == c["id"]]
        print(f"  [{c['category']}] {c['claim_text']}")
        print(f"    scope={c['scope']}  trust_tier={c['source_trust_tier']}  language={c['language']}")
        for e in matching_evidence:
            excerpt = (e.get("source_excerpt") or "")[:120]
            print(f"    evidence ({e['evidence_type']}): {excerpt}")
        print()


def main():
    samples = pick_sample_rows()
    if not samples:
        print("No raw_sources rows found — load some data first (Section 7.2 loader script).")
        sys.exit(1)

    for label, row in samples.items():
        print("=" * 70)
        print(f"Testing: {label}")
        print(f"raw_source_id={row['id']}  school_id={row['school_id']}  crawl_status={row['crawl_status']}")
        print("-" * 70)

        resp = call_extract(row["id"])
        print(f"HTTP {resp.status_code}")

        if row["crawl_status"] != "success":
            if resp.status_code == 400:
                print("  ✓ correctly rejected non-success row")
            else:
                print(f"  ✗ expected 400, got {resp.status_code} — check the endpoint's status handling")
            continue

        if resp.status_code != 200:
            print(f"  ✗ unexpected error: {resp.text}")
            continue

        print_results(row["id"])

    print("=" * 70)
    print("Manual checklist:")
    print("  [ ] claim_text is English for BOTH samples above")
    print("  [ ] the fb_page evidence excerpt is genuinely Burmese, not translated (if that row was Burmese)")
    print("  [ ] categories look sensible, not miscategorized")
    print("  [ ] scope and source_trust_tier are populated, not None")


if __name__ == "__main__":
    main()
