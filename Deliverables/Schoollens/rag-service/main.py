"""Section 9.1 extraction — POST /rag/extract. Direct Gemini SDK, no RAG framework."""

import json
import os
import re
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from google import genai
from google.genai import types
from pydantic import BaseModel
from supabase import create_client


def _load_local_env():
    root = Path(__file__).resolve().parents[1]
    for env_path in (
        root / "web" / ".env.local",
        Path(__file__).resolve().parent / ".env",
        Path(__file__).resolve().parent / ".env.example",
    ):
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


_load_local_env()
_WEBSITE_CRAWL_LOCK = threading.Lock()

CATEGORIES = (
    "fees",
    "curriculum",
    "safety",
    "facilities",
    "class size",
    "contact info",
)

TRUST_TIER = {
    "moe": "moe",
    "website": "official_website",
    "fb_page": "official_facebook",
    "fb_group": "community",
}

EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {
        "claims": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "claim_text": {"type": "string"},
                    "category": {"type": "string", "enum": list(CATEGORIES)},
                    "language": {"type": "string"},
                    "scope": {"type": "string", "enum": ["network", "branch"]},
                    "source_excerpt": {"type": "string"},
                },
                "required": [
                    "claim_text",
                    "category",
                    "language",
                    "scope",
                    "source_excerpt",
                ],
            },
        }
    },
    "required": ["claims"],
}

EXTRACT_PROMPT = """You extract discrete, structured factual claims from one school source.

Rules:
- Pull only concrete facts (e.g. "class size: 15 students"). Skip slogans, mood, and vague praise.
- Tag each claim with exactly one category: fees, curriculum, safety, facilities, class size, contact info.
- claim_text must be normalized into English, even if the source is Burmese or mixed. This is the comparable fact.
- source_excerpt must be a short verbatim span copied from the source, in the original language. Never translate it. Burmese stays Burmese.
- language is the detected language of the source excerpt (e.g. en, my), not of claim_text.
- scope is "network" unless the fact is clearly about one campus/branch, in which case use "branch". Website content defaults to network.
- If the source has no usable factual claims, return {{"claims": []}}.

Source type: {source_type}
Source:
{source}
"""

CONFIDENCE_LABELS = ("supported", "likely", "conflicting", "outdated", "unknown")

RECONCILE_PROMPT = """You reconcile a group of claims that likely describe the same underlying school fact.

Output JSON only:
{"confidence_label":"supported|likely|conflicting|outdated|unknown","reconciliation_note":"..."}

Labels:
- supported: independent sources agree on the same fact.
- likely: the fact is supported but not independently corroborated.
- conflicting: sources disagree. The note must state what differs and why, without saying which source is correct.
- outdated: newer evidence supersedes older evidence.
- unknown: evidence is insufficient.

Rules:
- confidence_label estimates how well-supported the fact is. Never assert that it is objectively true or false.
- Do not recommend or rank the school.
- Keep reconciliation_note plain language, short, and specific to this group.
"""

NO_EVIDENCE_ANSWER = "There is no verified evidence on this."
QA_DISTANCE_MAX = 0.35

QA_PROMPT = """You answer a parent's question about one school using ONLY the retrieved evidence below.

Output JSON only:
{"answer":"...","cited_claim_group_ids":["..."]}

Rules:
- Use only the retrieved claims. Do not add outside knowledge or a plausible guess.
- Each sentence in answer must be tied to a citation by including that sentence's claim_group_id in cited_claim_group_ids.
- cited_claim_group_ids must be claim_group_id values from the evidence, never invented.
- If the evidence is missing, thin, conflicting without a usable fact, or does not address the question, set answer to exactly: There is no verified evidence on this.
- Do not recommend or rank the school. Do not assert objective truth beyond what the evidence supports.
"""

app = FastAPI()


class ExtractRequest(BaseModel):
    raw_source_id: str


class ReconcileRequest(BaseModel):
    school_id: str


class QaRequest(BaseModel):
    school_id: str
    question: str


class MatchMentionsRequest(BaseModel):
    raw_source_id: str


class QueueRecrawlRequest(BaseModel):
    school_id: str
    source_type: str


def _supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return create_client(url, key)


_GEMINI_CLIENT = None


def _gemini():
    global _GEMINI_CLIENT
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY must be set")
    if _GEMINI_CLIENT is None:
        _GEMINI_CLIENT = genai.Client(api_key=api_key)
    return _GEMINI_CLIENT


def _source_text(raw_json):
    if not isinstance(raw_json, dict):
        return "" if raw_json is None else str(raw_json)
    extracted = raw_json.get("extracted_text")
    if isinstance(extracted, str) and extracted.strip():
        return extracted
    return json.dumps(raw_json, ensure_ascii=False)


