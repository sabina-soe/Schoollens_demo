import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const vote = body.vote === "dispute" ? "dispute" : body.vote === "confirm" ? "confirm" : null;
  if (!vote) return NextResponse.json({ error: "vote must be confirm or dispute" }, { status: 400 });
  const { error, data } = await supabase
    .from("claim_verifications")
    .insert({
      claim_group_id: id,
      user_id: user.id,
      vote,
      reason_text: String(body.reason_text || "").trim() || null,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data.id });
}
