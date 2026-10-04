import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parentVerifyItems, type ParentClaimInput } from "@/lib/parent-claims";

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
    const summary = JSON.parse(raw) as { things_to_verify?: ParentClaimInput[] };
    return NextResponse.json({
      ...summary,
      things_to_verify: parentVerifyItems(summary.things_to_verify),
    });
  } catch {
    return NextResponse.json(emptySummary(id));
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return GET(request, context);
}
