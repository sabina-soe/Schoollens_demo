"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfidenceChip } from "./confidence-chip";
import { Skeleton } from "../../components/ui/skeleton";

type Sentiment = "positive" | "negative" | "neutral";

type CommentRow = {
  id: string;
  comment_excerpt: string | null;
  sentiment_label: string | null;
  mentioned_claim_category: string | null;
  created_at: string | null;
};

type ClaimRow = {
  id: string;
  category: string | null;
  confidence_label: string | null;
  claim_texts: string[];
  confirms: number;
  disputes: number;
};

function normalizeSentiment(value: string | null | undefined): Sentiment {
  const label = String(value || "").toLowerCase();
  if (label === "positive" || label === "negative") return label;
  return "neutral";
}

function sentimentLabel(value: Sentiment) {
  if (value === "positive") return "Positive";
  if (value === "negative") return "Negative";
  return "Neutral";
}

function SentimentIcon({ value }: { value: Sentiment }) {
  if (value === "positive") {
    return (
      <svg className="sentiment-svg" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
        <path d="M4.285 9.567a.5.5 0 0 1 .683.183A3.498 3.498 0 0 0 8 11.5a3.498 3.498 0 0 0 3.032-1.75.5.5 0 1 1 .866.5A4.498 4.498 0 0 1 8 12.5a4.498 4.498 0 0 1-3.898-2.25.5.5 0 0 1 .183-.683zM7 6.5C7 7.328 6.552 8 6 8s-1-.672-1-1.5S5.448 5 6 5s1 .672 1 1.5zm4 0c0 .828-.448 1.5-1 1.5s-1-.672-1-1.5S9.448 5 10 5s1 .672 1 1.5z" />
      </svg>
    );
  }
  if (value === "negative") {
    return (
      <svg className="sentiment-svg" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
        <path d="M4.285 12.433a.5.5 0 0 0 .683-.183A3.498 3.498 0 0 1 8 10.5c1.295 0 2.426.703 3.032 1.75a.5.5 0 0 0 .866-.5A4.498 4.498 0 0 0 8 9.5a4.498 4.498 0 0 0-3.898 2.25.5.5 0 0 0 .183.683zM7 6.5C7 7.328 6.552 8 6 8s-1-.672-1-1.5S5.448 5 6 5s1 .672 1 1.5zm4 0c0 .828-.448 1.5-1 1.5s-1-.672-1-1.5S9.448 5 10 5s1 .672 1 1.5z" />
      </svg>
    );
  }
  return (
    <svg className="sentiment-svg" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
      <path d="M5 10.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm2-4C7 7.328 6.552 8 6 8s-1-.672-1-1.5S5.448 5 6 5s1 .672 1 1.5zm4 0c0 .828-.448 1.5-1 1.5s-1-.672-1-1.5S9.448 5 10 5s1 .672 1 1.5z" />
    </svg>
  );
}

