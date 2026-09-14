import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PROOF_TYPES = ["email_domain", "document", "phone"] as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: schoolId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const body = await request.json();
  const proofType = body.proof_type;
  const proofDetail = body.proof_detail;
  if (!PROOF_TYPES.includes(proofType) || !String(proofDetail || "").trim()) {
    return NextResponse.json({ error: "proof_type and proof_detail are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("school_claim_requests")
    .insert({
      school_id: schoolId,
      requested_by: user.id,
      proof_type: proofType,
      proof_detail: String(proofDetail).trim(),
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ id: data.id, status: "pending" });
}
