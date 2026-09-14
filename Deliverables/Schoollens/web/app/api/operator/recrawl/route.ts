import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body.school_id || !body.source_type) {
    return NextResponse.json({ error: "school_id and source_type are required" }, { status: 400 });
  }

  const bases = [
    ...new Set(
      [process.env.RAG_SERVICE_URL, "http://127.0.0.1:8000", "http://127.0.0.1:8001"].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ];

  let lastError = "Queue service is not running. Start the RAG service.";
  for (const base of bases) {
    try {
      const response = await fetch(`${base.replace(/\/$/, "")}/rag/queue-recrawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_id: body.school_id,
          source_type: body.source_type,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 404) {
        lastError = "Queue service is not running. Start this project's RAG service.";
        continue;
      }
      if (!response.ok) {
        const detail = payload.detail ?? payload.error ?? "Queue failed.";
        return NextResponse.json(
          { error: typeof detail === "string" ? detail : "Queue failed." },
          { status: response.status },
        );
      }
      return NextResponse.json(payload);
    } catch {
      lastError = "Queue service is not running. Start the RAG service.";
    }
  }

  return NextResponse.json({ error: lastError }, { status: 502 });
}
