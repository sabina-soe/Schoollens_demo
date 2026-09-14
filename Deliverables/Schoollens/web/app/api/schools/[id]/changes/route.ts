import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claim_changes")
    .select("id, change_type, summary_text, detected_at, claim_group_id")
    .eq("school_id", id)
    .order("detected_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ changes: data ?? [] });
}
