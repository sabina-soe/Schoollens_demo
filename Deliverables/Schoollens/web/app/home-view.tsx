"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfidenceChip } from "./schools/[id]/confidence-chip";
import { roleLabel, useSession } from "./session-context";

const STEPS = [
  {
    step: "01",
    title: "Browse the Public Register",
    body: "Search MOE-registered private and international schools across Myanmar. Every school displays an evidence confidence status rather than an arbitrary letter grade.",
    icon: (
      <svg className="step-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
        <path d="M6 6h10M6 10h10M6 14h6" />
      </svg>
    ),
  },
  {
    step: "02",
    title: "Inspect Reconciled Evidence",
    body: "Every claim on fees, curriculum, and safety is linked to official sources. Contradictions between Facebook, websites, and registry records remain transparently flagged.",
    icon: (
      <svg className="step-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 12l2 2 4-4" />
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
      </svg>
    ),
  },
  {
    step: "03",
    title: "Ask Grounded Questions",
    body: "Inquire about specific school policies. Answers strictly cite verified database records. If evidence is missing, SchoolLens says so plainly without guessing.",
    icon: (
      <svg className="step-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
];

const LEGEND_ITEMS = [
  {
    label: "supported",
    title: "Supported",
    desc: "Multiple independent sources agree on facts and numbers.",
  },
  {
    label: "likely",
    title: "Likely",
    desc: "Single reliable official source, pending cross-corroboration.",
  },
  {
    label: "conflicting",
    title: "Conflicting",
    desc: "Sources disagree — review side-by-side evidence diffs.",
  },
  {
    label: "outdated",
    title: "Outdated",
    desc: "Historical records superseded by recent curriculum/fee updates.",
  },
  {
    label: "unknown",
    title: "Unknown",
    desc: "Insufficient public documentation or pending verification.",
  },
] as const;

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
    schoolCount != null ? `Browse ${schoolCount.toLocaleString()} Schools` : "Browse Schools";

  return (
    <main className="home-page">
      {status === "in" && (role === "school_admin" || role === "moderator" || role === "platform_operator") ? (
        <div className="workspace-strip-card">
          <span className="workspace-badge">Admin Mode</span>
          <span className="workspace-text">Signed in as <strong>{roleLabel(role)}</strong>.</span>
          <div className="workspace-actions">
            {role === "school_admin" ? <Link href="/school-admin" className="workspace-link">Open School Admin →</Link> : null}
            {role === "moderator" ? <Link href="/moderator" className="workspace-link">Open Moderator Queue →</Link> : null}
            {role === "platform_operator" ? <Link href="/operator" className="workspace-link">Open Operator Portal →</Link> : null}
          </div>
        </div>
      ) : null}

      <section className="home-hero">
        <div className="home-hero-badge">
          <span className="badge-pulse" />
          <span>Independent Myanmar School Registry</span>
        </div>
        <h1 className="home-title">
          See what sources actually say — <span className="title-highlight">not a paid ranking.</span>
        </h1>
        <p className="home-lead">
          SchoolLens reconciles official MOE records, institutional websites, and verified community documentation into evidence-linked school facts. No sponsored listings. No unverified reviews.
        </p>
        <div className="home-actions">
          <Link href="/schools" className="btn btn-primary btn-lg">
            <span>{directoryLabel}</span>
            <svg className="btn-arrow" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Link>
          <Link href="/questionnaire" className="btn btn-secondary btn-lg">
            <span>Set Your Priorities</span>
          </Link>
        </div>
      </section>

      <section className="home-steps-section" aria-label="How SchoolLens works">
        <div className="section-header">
          <span className="section-kicker">Transparent Methodology</span>
          <h2>How SchoolLens Operates</h2>
        </div>
        <div className="home-steps-grid">
          {STEPS.map((step) => (
            <article key={step.title} className="home-step-card">
              <div className="step-card-header">
                <div className="step-icon-wrap">{step.icon}</div>
                <span className="step-number">{step.step}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-legend-section" aria-labelledby="confidence-legend">
        <div className="legend-header">
          <div className="legend-header-text">
            <span className="section-kicker">Evidence Confidence Standards</span>
            <h2 id="confidence-legend">Confidence is the Product</h2>
            <p>
              Every claim is audited for multi-source consensus. Color and icon signals work together to ensure clarity on mobile devices and modest displays.
            </p>
          </div>
        </div>
        <div className="legend-grid">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.label} className="legend-card">
              <div className="legend-card-chip">
                <ConfidenceChip label={item.label} size="md" />
              </div>
              <p className="legend-card-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
