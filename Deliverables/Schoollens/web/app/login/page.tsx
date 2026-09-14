"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureParentUser } from "@/lib/ensure-parent-user";

type Channel = "email" | "phone";

export default function LoginPage() {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>("email");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error: sendError } = await supabase.auth.signInWithOtp(
      channel === "email"
        ? { email: contact, options: { shouldCreateUser: true } }
        : { phone: contact, options: { shouldCreateUser: true } },
    );
    setBusy(false);
    if (sendError) {
      setError(sendError.message);
      return;
    }
    setSent(true);
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { data, error: verifyError } = await supabase.auth.verifyOtp(
      channel === "email"
        ? { email: contact, token: code, type: "email" }
        : { phone: contact, token: code, type: "sms" },
    );
    if (verifyError) {
      setBusy(false);
      setError(verifyError.message);
      return;
    }
    if (data.user) {
      await ensureParentUser(supabase, data.user);
    }
    setBusy(false);
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <div className="auth-panel">
        <h1>Sign up / Log in</h1>
        <p className="page-lead">
          Browse stays public. An account is only for contributing — reviews, confirmations, and school claims. New
          accounts start as parent.
        </p>
        {!sent ? (
          <form className="stack-form" onSubmit={sendCode}>
            <div className="segmented" role="group" aria-label="Sign-in channel">
              <button
                type="button"
                className={channel === "email" ? "segmented-active" : ""}
                onClick={() => setChannel("email")}
              >
                Email
              </button>
              <button
                type="button"
                className={channel === "phone" ? "segmented-active" : ""}
                onClick={() => setChannel("phone")}
              >
                Phone
              </button>
            </div>
            <label htmlFor="contact">{channel === "email" ? "Email" : "Phone"}</label>
            <input
              id="contact"
              type={channel === "email" ? "email" : "tel"}
              autoComplete={channel === "email" ? "email" : "tel"}
              placeholder={channel === "email" ? "you@example.com" : "+959..."}
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              required
            />
            <button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form className="stack-form" onSubmit={verifyCode}>
            <label htmlFor="code">One-time code</label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
            <button type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSent(false);
                setCode("");
              }}
            >
              Use a different {channel}
            </button>
          </form>
        )}
        {error ? <p className="error">{error}</p> : null}
      </div>
    </main>
  );
}
