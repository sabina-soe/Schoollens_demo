"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sourceTag } from "@/lib/confidence";
import { ConfidenceChip } from "./confidence-chip";
import { Skeleton } from "../../components/ui/skeleton";

const NO_EVIDENCE_ANSWER = "There is no verified evidence in public sources regarding this specific inquiry.";

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
  "What do sources say about tuition fees?",
  "What curriculum is officially listed?",
  "What do sources report regarding student safety?",
  "What average class size is documented?",
];

export function AskTab({ schoolId }: { schoolId: string }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);

  async function submitQuestion(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setQuestion("");
    setPending(true);
    setTurns((current) => [...current, { question: trimmed, answer: null, citations: [], error: null }]);
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
            question: trimmed,
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
        body: JSON.stringify({ question: trimmed }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Question service failed.");
      }
      const citations = await loadCitations(payload.cited_claim_group_ids ?? []);
      setTurns((current) => {
        const next = [...current];
        next[next.length - 1] = {
          question: trimmed,
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
          question: trimmed,
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

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submitQuestion(question);
  }

  return (
    <div className="qa-tab-container">
      <div className="grounded-ai-banner">
        <div className="ai-banner-icon">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h2 className="ai-banner-title">Grounded Evidence Inquiries</h2>
          <p className="ai-banner-desc">SchoolLens answers solely based on verified public records. If data is unrecorded or contested, it says so plainly without generating assumptions.</p>
        </div>
      </div>

      {turns.length === 0 ? (
        <div className="qa-empty-card">
          <h3 className="qa-empty-title">Suggested questions to ask:</h3>
          <div className="suggestion-pills-grid" aria-label="Suggested inquiries">
            {SUGGESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                className="suggestion-pill"
                disabled={pending}
                onClick={() => void submitQuestion(item)}
              >
                <svg className="suggestion-icon" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                  <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
                </svg>
                <span>{item}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="qa-thread-stream">
          {turns.map((turn, index) => (
            <div key={`${turn.question}-${index}`} className="qa-turn-card">
              <div className="user-question-bubble">
                <span className="bubble-speaker">You</span>
                <p className="question-text">{turn.question}</p>
              </div>

              <div className="ai-answer-bubble">
                <div className="ai-bubble-header">
                  <span className="bubble-speaker">SchoolLens Grounded AI</span>
                </div>

                {!turn.answer && !turn.error ? (
                  <div className="ai-loading-state">
                    <div className="typing-indicator">
                      <span />
                      <span />
                      <span />
                    </div>
                    <span className="retrieving-text">Retrieving citations from verified database…</span>
                  </div>
                ) : null}

                {turn.answer ? <p className="answer-text">{turn.answer}</p> : null}
                {turn.error ? <div className="error-banner">{turn.error}</div> : null}

                {turn.citations.length > 0 ? (
                  <div className="answer-citations-wrap">
                    <span className="citations-header-label">Retrieved Evidence Sources:</span>
                    <div className="citations-cards-grid">
                      {turn.citations.map((citation) => (
                        <div key={citation.id} className="citation-evidence-card">
                          <div className="citation-top">
                            <span className="citation-source-tag">{citation.source_tag}</span>
                            <ConfidenceChip label={citation.confidence_label} size="sm" />
                          </div>
                          {citation.claim_text ? (
                            <p className="citation-claim-text">{citation.claim_text}</p>
                          ) : null}
                          {citation.excerpt ? (
                            <blockquote className="citation-excerpt-quote">
                              “{citation.excerpt}”
                            </blockquote>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <form className="qa-composer-panel" onSubmit={onSubmit}>
        <label htmlFor="qa-question" className="composer-label">Ask a custom question</label>
        <div className="composer-input-row">
          <textarea
            id="qa-question"
            name="question"
            rows={2}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitQuestion(question);
              }
            }}
            disabled={pending}
            placeholder="Type your question about fees, curriculum, campus safety…"
            className="composer-textarea"
          />
          <button type="submit" disabled={pending || !question.trim()} className="btn btn-primary composer-submit-btn">
            {pending ? (
              <span>Inquiring…</span>
            ) : (
              <>
                <span>Ask</span>
                <svg viewBox="0 0 16 16" fill="currentColor" className="send-icon">
                  <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.8 14.5a.5.5 0 0 1-.928-.008L6.87 9.13 1.182 6.764a.5.5 0 0 1-.008-.928l14.5-5.8a.5.5 0 0 1 .54.11z" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
