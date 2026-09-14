"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sourceTag } from "@/lib/confidence";
import { ConfidenceChip } from "./confidence-chip";

const NO_EVIDENCE_ANSWER = "There is no verified evidence on this.";

type Citation = {
  id: string;
  category: string | null;
  confidence_label: string | null;
  claim_text: string | null;
  source_tag: string;
  excerpt: string | null;
};

type Turn = {
  question: string;
  answer: string | null;
  citations: Citation[];
  error: string | null;
};

async function loadCitations(groupIds: string[]): Promise<Citation[]> {
  if (groupIds.length === 0) return [];
  const supabase = createClient();
  const { data: groups } = await supabase
    .from("claim_groups")
    .select("id, category, confidence_label")
    .in("id", groupIds);
  const { data: members } = await supabase
    .from("claim_group_members")
    .select("claim_group_id, claim_id")
    .in("claim_group_id", groupIds);
  const claimIds = [...new Set((members ?? []).map((member) => member.claim_id))];
  const { data: claims } = claimIds.length
    ? await supabase
        .from("claims")
        .select("id, claim_text, source_type, source_trust_tier")
        .in("id", claimIds)
    : { data: [] };
  const { data: evidence } = claimIds.length
    ? await supabase.from("evidence").select("claim_id, source_excerpt").in("claim_id", claimIds)
    : { data: [] };

  const claimById = Object.fromEntries((claims ?? []).map((claim) => [claim.id, claim]));
  const firstClaimId = new Map<string, string>();
  for (const member of members ?? []) {
    if (!firstClaimId.has(member.claim_group_id)) {
      firstClaimId.set(member.claim_group_id, member.claim_id);
    }
  }
  const excerptByClaim = new Map<string, string>();
  for (const row of evidence ?? []) {
    if (row.source_excerpt && !excerptByClaim.has(row.claim_id)) {
      excerptByClaim.set(row.claim_id, row.source_excerpt);
    }
  }

  return (groups ?? []).map((group) => {
    const claimId = firstClaimId.get(group.id);
    const claim = claimId ? claimById[claimId] : undefined;
    return {
      id: group.id,
      category: group.category,
      confidence_label: group.confidence_label,
      claim_text: claim?.claim_text ?? null,
      source_tag: sourceTag(claim?.source_type, claim?.source_trust_tier),
      excerpt: claimId ? excerptByClaim.get(claimId) ?? null : null,
    };
  });
}

const SUGGESTIONS = [
  "What do sources say about fees?",
  "What curriculum is listed?",
  "What do sources say about safety?",
  "What class size is reported?",
];

export function AskTab({ schoolId }: { schoolId: string }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || pending) return;
    setQuestion("");
    setPending(true);
    setTurns((current) => [...current, { question: text, answer: null, citations: [], error: null }]);
    try {
      const supabase = createClient();
      const { count, error: countError } = await supabase
        .from("claim_groups")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId);
      if (countError) throw new Error(countError.message);
      if (!count) {
        setTurns((current) => {
          const next = [...current];
          next[next.length - 1] = {
            question: text,
            answer: NO_EVIDENCE_ANSWER,
            citations: [],
            error: null,
          };
          return next;
        });
        return;
      }

      const response = await fetch(`/api/schools/${schoolId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Question service failed.");
      }
      const citations = await loadCitations(payload.cited_claim_group_ids ?? []);
      setTurns((current) => {
        const next = [...current];
        next[next.length - 1] = {
          question: text,
          answer: payload.answer,
          citations,
          error: null,
        };
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Question service failed.";
      setTurns((current) => {
        const next = [...current];
        next[next.length - 1] = {
          question: text,
          answer: null,
          citations: [],
          error: message,
        };
        return next;
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="qa">
      {turns.length === 0 ? (
        <div className="qa-empty">
          <p>Ask a question about this school. Answers use retrieved evidence only — never a ranking.</p>
          <div className="suggestion-row" aria-label="Suggested questions">
            {SUGGESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                className="suggestion-chip"
                disabled={pending}
                onClick={() => setQuestion(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ol className="qa-thread">
          {turns.map((turn, index) => (
            <li key={`${turn.question}-${index}`} className="qa-turn">
              <p className="qa-question">{turn.question}</p>
              {turn.answer ? <p className="qa-answer">{turn.answer}</p> : null}
              {turn.error ? <p className="error">{turn.error}</p> : null}
              {!turn.answer && !turn.error ? <p className="qa-pending">Retrieving evidence…</p> : null}
              {turn.citations.map((citation) => (
                <blockquote key={citation.id} className="evidence-excerpt">
                  <span className="evidence-source-tag">{citation.source_tag}</span>
                  <ConfidenceChip label={citation.confidence_label} />
                  {citation.claim_text ? <p className="evidence-claim">{citation.claim_text}</p> : null}
                  {citation.excerpt ? <span className="evidence-excerpt-text">{citation.excerpt}</span> : null}
                </blockquote>
              ))}
            </li>
          ))}
        </ol>
      )}
      <form className="qa-form qa-composer" onSubmit={onSubmit}>
        <label htmlFor="qa-question">Question</label>
        <div className="qa-composer-row">
          <textarea
            id="qa-question"
            name="question"
            rows={2}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={pending}
            placeholder="What do sources say about fees?"
          />
          <button type="submit" disabled={pending || !question.trim()}>
            {pending ? "Asking…" : "Ask"}
          </button>
        </div>
      </form>
    </div>
  );
}
