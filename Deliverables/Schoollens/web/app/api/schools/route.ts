import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const curriculum = url.searchParams.get("curriculum")?.trim() ?? "";
  const supabase = await createClient();
  let query = supabase
    .from("schools")
    .select("id, name, address, curriculum_type, school_group_id")
    .order("name");
  if (curriculum) query = query.eq("curriculum_type", curriculum);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const schools = (data ?? []).filter((row) => {
    if (!q) return true;
    return `${row.name} ${row.address ?? ""}`.toLowerCase().includes(q);
  });
  return NextResponse.json({ schools });
}
