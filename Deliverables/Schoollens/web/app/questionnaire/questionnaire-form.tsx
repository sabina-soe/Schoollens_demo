"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SignInControl } from "../sign-in-control";
import { Skeleton } from "../components/ui/skeleton";

const BUDGETS = ["Under MMK 500,000", "MMK 500,000–1,000,000", "MMK 1,000,000–3,000,000", "Over MMK 3,000,000"];
const CITIES = ["Yangon", "Mandalay", "Naypyidaw", "Taunggyi", "Mawlamyine", "Pathein", "Other"];
const PRIORITY_KEYS = [
  { key: "fees", label: "Tuition & Fees" },
  { key: "curriculum", label: "Curriculum & Accreditation" },
  { key: "safety", label: "Culture & Child Safety" },
  { key: "facilities", label: "Campus Facilities" },
  { key: "class size", label: "Class Size & Student Ratio" },
  { key: "location", label: "Commute & Location" },
] as const;
const NEEDS = ["Language support (ESL/Burmese)", "Special educational needs (SEN)", "Boarding facilities", "School bus / Transport", "After-school care"];
const STEPS = ["Place & Budget", "What Matters", "Your Child"] as const;

type PriorityMap = Record<string, number>;

export function QuestionnaireForm() {
  const [status, setStatus] = useState<"loading" | "out" | "ready">("loading");
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState(BUDGETS[1]);
  const [city, setCity] = useState("Yangon");
  const [locationDetail, setLocationDetail] = useState("");
  const [ranks, setRanks] = useState<PriorityMap>(
    Object.fromEntries(PRIORITY_KEYS.map((item, index) => [item.key, index + 1])),
  );
  const [childAge, setChildAge] = useState("");
  const [needs, setNeeds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        setStatus("out");
        return;
      }
      const { data } = await supabase
        .from("questionnaires")
        .select("budget_range, location, priorities, child_age, child_needs")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        if (data.budget_range) setBudget(data.budget_range);
        if (data.location) {
          const [first, ...rest] = data.location.split(" — ");
          setCity(CITIES.includes(first) ? first : "Other");
          setLocationDetail(rest.join(" — ") || (CITIES.includes(first) ? "" : data.location));
        }
        if (Array.isArray(data.priorities)) {
          const next = { ...ranks };
          for (const item of data.priorities as { key?: string; rank?: number }[]) {
            if (item.key && typeof item.rank === "number") next[item.key] = item.rank;
          }
          setRanks(next);
        } else if (data.priorities && typeof data.priorities === "object") {
          setRanks({ ...ranks, ...(data.priorities as PriorityMap) });
        }
        if (data.child_age) setChildAge(data.child_age);
        if (data.child_needs) setNeeds(data.child_needs.split(", ").filter(Boolean));
      }
      setStatus("ready");
    })();
    // Load once on mount; ranks seed is static.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setRank(key: string, value: number) {
    setRanks((current) => ({ ...current, [key]: value }));
  }

  function toggleNeed(value: string) {
    setNeeds((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setBusy(false);
      setStatus("out");
      return;
    }
    const location = locationDetail.trim() ? `${city} — ${locationDetail.trim()}` : city;
    const ranked = PRIORITY_KEYS.map((item) => ({ key: item.key, rank: ranks[item.key] ?? 6 })).sort((a, b) => a.rank - b.rank);
    const { error: upsertError } = await supabase.from("questionnaires").insert({
      user_id: user.id,
      budget_range: budget,
      location,
      priorities: ranked,
      child_age: childAge.trim() || null,
      child_needs: needs.join(", ") || null,
      created_at: new Date().toISOString(),
    });
    setBusy(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setSaved(true);
  }

  if (status === "loading") {
    return (
      <main className="narrow-page">
        <Skeleton style={{ width: "60%", height: "32px", marginBottom: "16px" }} />
        <Skeleton style={{ width: "100%", height: "180px", borderRadius: "12px" }} />
      </main>
    );
  }

  if (status === "out") {
    return (
      <main className="narrow-page">
        <div className="auth-card-panel">
          <div className="page-intro-badge">Parent Tools</div>
          <h1>Set Your School Priorities</h1>
          <p className="page-lead">
            Sign in as a parent to record your monthly budget, preferred townships, and specific educational needs. SchoolLens will use these to organize evidence without generating black-box school ranks.
          </p>
          <div className="auth-actions-group" style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
            <SignInControl />
            <Link href="/schools" className="btn btn-secondary">
              Browse Directory First →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="narrow-page">
      <header className="page-intro">
        <div className="page-intro-badge">Personalized Search Focus</div>
        <h1>Your Family Priorities</h1>
        <p className="page-lead">This configuration records what matters to you. SchoolLens will not automatically rank or eliminate schools.</p>
      </header>

      <div className="stepper-wrap">
        <ol className="stepper-list" aria-label="Priority steps">
          {STEPS.map((label, index) => (
            <li key={label} className={`stepper-item ${index === step ? "stepper-item-active" : index < step ? "stepper-item-done" : ""}`}>
              <button type="button" className="stepper-btn" onClick={() => setStep(index)}>
                <span className="step-badge">{index + 1}</span>
                <span className="step-title">{label}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <form className="wizard-form-card" onSubmit={submit}>
        {step === 0 ? (
          <fieldset className="wizard-fieldset">
            <legend className="wizard-legend">Where & Monthly Budget</legend>
            <div className="form-group">
              <label htmlFor="budget" className="form-label">Monthly Tuition Budget (MMK)</label>
              <div className="budget-slider-wrap">
                <input
                  id="budget"
                  type="range"
                  min={0}
                  max={BUDGETS.length - 1}
                  value={BUDGETS.indexOf(budget)}
                  onChange={(event) => setBudget(BUDGETS[Number(event.target.value)] ?? BUDGETS[1])}
                  className="range-input"
                />
                <div className="budget-active-display">
                  <span className="budget-tag">Selected Range:</span>
                  <strong className="budget-val">{budget}</strong>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="city" className="form-label">Primary City / Region</label>
              <select id="city" value={city} onChange={(event) => setCity(event.target.value)} className="select-custom">
                {CITIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="location_detail" className="form-label">Township or Specific Area (Optional)</label>
              <input
                id="location_detail"
                value={locationDetail}
                onChange={(event) => setLocationDetail(event.target.value)}
                placeholder="e.g. Bahan, Mayangone, Kamayut…"
                className="input-custom"
              />
            </div>
          </fieldset>
        ) : null}

        {step === 1 ? (
          <fieldset className="wizard-fieldset">
            <legend className="wizard-legend">Rank What Matters (1 = Highest Priority)</legend>
            <p className="wizard-subtext">Order the factors most critical for your child's learning environment.</p>
            <div className="rank-items-stack">
              {PRIORITY_KEYS.map((item) => (
                <div key={item.key} className="rank-item-card">
                  <span className="rank-item-label">{item.label}</span>
                  <div className="rank-select-wrap">
                    <label htmlFor={`rank-${item.key}`} className="sr-only">Priority rank for {item.label}</label>
                    <select
                      id={`rank-${item.key}`}
                      value={ranks[item.key]}
                      onChange={(event) => setRank(item.key, Number(event.target.value))}
                      className="select-rank"
                    >
                      {[1, 2, 3, 4, 5, 6].map((value) => (
                        <option key={value} value={value}>
                          Rank {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        ) : null}

        {step === 2 ? (
          <fieldset className="wizard-fieldset">
            <legend className="wizard-legend">Child Information & Specific Needs</legend>
            <div className="form-group">
              <label htmlFor="child_age" className="form-label">Child’s Age or Current Grade</label>
              <input
                id="child_age"
                value={childAge}
                onChange={(event) => setChildAge(event.target.value)}
                placeholder="e.g. 7 years old / Grade 2"
                className="input-custom"
              />
            </div>

            <div className="form-group">
              <span className="form-label">Special Considerations & Requirements (Optional)</span>
              <div className="needs-chips-grid">
                {NEEDS.map((need) => {
                  const active = needs.includes(need);
                  return (
                    <button
                      key={need}
                      type="button"
                      className={`need-chip-btn ${active ? "need-chip-active" : ""}`}
                      onClick={() => toggleNeed(need)}
                    >
                      <span className="need-chip-check">{active ? "✓" : "+"}</span>
                      <span>{need}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </fieldset>
        ) : null}

        <div className="wizard-footer-nav">
          {step > 0 ? (
            <button type="button" className="btn btn-secondary" onClick={() => setStep((current) => current - 1)}>
              ← Back
            </button>
          ) : <span />}
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={() => setStep((current) => current + 1)}>
              Continue →
            </button>
          ) : (
            <button type="submit" disabled={busy} className="btn btn-primary">
              {busy ? "Saving Priorities…" : "✓ Save Priorities"}
            </button>
          )}
        </div>

        {saved ? (
          <div className="success-banner-card">
            <svg className="success-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <strong>Priorities successfully saved!</strong>
              <p>Your search context has been recorded. <Link href="/schools" className="banner-action-link">Browse schools now →</Link></p>
            </div>
          </div>
        ) : null}
        {error ? <div className="error-banner">{error}</div> : null}
      </form>
    </main>
  );
}