def _extract_claims(source_type, source_text):
    response = _gemini().models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=EXTRACT_PROMPT.format(source_type=source_type, source=source_text),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=EXTRACT_SCHEMA,
        ),
    )
    payload = json.loads(response.text)
    claims = payload.get("claims") or []
    kept = []
    for claim in claims:
        if claim.get("category") not in CATEGORIES:
            continue
        if claim.get("scope") not in ("network", "branch"):
            continue
        if not claim.get("claim_text") or not claim.get("source_excerpt"):
            continue
        kept.append(claim)
    return kept


def _embed_claim_text(claim_text):
    result = _gemini().models.embed_content(
        model="gemini-embedding-001",
        contents=claim_text,
        config=types.EmbedContentConfig(output_dimensionality=768),
    )
    return result.embeddings[0].values


RECONCILE_SCHEMA = {
    "type": "object",
    "properties": {
        "confidence_label": {"type": "string", "enum": list(CONFIDENCE_LABELS)},
        "reconciliation_note": {"type": "string"},
    },
    "required": ["confidence_label", "reconciliation_note"],
}

QA_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "cited_claim_group_ids": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["answer", "cited_claim_group_ids"],
}

GEMINI_REASON_MODEL = "gemini-3.5-flash-lite"


def _gemini_json(prompt, user_text, schema):
    last_error = None
    for attempt in range(3):
        try:
            response = _gemini().models.generate_content(
                model=GEMINI_REASON_MODEL,
                contents=f"{prompt}\n\n{user_text}",
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                ),
            )
            text = (response.text or "").strip()
            if not text:
                raise ValueError("Gemini returned empty JSON")
            return json.loads(text)
        except Exception as exc:
            last_error = exc
            time.sleep(1.5 * (attempt + 1))
    raise last_error


def _reconcile_group(category, member_claims):
    lines = []
    for claim in member_claims:
        lines.append(
            f"- claim_text: {claim.get('claim_text')}; "
            f"source_type: {claim.get('source_type')}; "
            f"source_trust_tier: {claim.get('source_trust_tier')}; "
            f"created_at: {claim.get('created_at')}; "
            f"language: {claim.get('language')}; "
            f"scope: {claim.get('scope')}"
        )
    try:
        payload = _gemini_json(
            RECONCILE_PROMPT,
            f"Category: {category}\n\nClaims:\n" + "\n".join(lines),
            RECONCILE_SCHEMA,
        )
    except Exception:
        if len(member_claims) >= 2:
            return (
                "likely",
                "More than one extracted claim mentions this. Gemini reconciliation did not return a label.",
            )
        return (
            "unknown",
            "Only one extracted claim mentions this. Gemini reconciliation did not return a label.",
        )
    label = str(payload.get("confidence_label") or "").strip().lower()
    note = payload.get("reconciliation_note")
    if label not in CONFIDENCE_LABELS:
        return None, None
    return label, note


@app.post("/rag/extract")
def extract(body: ExtractRequest):
    db = _supabase()
    fetched = (
        db.table("raw_sources")
        .select("id, school_id, source_type, crawl_status, raw_json")
        .eq("id", body.raw_source_id)
        .limit(1)
        .execute()
    )
    if not fetched.data:
        raise HTTPException(status_code=404, detail="raw_sources row not found")

    row = fetched.data[0]
    if row.get("crawl_status") != "success":
        raise HTTPException(status_code=400, detail="raw_sources row is not crawl_status=success")
    if not row.get("school_id"):
        raise HTTPException(status_code=400, detail="raw_sources row has no school_id")

    source_text = _source_text(row.get("raw_json"))
    if not source_text.strip():
        raise HTTPException(status_code=400, detail="raw_sources row has no extractable text")

    extracted = _extract_claims(row.get("source_type"), source_text)
    now = datetime.now(timezone.utc).isoformat()
    raw_json = row.get("raw_json") if isinstance(row.get("raw_json"), dict) else {}
    inserted = []

    for claim in extracted:
        saved = (
            db.table("claims")
            .insert(
                {
                    "school_id": row["school_id"],
                    "claim_text": claim["claim_text"],
                    "category": claim["category"],
                    "language": claim.get("language"),
                    "scope": claim["scope"],
                    "source_type": row.get("source_type"),
                    "source_trust_tier": TRUST_TIER.get(row.get("source_type")),
                    "created_at": now,
                }
            )
            .execute()
        )
        claim_row = saved.data[0]
        db.table("claims").update(
            {"embedding": _embed_claim_text(claim["claim_text"])}
        ).eq("id", claim_row["id"]).execute()
        db.table("evidence").insert(
            {
                "claim_id": claim_row["id"],
                "raw_source_id": row["id"],
                "file_url": raw_json.get("file_url"),
                "original_url": raw_json.get("url") or raw_json.get("original_url"),
                "evidence_type": "scraped_excerpt",
                "source_excerpt": claim["source_excerpt"],
                "uploaded_at": now,
            }
        ).execute()
        inserted.append(claim_row["id"])

    return {"claim_ids": inserted}


