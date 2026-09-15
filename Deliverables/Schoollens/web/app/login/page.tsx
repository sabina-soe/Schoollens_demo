"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
      <div className="auth-card-panel">
        <div className="auth-panel-top">
          <div className="auth-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h1>Sign in / Register</h1>
          <p className="auth-lead-text">
            School browsing is always public. Accounts are used for parent verifications, community reviews, and school admin claims.
          </p>
        </div>

        {!sent ? (
          <form className="auth-form-body" onSubmit={sendCode}>
            <div className="segmented-channel-toggle" role="group" aria-label="Sign-in channel">
              <button
                type="button"
                className={`segmented-btn ${channel === "email" ? "segmented-btn-active" : ""}`}
                onClick={() => {
                  setChannel("email");
                  setError(null);
                }}
              >
                <svg className="channel-icon" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2zm13 2.383-4.708 2.825L15 11.105V5.383zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741zM1 11.105l4.708-2.897L1 5.383v5.722z" />
                </svg>
                <span>Email OTP</span>
              </button>
              <button
                type="button"
                className={`segmented-btn ${channel === "phone" ? "segmented-btn-active" : ""}`}
                onClick={() => {
                  setChannel("phone");
                  setError(null);
                }}
              >
                <svg className="channel-icon" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h6zM5 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H5z" />
                  <path d="M8 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
                </svg>
                <span>Phone SMS</span>
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="contact" className="form-label">
                {channel === "email" ? "Email Address" : "Phone Number (with country code)"}
              </label>
              <input
                id="contact"
                type={channel === "email" ? "email" : "tel"}
                autoComplete={channel === "email" ? "email" : "tel"}
                placeholder={channel === "email" ? "parent@example.com" : "+95912345678"}
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                required
                className="input-custom"
              />
            </div>

            <button type="submit" disabled={busy} className="btn btn-primary btn-full">
              {busy ? "Sending code…" : "Send code"}
            </button>
          </form>
        ) : (
          <form className="auth-form-body" onSubmit={verifyCode}>
            <div className="code-sent-banner">
              <span>Code sent to <strong>{contact}</strong>. Check your {channel}.</span>
            </div>

            <div className="form-group">
              <label htmlFor="code" className="form-label">Verification code</label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
                className="input-custom input-code"
              />
            </div>

            <button type="submit" disabled={busy} className="btn btn-primary btn-full">
              {busy ? "Checking code…" : "Verify and sign in"}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-full"
              style={{ marginTop: "8px" }}
              onClick={() => {
                setSent(false);
                setCode("");
              }}
            >
              ← Use a different {channel}
            </button>
          </form>
        )}

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="auth-footer-note">
          <Link href="/terms">Terms of Service</Link>
          <span> · </span>
          <Link href="/privacy">Privacy Policy</Link>
        </div>
      </div>
    </main>
  );
}
