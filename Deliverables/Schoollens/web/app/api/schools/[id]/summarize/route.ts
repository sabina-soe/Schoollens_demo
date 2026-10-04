import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

const emptySummary = (id: string) => ({
  school_id: id,
  summary_text: null,
  key_stats: [],
  things_to_verify: [],
  generated_at: null,
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const file = path.join(process.cwd(), "public", "school-summaries", `${id}.json`);
    const raw = await readFile(file, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(emptySummary(id));
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return GET(request, context);
}