def _find(parent, node):
    while parent[node] != node:
        parent[node] = parent[parent[node]]
        node = parent[node]
    return node


def _cluster_claim_ids(claim_ids, pairs):
    parent = {claim_id: claim_id for claim_id in claim_ids}

    for pair in pairs:
        left = pair.get("claim_id_a")
        right = pair.get("claim_id_b")
        if left not in parent or right not in parent:
            continue
        root_left = _find(parent, left)
        root_right = _find(parent, right)
        if root_left != root_right:
            parent[root_right] = root_left

    clusters = {}
    for claim_id in claim_ids:
        clusters.setdefault(_find(parent, claim_id), []).append(claim_id)
    return list(clusters.values())


@app.post("/rag/reconcile")
def reconcile(body: ReconcileRequest):
    db = _supabase()
    claims = (
        db.table("claims")
        .select("id, category, claim_text, source_type, source_trust_tier, created_at, language, scope")
        .eq("school_id", body.school_id)
        .execute()
        .data
    )
    if not claims:
        raise HTTPException(status_code=404, detail="no claims for school_id")

    pairs = (
        db.rpc("claim_similarity_pairs", {"p_school_id": body.school_id})
        .execute()
        .data
        or []
    )

    claims_by_id = {claim["id"]: claim for claim in claims}
    by_category = {}
    for claim in claims:
        by_category.setdefault(claim["category"], []).append(claim["id"])

    prior = _claim_group_snapshot(db, body.school_id)
    existing = (
        db.table("claim_groups")
        .select("id")
        .eq("school_id", body.school_id)
        .execute()
        .data
        or []
    )
    existing_ids = [group["id"] for group in existing]
    if existing_ids:
        db.table("claim_group_members").delete().in_("claim_group_id", existing_ids).execute()
        db.table("claim_groups").delete().eq("school_id", body.school_id).execute()

    now = datetime.now(timezone.utc).isoformat()
    created = []
    for category, claim_ids in by_category.items():
        category_pairs = [pair for pair in pairs if pair.get("category") == category]
        for members in _cluster_claim_ids(claim_ids, category_pairs):
            saved = (
                db.table("claim_groups")
                .insert(
                    {
                        "school_id": body.school_id,
                        "category": category,
                        "confidence_label": None,
                        "reconciliation_note": None,
                        "last_updated": now,
                    }
                )
                .execute()
            )
            group_id = saved.data[0]["id"]
            db.table("claim_group_members").insert(
                [{"claim_group_id": group_id, "claim_id": claim_id} for claim_id in members]
            ).execute()
            label, note = _reconcile_group(
                category,
                [claims_by_id[claim_id] for claim_id in members if claim_id in claims_by_id],
            )
            time.sleep(0.35)
            db.table("claim_groups").update(
                {
                    "confidence_label": label,
                    "reconciliation_note": note,
                    "last_updated": now,
                }
            ).eq("id", group_id).execute()
            created.append(group_id)

    _write_claim_changes(db, body.school_id, prior, _claim_group_snapshot(db, body.school_id), now)
    try:
        summarize(SchoolIdRequest(school_id=body.school_id))
    except Exception as exc:
        print(f"summarize failed for {body.school_id}: {exc}", flush=True)
    return {"claim_group_ids": created}


def _claim_group_snapshot(db, school_id):
    groups = (
        db.table("claim_groups")
        .select("id, category, confidence_label")
        .eq("school_id", school_id)
        .execute()
        .data
        or []
    )
    if not groups:
        return []
    members = (
        db.table("claim_group_members")
        .select("claim_group_id, claim_id")
        .in_("claim_group_id", [group["id"] for group in groups])
        .execute()
        .data
        or []
    )
    claims = (
        db.table("claims")
        .select("id, claim_text")
        .eq("school_id", school_id)
        .execute()
        .data
        or []
    )
    text_by_id = {claim["id"]: claim.get("claim_text") or "" for claim in claims}
    snapshot = []
    for group in groups:
        texts = tuple(
            sorted(
                text_by_id.get(member["claim_id"], "")
                for member in members
                if member["claim_group_id"] == group["id"]
            )
        )
        snapshot.append(
            {
                "id": group["id"],
                "category": group.get("category"),
                "label": group.get("confidence_label"),
                "texts": texts,
            }
        )
    return snapshot


