import { NextResponse } from "next/server";
import { ensureParentUser } from "@/lib/ensure-parent-user";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  await ensureParentUser(supabase, user);
  const body = await request.json().catch(() => ({}));
  const { error, data } = await supabase
    .from("questionnaires")
    .insert({
      user_id: user.id,
      budget_range: body.budget_range ?? null,
      location: body.location ?? null,
      priorities: body.priorities ?? null,
      child_age: body.child_age ?? null,
      child_needs: body.child_needs ?? null,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data.id });
}
