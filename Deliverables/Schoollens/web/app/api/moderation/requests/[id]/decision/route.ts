import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const body = await request.json();
  const decision = body.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "decision must be approved or rejected" }, { status: 400 });
  }

  const { data: claim } = await supabase
    .from("school_claim_requests")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  const rpcName = claim
    ? "review_school_claim_request"
    : "review_link_change_request";
  const { error } = await supabase.rpc(rpcName, {
    p_request_id: id,
    p_decision: decision,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ id, status: decision });
}