def _write_claim_changes(db, school_id, prior, current, now):
    prior_keys = {(item["category"], item["texts"]) for item in prior}
    current_keys = {(item["category"], item["texts"]) for item in current}
    rows = []
    for item in current:
        key = (item["category"], item["texts"])
        summary = "; ".join(text for text in item["texts"] if text)[:400]
        if key not in prior_keys:
            change_type = "contradicted" if item.get("label") == "conflicting" else "new"
            rows.append(
                {
                    "school_id": school_id,
                    "claim_group_id": item["id"],
                    "change_type": change_type,
                    "summary_text": summary or f"New {item['category']} claim group",
                    "detected_at": now,
                }
            )
        else:
            old = next(prev for prev in prior if (prev["category"], prev["texts"]) == key)
            if old.get("label") != item.get("label"):
                rows.append(
                    {
                        "school_id": school_id,
                        "claim_group_id": item["id"],
                        "change_type": "updated",
                        "summary_text": f"{item['category']}: {old.get('label')} → {item.get('label')}. {summary}",
                        "detected_at": now,
                    }
                )
    for item in prior:
        key = (item["category"], item["texts"])
        if key not in current_keys:
            summary = "; ".join(text for text in item["texts"] if text)[:400]
            rows.append(
                {
                    "school_id": school_id,
                    "claim_group_id": None,
                    "change_type": "removed",
                    "summary_text": summary or f"Removed {item['category']} claim group",
                    "detected_at": now,
                }
            )
    if rows:
        db.table("claim_changes").insert(rows).execute()


def _vector_literal(values):
    return "[" + ",".join(str(float(value)) for value in values) + "]"


def _retrieve_claim_groups(db, school_id, question_embedding):
    rows = (
        db.rpc(
            "match_school_claims",
            {
                "p_school_id": school_id,
                "p_query": _vector_literal(question_embedding),
                "p_max_distance": QA_DISTANCE_MAX,
            },
        )
        .execute()
        .data
        or []
    )
    groups = {}
    for row in rows:
        group_id = row.get("claim_group_id")
        if not group_id:
            continue
        group = groups.setdefault(
            group_id,
            {
                "claim_group_id": group_id,
                "category": row.get("category"),
                "confidence_label": row.get("confidence_label"),
                "reconciliation_note": row.get("reconciliation_note"),
                "claims": [],
            },
        )
        group["claims"].append(row.get("claim_text"))
    return list(groups.values())


def _answer_question(question, retrieved):
    if not retrieved:
        return NO_EVIDENCE_ANSWER, []

    allowed = {group["claim_group_id"] for group in retrieved}
    blocks = []
    for group in retrieved:
        claims = " | ".join(text for text in group["claims"] if text)
        blocks.append(
            f"- claim_group_id: {group['claim_group_id']}; "
            f"category: {group.get('category')}; "
            f"confidence_label: {group.get('confidence_label')}; "
            f"reconciliation_note: {group.get('reconciliation_note')}; "
            f"claims: {claims}"
        )
    payload = _gemini_json(
        QA_PROMPT,
        f"Question: {question}\n\nEvidence:\n" + "\n".join(blocks),
        QA_SCHEMA,
    )
    answer = (payload.get("answer") or "").strip() or NO_EVIDENCE_ANSWER
    cited = []
    for group_id in payload.get("cited_claim_group_ids") or []:
        if group_id in allowed and group_id not in cited:
            cited.append(group_id)
    if answer == NO_EVIDENCE_ANSWER:
        cited = []
    return answer, cited


@app.post("/rag/qa")
def qa(body: QaRequest):
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="question is required")

    db = _supabase()
    retrieved = _retrieve_claim_groups(
        db, body.school_id, _embed_claim_text(body.question)
    )
    answer, cited = _answer_question(body.question, retrieved)
    now = datetime.now(timezone.utc).isoformat()
    db.table("qa_interactions").insert(
        {
            "school_id": body.school_id,
            "user_id": None,
            "question": body.question,
            "answer": answer,
            "cited_claim_group_ids": cited,
            "created_at": now,
        }
    ).execute()
    return {"answer": answer, "cited_claim_group_ids": cited}


