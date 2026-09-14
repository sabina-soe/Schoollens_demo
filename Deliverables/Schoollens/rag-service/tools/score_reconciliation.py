"""Score AI reconciliation labels against human labels (Section 9.2)."""

import csv
import sys
from collections import Counter
from pathlib import Path

LABELS = ("supported", "likely", "conflicting", "outdated", "unknown")


def _norm(value):
    return str(value or "").strip().lower()


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("eval_claim_groups.csv")
    if not path.is_file():
        sys.exit(f"CSV not found: {path}")

    compared = 0
    matches = 0
    skipped = 0
    confusion = Counter()

    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if "ai_confidence_label" not in (reader.fieldnames or []) or "human_label" not in (
            reader.fieldnames or []
        ):
            sys.exit("CSV must include ai_confidence_label and human_label")

        for row in reader:
            ai = _norm(row.get("ai_confidence_label"))
            human = _norm(row.get("human_label"))
            if not human:
                skipped += 1
                continue
            compared += 1
            if ai == human:
                matches += 1
            confusion[(ai or "(blank)", human)] += 1

    if compared == 0:
        sys.exit("no rows with human_label filled in")

    rate = matches / compared
    print(f"rows compared: {compared}")
    print(f"rows skipped (blank human_label): {skipped}")
    print(f"overall match rate: {matches}/{compared} ({rate:.1%})")
    print()
    print("confusion (ai_label -> human_label):")

    seen = set()
    for ai in LABELS + ("(blank)",):
        for human in LABELS:
            count = confusion.get((ai, human), 0)
            if count == 0:
                continue
            seen.add((ai, human))
            tag = "match" if ai == human else "confused"
            print(f"  {ai} -> {human}: {count} ({tag})")

    for pair, count in sorted(confusion.items()):
        if pair not in seen:
            print(f"  {pair[0]} -> {pair[1]}: {count} (confused)")


if __name__ == "__main__":
    main()
