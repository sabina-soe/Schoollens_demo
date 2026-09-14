/**
 * Seed Section 5.3 demo accounts via the Auth Admin API — not OTP signup.
 * Run from /web: node scripts/seed-demo-accounts.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";
import { createClient } from "@supabase/supabase-js";

dns.setDefaultResultOrder("ipv4first");

const DEMO_ACCOUNTS = [
  { role: "parent", email: "demo.parent@schoollens.demo" },
  { role: "school_admin", email: "demo.school_admin@schoollens.demo" },
  { role: "moderator", email: "demo.moderator@schoollens.demo" },
  { role: "platform_operator", email: "demo.platform_operator@schoollens.demo" },
];

function loadEnv() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  for (const name of [".env.local", ".env"]) {
    const path = resolve(root, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (!match) continue;
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

async function findUser(admin, email) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user) => user.email === email);
    if (found) return found;
    if (data.users.length < 100) return null;
    page += 1;
  }
}

const DEMO_PASSWORD = "demo-mode-only";

async function upsertAuthUser(admin, email) {
  const existing = await findUser(admin, email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    return existing;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error(`could not create ${email}`);
  return data.user;
}

async function pickDemoSchool(db) {
  const fromEnv = process.env.DEMO_SCHOOL_ID;
  if (fromEnv) {
    const { data, error } = await db.from("schools").select("id, name").eq("id", fromEnv).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`DEMO_SCHOOL_ID not found: ${fromEnv}`);
    return data;
  }
  const named = await db
    .from("schools")
    .select("id, name")
    .ilike("name", "%ILBC%")
    .limit(1)
    .maybeSingle();
  if (named.data) return named.data;
  const { data, error } = await db.from("schools").select("id, name").limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("no schools in the table — load a real school before seeding school_admin");
  return data;
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  const db = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const demoSchool = await pickDemoSchool(db);
  const created = [];

  for (const account of DEMO_ACCOUNTS) {
    const user = await upsertAuthUser(db, account.email);
    const { error: profileError } = await db.from("users").upsert(
      {
        id: user.id,
        role: account.role,
        "phone/email": account.email,
        created_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (profileError) throw profileError;

    if (account.role === "school_admin") {
      const { data: existing } = await db
        .from("school_claim_requests")
        .select("id")
        .eq("requested_by", user.id)
        .eq("school_id", demoSchool.id)
        .eq("status", "approved")
        .maybeSingle();
      if (!existing) {
        const { error: claimError } = await db.from("school_claim_requests").insert({
          school_id: demoSchool.id,
          requested_by: user.id,
          proof_type: "email_domain",
          proof_detail: "demo seed — pre-approved",
          status: "approved",
        });
        if (claimError) throw claimError;
      }
    }
    created.push({ role: account.role, email: account.email, id: user.id });
  }

  console.log("seeded demo accounts:");
  for (const row of created) {
    console.log(`  ${row.role}: ${row.email}`);
  }
  console.log(`school_admin pre-approved on: ${demoSchool.name} (${demoSchool.id})`);
}

main().catch((error) => {
  console.error(error);
  if (String(error?.message || error).includes("fetch failed") || error?.cause) {
    console.error(
      "\nNode cannot open HTTPS to Supabase (Cloudflare timed out). " +
        "Paste supabase/seed_demo_accounts.sql into the Supabase SQL Editor instead.",
    );
  }
  process.exit(1);
});