@app.post("/rag/match-mentions")
def match_mentions(body: MatchMentionsRequest):
    db = _supabase()
    fetched = (
        db.table("raw_sources")
        .select("id, source_type, raw_json")
        .eq("id", body.raw_source_id)
        .limit(1)
        .execute()
    )
    if not fetched.data:
        raise HTTPException(status_code=404, detail="raw_sources row not found")
    row = fetched.data[0]
    if row.get("source_type") != "fb_group":
        raise HTTPException(status_code=400, detail="raw_sources row is not source_type=fb_group")
    text = _source_text(row.get("raw_json")).lower()
    if not text.strip():
        raise HTTPException(status_code=400, detail="raw_sources row has no extractable text")
    schools = db.table("schools").select("id, name").execute().data or []
    existing = (
        db.table("raw_source_school_mentions")
        .select("school_id")
        .eq("raw_source_id", row["id"])
        .execute()
        .data
        or []
    )
    already = {item["school_id"] for item in existing}
    written = []
    for school in schools:
        name = (school.get("name") or "").strip()
        if len(name) < 4 or school["id"] in already:
            continue
        needle = name.lower()
        first = needle.split()[0]
        if needle in text:
            confidence = "high"
        elif len(first) >= 4 and first in text:
            confidence = "low"
        else:
            continue
        db.table("raw_source_school_mentions").insert(
            {
                "raw_source_id": row["id"],
                "school_id": school["id"],
                "confidence": confidence,
            }
        ).execute()
        written.append({"school_id": school["id"], "confidence": confidence})
    return {"mentions": written}


class AnalyzeCommentsRequest(BaseModel):
    school_id: str


_POS = ("good", "great", "excellent", "love", "proud", "recommend", "caring", "safe")
_NEG = ("bad", "poor", "terrible", "hate", "unsafe", "expensive", "overcrowded", "cramped")
_CAT_HINTS = {
    "fees": ("fee", "tuition", "price", "cost"),
    "facilities": ("lab", "library", "playground", "campus", "building"),
    "safety": ("safe", "bully", "security", "guard"),
    "class size": ("class size", "overcrowded", "students per"),
    "curriculum": ("curriculum", "igcse", "cambridge", "ib "),
}


def _comment_texts(raw_json):
    if not isinstance(raw_json, dict):
        return []
    blobs = []
    for key in ("comments", "latestComments", "topComments"):
        items = raw_json.get(key)
        if isinstance(items, list):
            blobs.extend(items)
    comments = raw_json.get("comments")
    if isinstance(comments, dict):
        inner = comments.get("data") or comments.get("items") or []
        if isinstance(inner, list):
            blobs.extend(inner)
    texts = []
    for item in blobs:
        if isinstance(item, str) and item.strip():
            texts.append(item.strip())
        elif isinstance(item, dict):
            text = item.get("text") or item.get("comment") or item.get("message") or ""
            if isinstance(text, str) and text.strip():
                texts.append(text.strip())
    return texts


def _label_sentiment(text):
    lower = text.lower()
    pos = sum(1 for word in _POS if word in lower)
    neg = sum(1 for word in _NEG if word in lower)
    if pos > neg:
        return "positive", "0.6" if pos == 1 else "0.8"
    if neg > pos:
        return "negative", "0.6" if neg == 1 else "0.8"
    return "neutral", "0.4"


def _mentioned_category(text):
    lower = text.lower()
    for category, hints in _CAT_HINTS.items():
        if any(hint in lower for hint in hints):
            return category
    return None


@app.post("/rag/analyze-comments")
def analyze_comments(body: AnalyzeCommentsRequest):
    db = _supabase()
    sources = (
        db.table("raw_sources")
        .select("id, raw_json")
        .eq("school_id", body.school_id)
        .in_("source_type", ["fb_page", "fb_group"])
        .execute()
        .data
        or []
    )
    now = datetime.now(timezone.utc).isoformat()
    written = 0
    for source in sources:
        existing = (
            db.table("comment_analysis")
            .select("id")
            .eq("raw_source_id", source["id"])
            .limit(1)
            .execute()
            .data
        )
        if existing:
            continue
        rows = []
        for excerpt in _comment_texts(source.get("raw_json")):
            label, confidence = _label_sentiment(excerpt)
            rows.append(
                {
                    "raw_source_id": source["id"],
                    "comment_excerpt": excerpt[:500],
                    "sentiment_label": label,
                    "sentiment_confidence": confidence,
                    "mentioned_claim_category": _mentioned_category(excerpt),
                    "created_at": now,
                }
            )
        if rows:
            db.table("comment_analysis").insert(rows).execute()
            written += len(rows)
    return {"rows_written": written}


class SchoolIdRequest(BaseModel):
    school_id: str


