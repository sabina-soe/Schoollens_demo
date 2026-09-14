import { NextResponse } from "next/server";

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

  const base = process.env.RAG_SERVICE_URL || "http://127.0.0.1:8000";
  const payload = { school_id: schoolId, question };
  const query = new URLSearchParams({ school_id: schoolId });
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/rag/qa?${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const answered = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: ragErrorMessage(answered) }, { status: 502 });
    }
    return NextResponse.json({
      answer: answered.answer,
      cited_claim_group_ids: answered.cited_claim_group_ids ?? [],
    });
  } catch {
    return NextResponse.json({ error: "Question service is not running." }, { status: 503 });
  }
}
