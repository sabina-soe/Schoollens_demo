import { NextResponse } from "next/server";
import { localAsk } from "@/lib/local-ask";

function ragErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "Question service failed.";
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => (item && typeof item === "object" && "msg" in item ? String(item.msg) : ""))
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  return "Question service failed.";
}

async function askPython(schoolId: string, question: string) {
  const base = process.env.RAG_SERVICE_URL;
  if (!base) return null;
  try {
    const query = new URLSearchParams({ school_id: schoolId });
    const response = await fetch(`${base.replace(/\/$/, "")}/rag/qa?${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ school_id: schoolId, question }),
      signal: AbortSignal.timeout(8000),
    });
    const answered = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { error: ragErrorMessage(answered) };
    }
    return {
      answer: answered.answer,
      cited_claim_group_ids: answered.cited_claim_group_ids ?? [],
    };
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: schoolId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const question = String(body.question || "").trim();
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const fromPython = await askPython(schoolId, question);
  if (fromPython && "answer" in fromPython) return NextResponse.json(fromPython);

  const local = await localAsk(schoolId, question);
  return NextResponse.json(local);
}