SUMMARIZE_SCHEMA = {
    "type": "object",
    "properties": {
        "summary_text": {"type": "string"},
        "key_stats": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "value": {"type": "string"},
                },
                "required": ["label", "value"],
            },
        },
    },
    "required": ["summary_text", "key_stats"],
}

SUMMARIZE_PROMPT = """You write a parent-facing school overview from ONLY the Supported and Likely claim groups below.

Output JSON only:
{"summary_text":"...","key_stats":[{"label":"...","value":"..."}]}

Rules (Section 9.4 grounded generation):
- Use only the evidence below. Do not add outside knowledge or a plausible guess.
- summary_text is 2–4 short English sentences that combine well-supported facts.
- key_stats is 3–6 concrete highlights (for example curriculum, fees, class size, contact, facilities) drawn only from the evidence. Each item is a short label plus a short value, not a paragraph.
- Do not mention conflicting, unknown, outdated, or disputed facts. Those are stored separately and must not be softened, omitted into this paragraph, or folded in.
- Do not recommend or rank the school.
- Do not assert objective truth beyond what the evidence supports.
- If the evidence is missing or too thin to summarize, set summary_text to exactly: There is no verified evidence on this. and key_stats to [].
"""

NARRATIVE_LABELS = ("supported", "likely")
VERIFY_LABELS = ("conflicting", "unknown", "outdated")


def _youtube_id(url):
    if not url:
        return None
    match = re.search(r"(?:youtu\.be/|youtube\.com/(?:embed/|watch\?v=|shorts/))([A-Za-z0-9_-]{6,})", url)
    return match.group(1) if match else None


def _media_from_raw(source_type, raw):
    if not isinstance(raw, dict):
        return []
    items = []
    if source_type in ("fb_page", "fb_group"):
        for media in raw.get("media") or []:
            if not isinstance(media, dict):
                continue
            image = media.get("image") if isinstance(media.get("image"), dict) else {}
            url = image.get("uri") or media.get("thumbnail") or media.get("url") or media.get("src")
            kind = "video" if str(media.get("__typename") or media.get("type") or "").lower().find("video") >= 0 else "photo"
            if url:
                items.append(
                    {
                        "kind": kind,
                        "url": url,
                        "thumb": media.get("thumbnail") or url,
                        "source": "Official Facebook",
                    }
                )
        video = raw.get("video") if isinstance(raw.get("video"), dict) else {}
        if video.get("url") or raw.get("isVideo"):
            url = video.get("url") or raw.get("facebookUrl") or raw.get("url")
            if url:
                items.append(
                    {
                        "kind": "video",
                        "url": url,
                        "thumb": video.get("thumbnail") or raw.get("thumbnail"),
                        "source": "Official Facebook",
                    }
                )
    if source_type == "website":
        for embed in raw.get("embedded_links_found") or []:
            url = embed.get("url") if isinstance(embed, dict) else ""
            video_id = _youtube_id(url)
            if not video_id:
                continue
            items.append(
                {
                    "kind": "video",
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "thumb": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
                    "source": "Official Website",
                    "embed": f"https://www.youtube.com/embed/{video_id}",
                }
            )
    return items


def _dedupe_media(items, limit=24):
    seen = set()
    kept = []
    for item in items:
        key = item.get("url") or item.get("thumb")
        if not key or key in seen:
            continue
        seen.add(key)
        kept.append(item)
        if len(kept) >= limit:
            break
    return kept


def _group_claim_texts(db, group_ids):
    if not group_ids:
        return {}
    members = (
        db.table("claim_group_members")
        .select("claim_group_id, claim_id")
        .in_("claim_group_id", group_ids)
        .execute()
        .data
        or []
    )
    claim_ids = [row["claim_id"] for row in members if row.get("claim_id")]
    claims = (
        db.table("claims").select("id, claim_text").in_("id", claim_ids).execute().data or []
        if claim_ids
        else []
    )
    text_by_id = {row["id"]: (row.get("claim_text") or "").strip() for row in claims}
    out = {}
    for row in members:
        text = text_by_id.get(row.get("claim_id"))
        if text:
            out.setdefault(row["claim_group_id"], []).append(text)
    return out


def _things_to_verify(groups):
    items = []
    for group in groups:
        label = str(group.get("confidence_label") or "").strip().lower()
        if label not in VERIFY_LABELS:
            continue
        items.append(
            {
                "claim_group_id": group.get("id"),
                "category": group.get("category"),
                "confidence_label": label,
                "reconciliation_note": group.get("reconciliation_note"),
            }
        )
    return items


