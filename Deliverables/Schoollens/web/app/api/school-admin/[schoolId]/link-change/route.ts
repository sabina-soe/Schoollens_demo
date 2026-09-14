import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const FIELDS = ["website", "facebook"] as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ schoolId: string }> },
) {
  const { schoolId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const body = await request.json();
  const field = body.field;
  const proposedValue = String(body.proposed_value || "").trim();
  if (!FIELDS.includes(field) || !proposedValue) {
    return NextResponse.json({ error: "field and proposed_value are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("link_change_requests")
    .insert({
      school_id: schoolId,
      requested_by: user.id,
      field,
      proposed_value: proposedValue,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ id: data.id, status: "pending" });
}
