import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("school_summaries")
      .select("school_id, summary_text, key_stats, things_to_verify, generated_at")
      .eq("school_id", id)
      .maybeSingle();
    if (data) return NextResponse.json(data);
  } catch {
    // Browser loads this table directly; Node often cannot reach Supabase.
  }
  try {
    const file = path.join(process.cwd(), "public", "school-summaries", `${id}.json`);
    const raw = await readFile(file, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({
      school_id: id,
      summary_text: null,
      key_stats: [],
      things_to_verify: [],
      generated_at: null,
    });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return GET(request, context);
}