def _narrative_from_groups(groups, texts_by_group):
    blocks = []
    for group in groups:
        label = str(group.get("confidence_label") or "").strip().lower()
        if label not in NARRATIVE_LABELS:
            continue
        claims = texts_by_group.get(group["id"]) or []
        unique = []
        for text in claims:
            if text not in unique:
                unique.append(text)
        blocks.append(
            f"- claim_group_id: {group['id']}; "
            f"category: {group.get('category')}; "
            f"confidence_label: {label}; "
            f"reconciliation_note: {group.get('reconciliation_note') or ''}; "
            f"claims: {' | '.join(unique[:8])}"
        )
    if not blocks:
        return {"summary_text": NO_EVIDENCE_ANSWER, "key_stats": []}
    payload = _gemini_json(
        SUMMARIZE_PROMPT,
        "Supported and Likely evidence only:\n" + "\n".join(blocks),
        SUMMARIZE_SCHEMA,
    )
    summary = (payload.get("summary_text") or "").strip() or NO_EVIDENCE_ANSWER
    stats = []
    for item in payload.get("key_stats") or []:
        label = (item.get("label") or "").strip()
        value = (item.get("value") or "").strip()
        if label and value:
            stats.append({"label": label, "value": value})
    return {"summary_text": summary, "key_stats": stats[:6]}