export function ReviewsTab({ schoolId }: { schoolId: string }) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [canVerify, setCanVerify] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reasonByGroup, setReasonByGroup] = useState<Record<string, string>>({});
  const [busyGroup, setBusyGroup] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      setSignedIn(Boolean(user));
      if (user) {
        const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
        setCanVerify(profile?.role === "parent");
      }

      const { data: groups, error: groupError } = await supabase
        .from("claim_groups")
        .select("id, category, confidence_label")
        .eq("school_id", schoolId)
        .order("category");
      if (groupError) {
        setError(groupError.message);
        setLoading(false);
        return;
      }

      const groupIds = (groups ?? []).map((group) => group.id);
      const { data: members } = groupIds.length
        ? await supabase.from("claim_group_members").select("claim_group_id, claim_id").in("claim_group_id", groupIds)
        : { data: [] };
      const claimIds = [...new Set((members ?? []).map((member) => member.claim_id))];
      const { data: claimRows } = claimIds.length
        ? await supabase.from("claims").select("id, claim_text").in("id", claimIds)
        : { data: [] };
      const { data: evidence } = claimIds.length
        ? await supabase.from("evidence").select("claim_id, raw_source_id").in("claim_id", claimIds)
        : { data: [] };
      const { data: votes } = groupIds.length
        ? await supabase.from("claim_verifications").select("claim_group_id, vote").in("claim_group_id", groupIds)
        : { data: [] };

      const textsByClaim = Object.fromEntries((claimRows ?? []).map((row) => [row.id, row.claim_text]));
      const textsByGroup = new Map<string, string[]>();
      for (const member of members ?? []) {
        const text = textsByClaim[member.claim_id];
        if (!text) continue;
        const list = textsByGroup.get(member.claim_group_id) ?? [];
        if (!list.includes(text)) list.push(text);
        textsByGroup.set(member.claim_group_id, list);
      }

      const confirms = new Map<string, number>();
      const disputes = new Map<string, number>();
      for (const vote of votes ?? []) {
        if (vote.vote === "confirm") confirms.set(vote.claim_group_id, (confirms.get(vote.claim_group_id) ?? 0) + 1);
        if (vote.vote === "dispute") disputes.set(vote.claim_group_id, (disputes.get(vote.claim_group_id) ?? 0) + 1);
      }

      setClaims(
        (groups ?? []).map((group) => ({
          id: group.id,
          category: group.category,
          confidence_label: group.confidence_label,
          claim_texts: textsByGroup.get(group.id) ?? [],
          confirms: confirms.get(group.id) ?? 0,
          disputes: disputes.get(group.id) ?? 0,
        })),
      );

      const sourceIds = [
        ...new Set((evidence ?? []).map((row) => row.raw_source_id).filter((id): id is string => Boolean(id))),
      ];
      const { data: commentRows, error: commentError } = sourceIds.length
        ? await supabase
            .from("comment_analysis")
            .select("id, comment_excerpt, sentiment_label, mentioned_claim_category, created_at")
            .in("raw_source_id", sourceIds)
            .order("created_at", { ascending: false })
        : { data: [], error: null };
      if (commentError) {
        setError(commentError.message);
        setLoading(false);
        return;
      }
      setComments(commentRows ?? []);
      setLoading(false);
    })();
  }, [schoolId]);

  async function submitVote(claimGroupId: string, vote: "confirm" | "dispute") {
    const reason = (reasonByGroup[claimGroupId] || "").trim();
    if (!reason) {
      setVoteError("A brief explanation is required to support your verification.");
      return;
    }
    setVoteError(null);
    setBusyGroup(claimGroupId);
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setBusyGroup(null);
      setVoteError("Please sign in to submit a verification.");
      return;
    }
    const { error: insertError } = await supabase.from("claim_verifications").insert({
      claim_group_id: claimGroupId,
      user_id: user.id,
      vote,
      reason_text: reason,
      created_at: new Date().toISOString(),
    });
    setBusyGroup(null);
    if (insertError) {
      setVoteError(insertError.message);
      return;
    }
    setReasonByGroup((current) => ({ ...current, [claimGroupId]: "" }));
    setClaims((current) =>
      current.map((row) =>
        row.id === claimGroupId
          ? {
              ...row,
              confirms: row.confirms + (vote === "confirm" ? 1 : 0),
              disputes: row.disputes + (vote === "dispute" ? 1 : 0),
            }
          : row,
      ),
    );
  }

  if (loading) {
    return (
      <div className="tab-loading-state" aria-hidden="true">
        <Skeleton style={{ width: "100%", height: "100px", marginBottom: "16px", borderRadius: "12px" }} />
        <Skeleton style={{ width: "100%", height: "100px", marginBottom: "16px", borderRadius: "12px" }} />
      </div>
    );
  }
  if (error) return <div className="error-banner">{error}</div>;

  return (
    <div className="reviews-tab-container">
      <section className="reviews-section">
        <div className="section-header">
          <span className="section-kicker">Reviews</span>
          <h2>Public comments</h2>
          <p className="section-lead">
            Public parent comments. Sentiment does not change confidence labels.
          </p>
        </div>

        {comments.length === 0 ? (
          <div className="empty-state-card">
            <p>No public comments on file.</p>
          </div>
        ) : (
          <div className="sentiment-cards-grid">
            {comments.map((comment) => {
              const sentiment = normalizeSentiment(comment.sentiment_label);
              return (
                <div key={comment.id} className="sentiment-item-card">
                  <div className="sentiment-card-header">
                    <span className={`sentiment-pill sentiment-pill-${sentiment}`}>
                      <SentimentIcon value={sentiment} />
                      <span>{sentimentLabel(sentiment)}</span>
                    </span>
                    {comment.mentioned_claim_category ? (
                      <span className="sentiment-category-tag">{comment.mentioned_claim_category}</span>
                    ) : null}
                  </div>
                  {comment.comment_excerpt ? (
                    <blockquote className="sentiment-excerpt-quote">
                      “{comment.comment_excerpt}”
                    </blockquote>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="reviews-verify-section">
        <div className="section-header">
          <span className="section-kicker">Parents</span>
          <h2>Confirm or dispute</h2>
          <p className="section-lead">
            Current parents can confirm a claim or flag outdated figures, such as a recent fee change.
          </p>
        </div>

        {!signedIn ? (
          <div className="auth-prompt-banner">
            <span>Are you a parent with first-hand experience? </span>
            <Link href="/login" className="auth-prompt-link">Sign in as a parent</Link>
            <span> to confirm or dispute these facts.</span>
          </div>
        ) : !canVerify ? (
          <div className="auth-prompt-banner">
            <span>Only parent accounts can confirm or dispute claims here.</span>
          </div>
        ) : null}

        {claims.length === 0 ? (
          <div className="empty-state-card">
            <p>No claims to confirm yet.</p>
          </div>
        ) : (
          <div className="verification-cards-list">
            {claims.map((claim) => (
              <div key={claim.id} className="verification-item-card">
                <div className="verification-card-header">
                  <ConfidenceChip label={claim.confidence_label} size="sm" />
                  {claim.category ? <span className="verify-category-tag">{claim.category}</span> : null}
                  <div className="vote-counts-badge">
                    <span className="count-confirm">{claim.confirms} Confirm{claim.confirms === 1 ? "" : "s"}</span>
                    <span className="count-divider">·</span>
                    <span className="count-dispute">{claim.disputes} Dispute{claim.disputes === 1 ? "" : "s"}</span>
                  </div>
                </div>

                <div className="verification-claims-text">
                  {claim.claim_texts.map((text) => (
                    <p key={text} className="claim-text-row">{text}</p>
                  ))}
                </div>

                {canVerify ? (
                  <form className="verification-form" onSubmit={(event) => event.preventDefault()}>
                    <label htmlFor={`reason-${claim.id}`} className="verify-form-label">
                      Your note (e.g. "Confirmed by 2026 invoice", "Campus moved to Hlaing"):
                    </label>
                    <textarea
                      id={`reason-${claim.id}`}
                      rows={2}
                      value={reasonByGroup[claim.id] ?? ""}
                      onChange={(event) =>
                        setReasonByGroup((current) => ({
                          ...current,
                          [claim.id]: event.target.value,
                        }))
                      }
                      placeholder="Enter brief evidence rationale…"
                      className="verify-textarea"
                    />
                    <div className="verify-action-buttons">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busyGroup === claim.id}
                        onClick={() => submitVote(claim.id, "confirm")}
                      >
                        ✓ Confirm Claim
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busyGroup === claim.id}
                        onClick={() => submitVote(claim.id, "dispute")}
                      >
                        ✕ Dispute Claim
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {voteError ? <div className="error-banner">{voteError}</div> : null}
      </section>
    </div>
  );
}
