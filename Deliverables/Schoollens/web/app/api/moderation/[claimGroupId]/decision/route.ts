import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LABELS = ["supported", "likely", "conflicting", "outdated", "unknown"] as const;

export async function POST(request: Request, context: { params: Promise<{ claimGroupId: string }> }) {
  const { claimGroupId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "moderator") {
    return NextResponse.json({ error: "moderator only" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const label = (LABELS as readonly string[]).includes(body.confidence_label)
    ? body.confidence_label
    : null;
  if (!label) return NextResponse.json({ error: "confidence_label is required" }, { status: 400 });
  const { error } = await supabase
    .from("claim_groups")
    .update({
      confidence_label: label,
      reconciliation_note: body.reconciliation_note ?? null,
      last_updated: new Date().toISOString(),
    })
    .eq("id", claimGroupId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: claimGroupId, confidence_label: label });
}