@app.post("/rag/summarize")
def summarize(body: SchoolIdRequest):
    """Grounded school overview. Called after reconcile, not on profile load."""
    db = _supabase()
    groups = (
        db.table("claim_groups")
        .select("id, category, confidence_label, reconciliation_note")
        .eq("school_id", body.school_id)
        .execute()
        .data
        or []
    )
    narrative_ids = [
        group["id"]
        for group in groups
        if str(group.get("confidence_label") or "").strip().lower() in NARRATIVE_LABELS
    ]
    texts_by_group = _group_claim_texts(db, narrative_ids)
    try:
        narrative = _narrative_from_groups(groups, texts_by_group)
    except Exception:
        # Grounded fallback: first supported/likely notes only, never verify-list items.
        notes = []
        for group in groups:
            label = str(group.get("confidence_label") or "").strip().lower()
            if label not in NARRATIVE_LABELS:
                continue
            note = (group.get("reconciliation_note") or "").strip()
            claims = texts_by_group.get(group["id"]) or []
            piece = note or (claims[0] if claims else "")
            if piece and piece not in notes:
                notes.append(piece)
        narrative = {
            "summary_text": " ".join(notes[:4]) or NO_EVIDENCE_ANSWER,
            "key_stats": [],
        }
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "school_id": body.school_id,
        "summary_text": narrative["summary_text"],
        "key_stats": narrative["key_stats"],
        "things_to_verify": _things_to_verify(groups),
        "generated_at": now,
    }
    dump = Path(__file__).resolve().parents[1] / "web" / "public" / "school-summaries" / f"{body.school_id}.json"
    dump.parent.mkdir(parents=True, exist_ok=True)
    dump.write_text(json.dumps(row, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        db.table("school_summaries").upsert(row).execute()
    except Exception as exc:
        print(
            f"school_summaries upsert failed for {body.school_id}: {exc} "
            "(apply supabase/migrations/20260914100000_school_summaries.sql)",
            flush=True,
        )
    return row


@app.post("/rag/media")
def media(body: SchoolIdRequest):
    db = _supabase()
    school_ids = [body.school_id]
    school = (
        db.table("schools")
        .select("id, school_group_id")
        .eq("id", body.school_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    group_id = school[0].get("school_group_id") if school else None
    if group_id:
        siblings = (
            db.table("schools")
            .select("id")
            .eq("school_group_id", group_id)
            .execute()
            .data
            or []
        )
        school_ids = [row["id"] for row in siblings] or school_ids
    sources = (
        db.table("raw_sources")
        .select("source_type, raw_json")
        .in_("school_id", school_ids)
        .in_("source_type", ["website", "fb_page"])
        .eq("crawl_status", "success")
        .execute()
        .data
        or []
    )
    items = []
    for source in sources:
        items.extend(_media_from_raw(source.get("source_type"), source.get("raw_json")))
    return {"items": _dedupe_media(items)}


def _ingest_website_pages(db, school_id, pages):
    ingested = 0
    for page in pages:
        if not isinstance(page, dict):
            continue
        content_hash = page.get("content_hash")
        url = page.get("url")
        if not content_hash or not url:
            continue
        existing = (
            db.table("raw_sources")
            .select("id")
            .eq("school_id", school_id)
            .eq("content_hash", content_hash)
            .limit(1)
            .execute()
            .data
        )
        if existing:
            continue
        db.table("raw_sources").insert(
            {
                "school_id": school_id,
                "source_type": "website",
                "crawl_status": page.get("crawl_status") or "success",
                "raw_json": page,
                "content_hash": content_hash,
                "crawled_at": page.get("crawled_at"),
            }
        ).execute()
        ingested += 1
    return ingested


def _extract_new_sources(school_id: str):
    db = _supabase()
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
    extracted = 0
    claims = 0
    for row in rows:
        if row["id"] in done:
            continue
        try:
            result = extract(ExtractRequest(raw_source_id=row["id"]))
            extracted += 1
            claims += len(result.get("claim_ids") or [])
        except Exception:
            continue
    reconcile(ReconcileRequest(school_id=school_id))
    return extracted, claims


def _run_website_recrawl(school_id: str, job_id: str, url: str):
    root = Path(__file__).resolve().parents[1]
    scrapers = str(root / "scrapers")
    if scrapers not in sys.path:
        sys.path.insert(0, scrapers)
    db = _supabase()
    with _WEBSITE_CRAWL_LOCK:
        try:
            db.table("sync_jobs").update({"status": "running"}).eq("id", job_id).execute()
            import importlib

            import crawl_website

            importlib.reload(crawl_website)
            pages, hit_cap = crawl_website.crawl(url.rstrip("/") + "/", school_id)
            out_dir = root / "raw-crawls" / school_id
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"{datetime.now(timezone.utc).date().isoformat()}.json"
            out_path.write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding="utf-8")
            ingested = _ingest_website_pages(db, school_id, pages)
            with_text = sum(
                1 for page in pages if page.get("crawl_status") == "success" and page.get("extracted_text")
            )
            blocked = sum(1 for page in pages if page.get("crawl_status") == "blocked")
            if not with_text:
                db.table("sync_jobs").update(
                    {
                        "status": "error",
                        "finished_at": datetime.now(timezone.utc).isoformat(),
                        "rows_ingested": ingested,
                        "errors": {
                            "school_id": school_id,
                            "pages": len(pages),
                            "blocked": blocked,
                            "reason": "Crawl finished but no extractable page text was saved.",
                        },
                    }
                ).eq("id", job_id).execute()
                return
            extracted, claims = _extract_new_sources(school_id)
            db.table("sync_jobs").update(
                {
                    "status": "success",
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                    "rows_ingested": ingested,
                    "errors": {
                        "school_id": school_id,
                        "pages": len(pages),
                        "hit_cap": hit_cap,
                        "extracted_sources": extracted,
                        "new_claims": claims,
                        "reason": "manual recrawl from operator dashboard",
                    },
                }
            ).eq("id", job_id).execute()
        except Exception as exc:
            db.table("sync_jobs").update(
                {
                    "status": "error",
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                    "errors": {"school_id": school_id, "reason": str(exc)},
                }
            ).eq("id", job_id).execute()


@app.post("/rag/queue-recrawl")
def queue_recrawl(request: QueueRecrawlRequest):
    if request.source_type not in ("website", "fb_page"):
        raise HTTPException(status_code=400, detail="source_type must be website or fb_page")
    db = _supabase()
    school = (
        db.table("schools")
        .select("id, name, official_website_url, official_facebook_url")
        .eq("id", request.school_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not school:
        raise HTTPException(status_code=404, detail="school not found")
    row = school[0]
    url = row.get("official_website_url") if request.source_type == "website" else row.get("official_facebook_url")
    if not url:
        raise HTTPException(
            status_code=400,
            detail="Add a URL for this source before queueing a recrawl.",
        )

    now = datetime.now(timezone.utc).isoformat()
    if request.source_type == "website":
        reason = "manual recrawl from operator dashboard"
        message = f"Website recrawl queued for {row['name']} and starting now."
    else:
        reason = "queued for Apify / n8n — Facebook crawl is not started from this button yet"
        message = f"Facebook recrawl queued for {row['name']}. Apify will run it when that pipeline is connected."

    inserted = (
        db.table("sync_jobs")
        .insert(
            {
                "source_type": request.source_type,
                "started_at": now,
                "status": "queued",
                "rows_ingested": 0,
                "errors": {"school_id": request.school_id, "reason": reason},
            }
        )
        .execute()
        .data
        or []
    )
    job = inserted[0] if inserted else {}
    if request.source_type == "website" and job.get("id"):
        threading.Thread(
            target=_run_website_recrawl,
            args=(request.school_id, job["id"], url),
            daemon=True,
        ).start()
    return {"ok": True, "job_id": job.get("id"), "status": "queued", "message": message}
