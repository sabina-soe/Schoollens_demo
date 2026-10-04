import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const file = path.join(process.cwd(), "public", "school-media", `${id}.json`);
    const raw = await readFile(file, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    // No staged dump for this school.
  }
  const base = process.env.RAG_SERVICE_URL || "http://127.0.0.1:8000";
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/rag/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school_id: id }),
      signal: AbortSignal.timeout(2000),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok && Array.isArray(payload.items) && payload.items.length) {
      return NextResponse.json({ items: payload.items });
    }
  } catch {
    // RAG is optional; empty gallery is fine.
  }
  return NextResponse.json({ items: [] });
}
