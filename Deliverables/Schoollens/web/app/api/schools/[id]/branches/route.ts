import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await context.params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schools")
    .select("id, name, address, location, geocode_confidence, school_group_id")
    .eq("school_group_id", groupId)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ branches: data ?? [] });
}
