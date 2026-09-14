"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfidenceChip } from "./schools/[id]/confidence-chip";
import { roleLabel, useSession } from "./session-context";

const STEPS = [
  {
    title: "Browse the register",
    body: "Search MOE-listed schools by name, place, or curriculum. Every row carries a confidence chip, not a grade.",
  },
  {
    title: "Read the evidence",
    body: "Claims stay linked to websites, Facebook, and the registry. Contradictions stay visible until sources change.",
  },
  {
    title: "Ask a grounded question",
    body: "Answers cite retrieved evidence only. If sources are silent, SchoolLens says so — it will not invent a ranking.",
  },
];

export function HomeView() {
  const { status, role } = useSession();
  const [schoolCount, setSchoolCount] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("schools")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => {
        if (typeof count === "number") setSchoolCount(count);
      });
  }, []);

  const directoryLabel =
    schoolCount != null ? `Browse ${schoolCount.toLocaleString()} schools` : "Browse schools";

  return (
    <main className="home-page">
      {status === "in" && (role === "school_admin" || role === "moderator" || role === "platform_operator") ? (
        <p className="workspace-strip">
          Signed in as {roleLabel(role)}.{" "}
          {role === "school_admin" ? <Link href="/school-admin">Open school admin</Link> : null}
          {role === "moderator" ? <Link href="/moderator">Open moderator queue</Link> : null}
          {role === "platform_operator" ? <Link href="/operator">Open operator</Link> : null}
        </p>
      ) : null}

      <section className="home-hero">
        <p className="home-kicker">Myanmar school evidence</p>
        <h1>See what sources actually say — not a ranking.</h1>
        <p className="home-lead">
          SchoolLens reconciles public websites, Facebook pages, and the MOE register into evidence-linked claims. The
          AI’s job is confidence, contradiction, and “still unknown.” It does not pick a school for you.
        </p>
        <div className="home-actions">
          <Link href="/schools" className="btn-link">
            {directoryLabel}
          </Link>
          <Link href="/questionnaire" className="btn-link btn-link-secondary">
            Set your priorities
          </Link>
        </div>
      </section>

      <section className="home-steps" aria-label="How SchoolLens works">
        {STEPS.map((step, index) => (
          <article key={step.title} className="home-step">
            <p className="home-step-index">{index + 1}</p>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
          </article>
        ))}
      </section>

      <section className="home-legend" aria-labelledby="confidence-legend">
        <div>
          <h2 id="confidence-legend">Confidence is the product</h2>
          <p>
            Every claim group gets a label. Color is never the only signal — the icon and word travel with it, on the
            directory and on the profile.
          </p>
        </div>
        <ul className="legend-list">
          <li>
            <ConfidenceChip label="supported" />
            <span>Independent sources agree</span>
          </li>
          <li>
            <ConfidenceChip label="likely" />
            <span>Some support, not fully corroborated</span>
          </li>
          <li>
            <ConfidenceChip label="conflicting" />
            <span>Sources disagree — inspect both sides</span>
          </li>
          <li>
            <ConfidenceChip label="outdated" />
            <span>Newer evidence superseded this</span>
          </li>
          <li>
            <ConfidenceChip label="unknown" />
            <span>Not enough to say</span>
          </li>
        </ul>
      </section>
    </main>
  );
}
