"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SignInControl } from "../sign-in-control";

const BUDGETS = ["Under MMK 500,000", "MMK 500,000–1,000,000", "MMK 1,000,000–3,000,000", "Over MMK 3,000,000"];
const CITIES = ["Yangon", "Mandalay", "Naypyidaw", "Taunggyi", "Mawlamyine", "Pathein", "Other"];
const PRIORITY_KEYS = ["fees", "curriculum", "safety", "facilities", "class size", "location"] as const;
const NEEDS = ["Language support", "Special educational needs", "Boarding", "Transport", "After-school care"];
const STEPS = ["Place and budget", "What matters", "Your child"] as const;

type PriorityMap = Record<string, number>;

export function QuestionnaireForm() {
  const [status, setStatus] = useState<"loading" | "out" | "ready">("loading");
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState(BUDGETS[1]);
  const [city, setCity] = useState("Yangon");
  const [locationDetail, setLocationDetail] = useState("");
  const [ranks, setRanks] = useState<PriorityMap>(
    Object.fromEntries(PRIORITY_KEYS.map((key, index) => [key, index + 1])),
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
    const ranked = PRIORITY_KEYS.map((key) => ({ key, rank: ranks[key] ?? 6 })).sort((a, b) => a.rank - b.rank);
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
        <h1>Your priorities</h1>
        <p>Loading…</p>
      </main>
    );
  }

  if (status === "out") {
    return (
      <main className="narrow-page">
        <h1>Your priorities</h1>
        <p className="page-lead">
          Sign in as a parent to save budget, location, and what matters for your child. This is not used to rank
          schools.
        </p>
        <div className="home-actions">
          <SignInControl />
          <Link href="/schools" className="btn-link btn-link-secondary">
            Browse anyway
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="narrow-page">
      <header className="page-intro">
        <h1>Your priorities</h1>
        <p className="page-lead">This is not a ranking of schools. It only records what you care about.</p>
      </header>
      <ol className="stepper" aria-label="Priority steps">
        {STEPS.map((label, index) => (
          <li key={label} className={index === step ? "stepper-active" : index < step ? "stepper-done" : ""}>
            <button type="button" onClick={() => setStep(index)}>
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>
      <form className="stack-form wizard-form" onSubmit={submit}>
        {step === 0 ? (
          <fieldset className="wizard-panel">
            <legend>Where and budget</legend>
            <label htmlFor="budget">Monthly budget</label>
            <input
              id="budget"
              type="range"
              min={0}
              max={BUDGETS.length - 1}
              value={BUDGETS.indexOf(budget)}
              onChange={(event) => setBudget(BUDGETS[Number(event.target.value)] ?? BUDGETS[1])}
            />
            <p className="range-value">{budget}</p>
            <label htmlFor="city">Location</label>
            <select id="city" value={city} onChange={(event) => setCity(event.target.value)}>
              {CITIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <label htmlFor="location_detail">Township or landmark (optional)</label>
            <input
              id="location_detail"
              value={locationDetail}
              onChange={(event) => setLocationDetail(event.target.value)}
              placeholder="e.g. Mayangone Township"
            />
          </fieldset>
        ) : null}
        {step === 1 ? (
          <fieldset className="wizard-panel">
            <legend>Rank what matters (1 = most important)</legend>
            {PRIORITY_KEYS.map((key) => (
              <label key={key} htmlFor={`rank-${key}`} className="rank-row">
                {key}
                <select
                  id={`rank-${key}`}
                  value={ranks[key]}
                  onChange={(event) => setRank(key, Number(event.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
        ) : null}
        {step === 2 ? (
          <fieldset className="wizard-panel">
            <legend>Your child</legend>
            <label htmlFor="child_age">Child’s age or grade</label>
            <input
              id="child_age"
              value={childAge}
              onChange={(event) => setChildAge(event.target.value)}
              placeholder="e.g. 8 / Grade 3"
            />
            <p>Needs (optional)</p>
            {NEEDS.map((need) => (
              <label key={need} className="check-row">
                <input type="checkbox" checked={needs.includes(need)} onChange={() => toggleNeed(need)} />
                {need}
              </label>
            ))}
          </fieldset>
        ) : null}
        <div className="wizard-nav">
          {step > 0 ? (
            <button type="button" className="secondary" onClick={() => setStep((current) => current - 1)}>
              Back
            </button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => setStep((current) => current + 1)}>
              Continue
            </button>
          ) : (
            <button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save priorities"}
            </button>
          )}
        </div>
        {saved ? (
          <p className="save-note">
            Saved.{" "}
            <Link href="/schools">Browse schools</Link> with this in mind — the AI will not pick a school for you.
          </p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </form>
    </main>
  );
}
