import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "platform_operator") {
    return NextResponse.json({ error: "operator only" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const confidence = body.decision === "rejected" ? "rejected" : "confirmed";
  const { error } = await supabase.from("raw_source_school_mentions").update({ confidence }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id, confidence });
}
