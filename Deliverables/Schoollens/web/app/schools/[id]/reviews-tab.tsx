"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfidenceChip } from "./confidence-chip";

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

function sentimentIcon(value: Sentiment) {
  if (value === "positive") return "+";
  if (value === "negative") return "–";
  return "~";
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
      setVoteError("A short reason is required.");
      return;
    }
    setVoteError(null);
    setBusyGroup(claimGroupId);
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setBusyGroup(null);
      setVoteError("Sign in required");
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

  if (loading) return <p>Loading reviews…</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="reviews">
      <section>
        <h2>Parent Sentiment</h2>
        <p>Mood from parent comments. It does not change a claim’s confidence.</p>
        {comments.length === 0 ? (
          <p>No parent comments on this school yet.</p>
        ) : (
          <ol className="evidence-ledger">
            {comments.map((comment) => {
              const sentiment = normalizeSentiment(comment.sentiment_label);
              return (
                <li key={comment.id} className="evidence-row">
                  <div className="evidence-row-head">
                    <span className={`sentiment-chip sentiment-chip-${sentiment}`}>
                      <span className="sentiment-chip-icon" aria-hidden="true">
                        {sentimentIcon(sentiment)}
                      </span>
                      <span>{sentimentLabel(sentiment)}</span>
                    </span>
                    {comment.mentioned_claim_category ? (
                      <span className="evidence-category">{comment.mentioned_claim_category}</span>
                    ) : null}
                  </div>
                  {comment.comment_excerpt ? (
                    <p className="evidence-claim">{comment.comment_excerpt}</p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="reviews-verify">
        <h2>Confirm or dispute</h2>
        {!signedIn ? (
          <p>
            <Link href="/login">Sign in</Link> as a parent to confirm or dispute a claim.
          </p>
        ) : !canVerify ? (
          <p>Only a parent account can confirm or dispute a claim.</p>
        ) : null}
        {claims.length === 0 ? (
          <p>No claims to confirm or dispute yet.</p>
        ) : (
          <ol className="evidence-ledger">
            {claims.map((claim) => (
              <li key={claim.id} className="evidence-row">
                <div className="evidence-row-head">
                  <ConfidenceChip label={claim.confidence_label} />
                  {claim.category ? <span className="evidence-category">{claim.category}</span> : null}
                </div>
                {claim.claim_texts.map((text) => (
                  <p key={text} className="evidence-claim">
                    {text}
                  </p>
                ))}
                <p className="evidence-freshness">
                  {claim.confirms} confirm · {claim.disputes} dispute
                </p>
                {canVerify ? (
                  <form
                    className="verify-form"
                    onSubmit={(event) => event.preventDefault()}
                  >
                    <label htmlFor={`reason-${claim.id}`}>Reason</label>
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
                    />
                    <div className="vote-actions">
                      <button
                        type="button"
                        disabled={busyGroup === claim.id}
                        onClick={() => submitVote(claim.id, "confirm")}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={busyGroup === claim.id}
                        onClick={() => submitVote(claim.id, "dispute")}
                      >
                        Dispute
                      </button>
                    </div>
                  </form>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        {voteError ? <p className="error">{voteError}</p> : null}
      </section>
    </div>
  );
}
